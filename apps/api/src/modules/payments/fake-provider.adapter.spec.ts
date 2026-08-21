import { createHmac } from "crypto";
import { DomainError } from "../../common/errors/domain-error";
import { FakeProviderAdapter, FAKE_WEBHOOK_SECRET, FakePspPayload } from "./fake-provider.adapter";

function sign(body: string, secret = FAKE_WEBHOOK_SECRET): string {
  return createHmac("sha256", secret).update(Buffer.from(body, "utf8")).digest("hex");
}

describe("FakeProviderAdapter.verifyWebhook", () => {
  const adapter = new FakeProviderAdapter();
  const payload: FakePspPayload = {
    eventId: "evt_123",
    type: "payment.paid",
    pspReference: "pay_abc",
    invoiceId: "11111111-1111-1111-1111-111111111111",
    amountCentavos: 100000,
    succeeded: true,
  };
  const body = JSON.stringify(payload);

  it("valid HMAC signature -> returns a mapped PspEvent", () => {
    const event = adapter.verifyWebhook(Buffer.from(body), sign(body));
    expect(event).toEqual({
      eventId: "evt_123",
      type: "payment.paid",
      pspReference: "pay_abc",
      invoiceId: "11111111-1111-1111-1111-111111111111",
      amountCentavos: 100000,
      succeeded: true,
      raw: payload,
    });
  });

  it("tampered body with a signature computed over the ORIGINAL body -> throws 401 WEBHOOK_SIGNATURE_INVALID", () => {
    const validSig = sign(body);
    const tampered = JSON.stringify({ ...payload, amountCentavos: 999999 });
    expect(() => adapter.verifyWebhook(Buffer.from(tampered), validSig)).toThrow(DomainError);
    try {
      adapter.verifyWebhook(Buffer.from(tampered), validSig);
      fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe("WEBHOOK_SIGNATURE_INVALID");
      expect((e as DomainError).httpStatus).toBe(401);
    }
  });

  it("signature computed with the wrong secret -> throws 401 WEBHOOK_SIGNATURE_INVALID", () => {
    const badSig = sign(body, "wrong-secret");
    expect(() => adapter.verifyWebhook(Buffer.from(body), badSig)).toThrow(DomainError);
  });

  it("missing signature -> throws 401 WEBHOOK_SIGNATURE_INVALID", () => {
    expect(() => adapter.verifyWebhook(Buffer.from(body), "")).toThrow(DomainError);
  });
});
