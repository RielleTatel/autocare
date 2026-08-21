import { describe, expect, it } from "vitest";
import { z } from "zod";
import { envelopeSchema, errorCodes } from "./index";

describe("contracts", () => {
  it("parses a success envelope", () => {
    const schema = envelopeSchema(z.object({ ok: z.boolean() }));
    const parsed = schema.parse({ success: true, data: { ok: true }, meta: null, error: null });
    expect(parsed.data?.ok).toBe(true);
  });
  it("rejects success=true with an error body", () => {
    const schema = envelopeSchema(z.object({}));
    expect(() => schema.parse({ success: true, data: {}, meta: null, error: { code: "RATE_LIMITED", message: "x" } })).toThrow();
  });
  it("contains all documented error codes", () => {
    expect(errorCodes).toContain("AUTH_TOKEN_INVALID");
    expect(errorCodes).toContain("ODOMETER_REGRESSION");
    expect(errorCodes.length).toBe(25);
  });
});
