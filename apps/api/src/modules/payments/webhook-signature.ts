import { createHmac, timingSafeEqual } from "crypto";
import { DomainError } from "../../common/errors/domain-error";

/**
 * Timing-safe HMAC-SHA256 verification for the fake provider's fixture format.
 * Computes HMAC-SHA256 over the RAW body with `secret` and compares it to `signature`.
 * Throws DomainError(WEBHOOK_SIGNATURE_INVALID, 401) on any mismatch (including a missing
 * signature or an unconfigured secret) — never leaks *why* it mismatched to the caller.
 */
export function verifyHmacSignature(rawBody: Buffer | string, signature: string | undefined, secret: string | undefined): void {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody ?? "", "utf8");
  if (!secret || !signature) {
    throw new DomainError("WEBHOOK_SIGNATURE_INVALID", "Missing webhook signature or secret", 401);
  }
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const sigBuf = Buffer.from(signature, "utf8");
  const valid = expectedBuf.length === sigBuf.length && timingSafeEqual(expectedBuf, sigBuf);
  if (!valid) {
    throw new DomainError("WEBHOOK_SIGNATURE_INVALID", "Invalid webhook signature", 401);
  }
}

/**
 * Verify PayMongo's test-mode `t=<seconds>,te=<hex>,li=` header against the exact raw bytes.
 * The timestamp is included in the HMAC and must be within five minutes of this server's
 * clock. Live signatures are never used as a fallback; live payments are disabled here.
 */
export function verifyPaymongoSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string | undefined,
): void {
  const invalid = () => new DomainError("WEBHOOK_SIGNATURE_INVALID", "Invalid webhook signature", 401);
  if (!secret || !signature) throw invalid();

  const fields = new Map<string, string>();
  for (const part of signature.split(",")) {
    const match = /^([a-z]+)=(.*)$/.exec(part.trimStart());
    if (!match || !["t", "te", "li"].includes(match[1]) || fields.has(match[1])) {
      throw invalid();
    }
    fields.set(match[1], match[2]);
  }

  const timestampText = fields.get("t");
  const testSignature = fields.get("te");
  const liveSignature = fields.get("li");
  const digestFormat = /^[a-f0-9]{64}$/i;
  if (
    !timestampText || !/^[1-9][0-9]*$/.test(timestampText) ||
    !testSignature || !digestFormat.test(testSignature) ||
    (liveSignature !== undefined && liveSignature !== "" && !digestFormat.test(liveSignature))
  ) {
    throw invalid();
  }

  const timestamp = Number(timestampText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) throw invalid();

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const expected = createHmac("sha256", secret).update(`${timestampText}.`, "utf8").update(body).digest();
  const received = Buffer.from(testSignature, "hex");
  if (!timingSafeEqual(expected, received)) throw invalid();
}
