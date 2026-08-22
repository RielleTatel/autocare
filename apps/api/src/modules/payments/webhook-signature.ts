import { createHmac, timingSafeEqual } from "crypto";
import { DomainError } from "../../common/errors/domain-error";

/**
 * Timing-safe HMAC-SHA256 verification shared by the real and fake provider adapters.
 * Computes HMAC-SHA256 over the RAW body with `secret` and compares it to `signature`.
 * Throws DomainError(WEBHOOK_SIGNATURE_INVALID, 401) on any mismatch (including a missing
 * signature or an unconfigured secret) — never leaks *why* it mismatched to the caller.
 *
 * Note: PayMongo's real `Paymongo-Signature` header actually carries a structured
 * `t=<timestamp>,te=<test-signature>,li=<live-signature>` value, where the signed message is
 * `${t}.${rawBody}` rather than the raw body alone. This helper implements the simpler
 * "HMAC over the raw body" scheme called for by the task brief; wiring up the real timestamped
 * scheme against a live PayMongo sandbox is an OWED follow-up (see task report).
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
