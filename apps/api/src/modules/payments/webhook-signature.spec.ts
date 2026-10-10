import { createHmac } from "crypto";
import { DomainError } from "../../common/errors/domain-error";
import { verifyHmacSignature, verifyPaymongoSignature } from "./webhook-signature";

describe("verifyPaymongoSignature", () => {
  const now = 1_791_584_000;
  const secret = "fixture-webhook-secret";
  const body = '{\n  "label": "Care ₱ 🛠️",\n  "paid": true\n}\n';

  function digest(rawBody: Buffer | string = body, timestamp = String(now), key = secret): string {
    return createHmac("sha256", key)
      .update(`${timestamp}.`, "utf8")
      .update(rawBody)
      .digest("hex");
  }

  function header(timestamp = now, rawBody: Buffer | string = body): string {
    return `t=${timestamp},te=${digest(rawBody, String(timestamp))},li=`;
  }

  function expectInvalid(signature: string | undefined, rawBody: Buffer | string = body, key: string | undefined = secret): void {
    let error: unknown;
    try {
      verifyPaymongoSignature(rawBody, signature, key);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      code: "WEBHOOK_SIGNATURE_INVALID",
      httpStatus: 401,
      message: "Invalid webhook signature",
    });
  }

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(now * 1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([body, Buffer.from(body, "utf8")])("verifies whitespace and Unicode without reserializing the payload", (rawBody) => {
    expect(() => verifyPaymongoSignature(rawBody, header(), secret)).not.toThrow();
  });

  it("hashes exact Buffer bytes without decoding them", () => {
    const rawBody = Buffer.from([0xff, 0xfe, 0x00, 0x61]);
    expect(() => verifyPaymongoSignature(rawBody, header(now, rawBody), secret)).not.toThrow();
  });

  it("accepts reordered fields and spaces between header fields", () => {
    expect(() => verifyPaymongoSignature(body, `li=, te=${digest()}, t=${now}`, secret)).not.toThrow();
  });

  it("accepts an omitted inactive live-mode signature", () => {
    expect(() => verifyPaymongoSignature(body, `t=${now},te=${digest()}`, secret)).not.toThrow();
  });

  it("accepts hex signatures regardless of hex letter case", () => {
    expect(() => verifyPaymongoSignature(body, `t=${now},te=${digest().toUpperCase()},li=`, secret)).not.toThrow();
  });

  it.each([-300, 300])("accepts the five-minute freshness boundary (%s seconds)", (offset) => {
    expect(() => verifyPaymongoSignature(body, header(now + offset), secret)).not.toThrow();
  });

  it.each([-301, 301])("rejects signed requests beyond five minutes (%s seconds)", (offset) => {
    expectInvalid(header(now + offset));
  });

  it("rejects a modified body", () => {
    expectInvalid(header(), body.replace("true", "false"));
  });

  it("rejects a whitespace-only change to a previously signed body", () => {
    expectInvalid(header(), JSON.stringify(JSON.parse(body)));
  });

  it("rejects a different signing secret", () => {
    expectInvalid(header(), body, "incorrect-fixture-secret");
  });

  it("rejects a modified timestamp even within the freshness window", () => {
    expectInvalid(`t=${now - 1},te=${digest()},li=`);
  });

  it("requires the timestamp prefix to be part of the signed message", () => {
    const rawBodySignature = createHmac("sha256", secret).update(body).digest("hex");
    expectInvalid(`t=${now},te=${rawBodySignature},li=`);
  });

  it.each([undefined, "", "not-a-header"])("rejects missing or unstructured signatures (%s)", (signature) => {
    expectInvalid(signature);
  });

  it("rejects an unconfigured signing secret", () => {
    let error: unknown;
    try {
      verifyPaymongoSignature(body, header(), undefined);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: "WEBHOOK_SIGNATURE_INVALID", httpStatus: 401, message: "Invalid webhook signature" });
  });

  it.each(["", "-1", "+1", "1.5", "1e9", "NaN", "Infinity", "01791584000", "1791584000 ", "9007199254740993"])(
    "rejects malformed timestamps (%s)",
    (timestamp) => {
      expectInvalid(`t=${timestamp},te=${digest(body, timestamp)},li=`);
    },
  );

  it.each([
    `te=${digest()},li=`,
    `t=${now},li=`,
    `t=${now},te=,li=`,
    `t=${now},te=not-hex,li=`,
    `t=${now},te=${"a".repeat(63)},li=`,
    `t=${now},te=${"a".repeat(65)},li=`,
    `t=${now},te=${"z".repeat(64)},li=`,
    `t=${now},te=${digest()},li=bad`,
    `t=${now},te=${digest()},li=,unknown=value`,
    `t=${now},te=${digest()},li=,`,
    `t=${now},te=${digest()},li=,,`,
    `t=${now},te=${digest()},li=,bad-field`,
    `t=${now},te=${digest()},li=,t=${now}`,
    `t=${now},te=${digest()},te=${digest()},li=`,
    `t=${now},te=${digest()},li=,li=`,
  ])("rejects missing, malformed, unknown, or duplicate fields (%s)", (signature) => {
    expectInvalid(signature);
  });

  it("never falls back to a valid live-mode signature", () => {
    expectInvalid(`t=${now},te=,li=${digest()}`);
    expectInvalid(`t=${now},te=${"0".repeat(64)},li=${digest()}`);
  });

  it("uses the test signature even when a different live-mode signature is present", () => {
    expect(() => verifyPaymongoSignature(body, `t=${now},te=${digest()},li=${"0".repeat(64)}`, secret)).not.toThrow();
  });
});

describe("verifyHmacSignature fake-provider compatibility", () => {
  it("continues accepting the fake provider's raw-body HMAC", () => {
    const body = Buffer.from('{"eventId":"fixture"}');
    const secret = "fixture-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(() => verifyHmacSignature(body, signature, secret)).not.toThrow();
  });
});
