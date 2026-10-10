import { createHmac } from "crypto";
import { PaymongoAdapter, mapPaymongoEvent } from "./paymongo.adapter";

const testKey = "sk_test_fixture";
const webhookSecret = "whsec_unit_fixture";
const timestamp = 1_797_840_000;
const invoice = { id: "invoice-fixture", totalCentavos: 89900, description: "Invoice INV-2026-000001" };
const checkoutUrl = "https://checkout.paymongo.com/cs_fixture#fixture";
const envNames = ["PAYMONGO_SECRET_KEY", "PAYMONGO_WEBHOOK_SECRET", "PAYMONGO_SUCCESS_URL", "PAYMONGO_CANCEL_URL"] as const;

function payment(attributes: Record<string, unknown> = {}) {
  return {
    id: "pay_fixture",
    type: "payment",
    attributes: {
      amount: 89900,
      currency: "PHP",
      status: "paid",
      livemode: false,
      source: { type: "card" },
      metadata: { invoiceId: invoice.id },
      ...attributes,
    },
  };
}

function checkoutEvent(attributes: Record<string, unknown> = {}) {
  return {
    data: {
      id: "evt_fixture",
      type: "event",
      attributes: {
        type: "checkout_session.payment.paid",
        livemode: false,
        data: {
          id: "cs_fixture",
          type: "checkout_session",
          attributes: {
            status: "active",
            livemode: false,
            metadata: { invoiceId: invoice.id },
            reference_number: "invoice-fallback",
            payments: [payment()],
            ...attributes,
          },
        },
      },
    },
  };
}

function signed(body: Buffer | string, seconds = timestamp) {
  const digest = createHmac("sha256", webhookSecret).update(`${seconds}.`).update(body).digest("hex");
  return `t=${seconds},te=${digest},li=`;
}

function checkoutResponse(attributes: Record<string, unknown> = {}, id = "cs_fixture") {
  return { data: { id, attributes: { livemode: false, checkout_url: checkoutUrl, ...attributes } } };
}

