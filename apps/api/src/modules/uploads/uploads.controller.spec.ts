import { UploadsController } from "./uploads.controller";

const VEHICLE_ID = "11111111-1111-1111-1111-111111111111";

describe("UploadsController", () => {
  const storage: any = { createUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "https://up", publicUrl: "https://pub/x.jpg", expiresAt: "2026-01-01T00:00:00Z" }) };
  const vehicles: any = { findForUser: jest.fn().mockResolvedValue({ id: VEHICLE_ID }) };
  const user = { id: "u1", role: "MEMBER" as const, orgId: null };
  const ctl = new UploadsController(storage, vehicles);

  it("returns a signed url under the vehicle's path for jpeg", async () => {
    const out = await ctl.signedUrl(user, { vehicleId: VEHICLE_ID, contentType: "image/jpeg", kind: "PHOTO" });
    expect(out.uploadUrl).toBe("https://up");
    expect(storage.createUploadUrl.mock.calls[0][0]).toMatch(new RegExp(`^vehicles/${VEHICLE_ID}/[0-9a-f-]{36}\\.jpg$`));
    expect(vehicles.findForUser).toHaveBeenCalledWith(user, VEHICLE_ID, "update"); // ownership enforced
  });
  it("rejects a disallowed content type", async () => {
    await expect(ctl.signedUrl(user, { vehicleId: VEHICLE_ID, contentType: "application/pdf" as any, kind: "PHOTO" })).rejects.toThrow();
  });
});
