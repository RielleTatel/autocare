import { UploadsController } from "./uploads.controller";

describe("UploadsController", () => {
  const storage: any = { createUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "https://up", publicUrl: "https://pub/x.jpg", expiresAt: "2026-01-01T00:00:00Z" }) };
  const vehicles: any = { findForUser: jest.fn().mockResolvedValue({ id: "v1" }) };
  const user = { id: "u1", role: "MEMBER" as const, orgId: null };
  const ctl = new UploadsController(storage, vehicles);

  it("returns a signed url under the vehicle's path for jpeg", async () => {
    const out = await ctl.signedUrl(user, { vehicleId: "v1", contentType: "image/jpeg", kind: "PHOTO" });
    expect(out.uploadUrl).toBe("https://up");
    expect(storage.createUploadUrl.mock.calls[0][0]).toMatch(/^vehicles\/v1\/[0-9a-f-]{36}\.jpg$/);
    expect(vehicles.findForUser).toHaveBeenCalledWith(user, "v1", "update"); // ownership enforced
  });
  it("rejects a disallowed content type", async () => {
    await expect(ctl.signedUrl(user, { vehicleId: "v1", contentType: "application/pdf" as any, kind: "PHOTO" })).rejects.toThrow();
  });
});