describe("PaymongoAdapter (unit, test fixtures only)", () => {
  let adapter: PaymongoAdapter;
  let fetchMock: jest.SpyInstance;
  let savedEnv: Partial<Record<(typeof envNames)[number], string>>;

  beforeEach(() => {
    savedEnv = {};
    for (const name of envNames) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
    process.env.PAYMONGO_SECRET_KEY = testKey;
    process.env.PAYMONGO_WEBHOOK_SECRET = webhookSecret;
    adapter = new PaymongoAdapter();
    fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true, status: 200, json: jest.fn().mockResolvedValue(checkoutResponse()),
    } as unknown as Response);
    jest.spyOn(Date, "now").mockReturnValue(timestamp * 1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const name of envNames) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  });

  describe("createCheckout", () => {
    it("uses the V1 contract, backend Basic auth, invoice linkage, and configured HTTPS redirects", async () => {
      process.env.PAYMONGO_SUCCESS_URL = "https://autocare.example/payment/success";
      process.env.PAYMONGO_CANCEL_URL = "https://autocare.example/payment/cancel";

      await expect(adapter.createCheckout(invoice)).resolves.toEqual({ checkoutUrl, pspRef: "cs_fixture" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.paymongo.com/v1/checkout_sessions");
      expect(options).toMatchObject({
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${testKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: expect.any(AbortSignal),
      });
      expect(JSON.parse(options.body)).toEqual({
        data: {
          attributes: {
            line_items: [{ amount: 89900, currency: "PHP", name: invoice.description, quantity: 1 }],
            payment_method_types: ["card", "gcash", "paymaya"],
            metadata: { invoiceId: invoice.id },
            reference_number: invoice.id,
            success_url: process.env.PAYMONGO_SUCCESS_URL,
            cancel_url: process.env.PAYMONGO_CANCEL_URL,
          },
        },
      });
    });

    it("allows both return URLs to be absent", async () => {
      await adapter.createCheckout(invoice);

      const attributes = JSON.parse(fetchMock.mock.calls[0][1].body).data.attributes;
      expect(attributes).not.toHaveProperty("success_url");
      expect(attributes).not.toHaveProperty("cancel_url");
    });

    it.each([
      { success: "https://autocare.example/success", cancel: undefined },
      { success: undefined, cancel: "https://autocare.example/cancel" },
      { success: "http://autocare.example/success", cancel: "https://autocare.example/cancel" },
      { success: "autocare://payment-result", cancel: "autocare://payment-result" },
      { success: "", cancel: "https://autocare.example/cancel" },
      { success: "https://autocare.example/success", cancel: "invalid" },
    ])("rejects an incomplete or invalid return URL pair: %j", async ({ success, cancel }) => {
      if (success !== undefined) process.env.PAYMONGO_SUCCESS_URL = success;
      if (cancel !== undefined) process.env.PAYMONGO_CANCEL_URL = cancel;

      await expect(adapter.createCheckout(invoice)).rejects.toMatchObject({ code: "PAYMENT_FAILED", httpStatus: 503 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([undefined, "", "sk_live_fixture", "pk_test_fixture"])("rejects the unavailable or unsafe API key %s before fetch", async (key) => {
      if (key === undefined) delete process.env.PAYMONGO_SECRET_KEY;
      else process.env.PAYMONGO_SECRET_KEY = key;

      await expect(adapter.createCheckout(invoice)).rejects.toMatchObject({ code: "PAYMENT_FAILED", httpStatus: 503 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([0, -1, 89900.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejects invalid centavo amount %s before fetch", async (totalCentavos) => {
        await expect(adapter.createCheckout({ ...invoice, totalCentavos })).rejects.toMatchObject({
          code: "PAYMENT_FAILED", httpStatus: 400,
        });
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it.each([
      { livemode: true },
      { livemode: undefined },
      { checkout_url: undefined },
      { checkout_url: "" },
      { checkout_url: "invalid" },
      { checkout_url: "http://checkout.paymongo.com/cs_fixture" },
      { checkout_url: "https://checkout.paymongo.com.evil.example/cs_fixture" },
      { checkout_url: "https://fixture:password@checkout.paymongo.com/cs_fixture" },
    ])("rejects an unsafe or malformed checkout response: %j", async (attributes) => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => checkoutResponse(attributes) });

      await expect(adapter.createCheckout(invoice)).rejects.toMatchObject({ code: "PAYMENT_FAILED", httpStatus: 502 });
    });

    it("rejects a response without a Checkout Session identifier", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => checkoutResponse({}, "pay_wrong_resource") });

      await expect(adapter.createCheckout(invoice)).rejects.toMatchObject({ code: "PAYMENT_FAILED", httpStatus: 502 });
    });

    it("returns a sanitized provider error without reading or exposing its response body", async () => {
      const text = jest.fn().mockResolvedValue("sensitive provider fixture details");
      fetchMock.mockResolvedValueOnce({ ok: false, status: 422, text });

      await expect(adapter.createCheckout(invoice)).rejects.toMatchObject({
        code: "PAYMENT_FAILED", httpStatus: 502, message: "PayMongo checkout failed: 422",
      });
      expect(text).not.toHaveBeenCalled();
    });
  });

  describe("verifyWebhook and mapEvent", () => {
    it.each(["card", "gcash", "paymaya"] as const)("verifies raw timestamped HMAC and maps settled %s checkout details", (sourceType) => {
      const event = checkoutEvent({ payments: [payment({ source: { type: sourceType } })] });
      const body = Buffer.from(JSON.stringify(event, null, 2));
      const methods = { card: "CARD", gcash: "GCASH", paymaya: "MAYA" };

      expect(adapter.verifyWebhook(body, signed(body))).toEqual({
        eventId: "evt_fixture", type: "checkout_session.payment.paid",
        pspReference: "pay_fixture", invoiceId: invoice.id, amountCentavos: 89900,
        method: methods[sourceType], succeeded: true, raw: event,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses session reference_number when session metadata is absent", () => {
      expect(adapter.mapEvent(checkoutEvent({ metadata: undefined }))).toMatchObject({
        invoiceId: "invoice-fallback", pspReference: "pay_fixture", amountCentavos: 89900,
      });
    });

    it("selects the paid attempt after a previous failure", () => {
      expect(adapter.mapEvent(checkoutEvent({
        payments: [{ ...payment({ status: "failed" }), id: "pay_failed" }, payment()],
      }))).toMatchObject({ pspReference: "pay_fixture", succeeded: true });
    });

    it.each([
      { type: "payment.paid", status: "paid", succeeded: true },
      { type: "payment.failed", status: "failed", succeeded: false },
    ])("maps direct $type resources", ({ type, status, succeeded }) => {
      const event = { data: { id: "evt_direct", attributes: { type, livemode: false, data: payment({ status }) } } };

      expect(adapter.mapEvent(event)).toEqual({
        eventId: "evt_direct", type, pspReference: "pay_fixture", invoiceId: invoice.id,
        amountCentavos: 89900, method: "CARD", succeeded, raw: event,
      });
    });

    it("ignores refund.succeeded even when refund metadata references an invoice", () => {
      const event = { data: { id: "evt_refund", attributes: { type: "refund.succeeded", livemode: false, data: payment() } } };
      const result = mapPaymongoEvent(event);

      expect(result).toEqual({ eventId: "evt_refund", type: "refund.succeeded", pspReference: "evt_refund", succeeded: false, raw: event });
      expect(result).not.toHaveProperty("invoiceId");
      expect(result).not.toHaveProperty("amountCentavos");
    });

    it.each([
      { amount: undefined }, { amount: 0 }, { amount: -1 }, { amount: 89900.5 },
      { amount: Number.MAX_SAFE_INTEGER + 1 }, { amount: "89900" },
      { currency: "USD" }, { currency: undefined },
      { source: undefined }, { source: { type: "qrph" } },
      { status: "failed" }, { livemode: true },
    ])("rejects malformed settled payment attributes: %j", (attributes) => {
      const body = JSON.stringify(checkoutEvent({ payments: [payment(attributes)] }));

      expect(() => adapter.verifyWebhook(body, signed(body))).toThrow("Invalid PayMongo test payment event");
    });

    it.each([{ payments: [] }, { payments: [payment(), { ...payment(), id: "pay_second" }] }])("rejects zero or multiple paid payments: %j", ({ payments }) => {
      expect(() => adapter.mapEvent(checkoutEvent({ payments }))).toThrow("Invalid PayMongo test payment event");
    });

    it("rejects a live envelope even with an authentic test signature", () => {
      const event = checkoutEvent();
      event.data.attributes.livemode = true;
      const body = JSON.stringify(event);

      expect(() => adapter.verifyWebhook(body, signed(body))).toThrow("Invalid PayMongo test payment event");
    });

    it("rejects a live Checkout Session resource", () => {
      expect(() => adapter.mapEvent(checkoutEvent({ livemode: true }))).toThrow("Invalid PayMongo test payment event");
    });

    it("rejects direct payment events whose resource status contradicts the event", () => {
      const event = { data: { id: "evt_wrong_status", attributes: { type: "payment.failed", livemode: false, data: payment() } } };

      expect(() => adapter.mapEvent(event)).toThrow("Invalid PayMongo test payment event");
    });

    it("rejects correctly signed malformed JSON", () => {
      const body = "{ invalid JSON";

      expect(() => adapter.verifyWebhook(body, signed(body))).toThrow("Invalid PayMongo test payment event");
    });

    it("rejects a missing event identifier", () => {
      const event = checkoutEvent();
      event.data.id = "";

      expect(() => adapter.mapEvent(event)).toThrow("Invalid PayMongo test payment event");
    });

    it.each(["", "deadbeef", `t=${timestamp},li=${"a".repeat(64)}`, `t=${timestamp},te=invalid,li=`])(
      "rejects malformed or absent test signatures %s", (signature) => {
        expect(() => adapter.verifyWebhook(JSON.stringify(checkoutEvent()), signature)).toThrow("Invalid webhook signature");
      },
    );

    it("rejects an authentic expired signature", () => {
      const body = JSON.stringify(checkoutEvent());

      expect(() => adapter.verifyWebhook(body, signed(body, timestamp - 301))).toThrow("Invalid webhook signature");
    });

    it("rejects a modified raw body before parsing its event", () => {
      const body = JSON.stringify(checkoutEvent());

      expect(() => adapter.verifyWebhook(`${body} `, signed(body))).toThrow("Invalid webhook signature");
    });

    it("fails closed when the webhook secret is unavailable", () => {
      const body = JSON.stringify(checkoutEvent());
      delete process.env.PAYMONGO_WEBHOOK_SECRET;

      expect(() => adapter.verifyWebhook(body, signed(body))).toThrow("Invalid webhook signature");
    });
  });
});
