import { describe, expect, it } from "vitest";
import { profileUpdateSchema, consentSchema, userStatusUpdateSchema } from "./users";

describe("user contracts", () => {
  it("accepts a partial profile update", () => {
    const p = profileUpdateSchema.parse({ name: "Juan Dela Cruz", emergencyContactMobile: "+639171234567" });
    expect(p.name).toBe("Juan Dela Cruz");
  });
  it("rejects a non-PH emergency mobile", () => {
    expect(() => profileUpdateSchema.parse({ emergencyContactMobile: "0917123" })).toThrow();
  });
  it("consent requires a policy version", () => {
    expect(() => consentSchema.parse({})).toThrow();
    expect(consentSchema.parse({ policyVersion: "2026-08-privacy-v1" }).policyVersion).toBe("2026-08-privacy-v1");
  });
  it("status update requires a reason of substance", () => {
    expect(() => userStatusUpdateSchema.parse({ status: "SUSPENDED", reason: "no" })).toThrow();
    expect(userStatusUpdateSchema.parse({ status: "SUSPENDED", reason: "chargeback abuse" }).status).toBe("SUSPENDED");
  });
});
