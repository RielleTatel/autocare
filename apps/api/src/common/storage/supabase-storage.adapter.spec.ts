import { SupabaseStorageAdapter } from "./supabase-storage.adapter";

// Mock the supabase client so the adapter's mapping is tested without a real bucket.
const from = {
  upload: jest.fn(),
  createSignedUploadUrl: jest.fn(),
  createSignedUrl: jest.fn(),
};
const storage = { from: jest.fn(() => from) };
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ storage })),
}));

describe("SupabaseStorageAdapter", () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.SUPABASE_STORAGE_BUCKET = "autocare";
  });
  beforeEach(() => jest.clearAllMocks());

  it("putObject uploads to the private bucket and returns the object url", async () => {
    from.upload.mockResolvedValue({ data: { path: "dpa/x.json" }, error: null });
    const adapter = new SupabaseStorageAdapter();
    const out = await adapter.putObject("dpa/x.json", Buffer.from("{}"), "application/json");
    expect(storage.from).toHaveBeenCalledWith("autocare");
    expect(from.upload).toHaveBeenCalledWith(
      "dpa/x.json",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/json", upsert: true }),
    );
    expect(out.publicUrl).toBe("https://proj.supabase.co/storage/v1/object/autocare/dpa/x.json");
  });

  it("createUploadUrl returns the signed upload url + object url + expiry", async () => {
    from.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://proj.supabase.co/storage/v1/upload/signed/abc", token: "tok", path: "vehicles/v/1.jpg" },
      error: null,
    });
    const adapter = new SupabaseStorageAdapter();
    const out = await adapter.createUploadUrl("vehicles/v/1.jpg", "image/jpeg");
    expect(from.createSignedUploadUrl).toHaveBeenCalledWith("vehicles/v/1.jpg");
    expect(out.uploadUrl).toBe("https://proj.supabase.co/storage/v1/upload/signed/abc");
    expect(out.publicUrl).toBe("https://proj.supabase.co/storage/v1/object/autocare/vehicles/v/1.jpg");
    expect(Date.parse(out.expiresAt)).not.toBeNaN();
  });

  it("createDownloadUrl returns a signed read url with the requested ttl", async () => {
    from.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://proj.supabase.co/storage/v1/object/sign/read" }, error: null });
    const adapter = new SupabaseStorageAdapter();
    const url = await adapter.createDownloadUrl("vehicles/v/1.jpg", 3600);
    expect(from.createSignedUrl).toHaveBeenCalledWith("vehicles/v/1.jpg", 3600);
    expect(url).toBe("https://proj.supabase.co/storage/v1/object/sign/read");
  });

  it("throws when supabase returns an error", async () => {
    from.createSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });
    const adapter = new SupabaseStorageAdapter();
    await expect(adapter.createDownloadUrl("missing", 60)).rejects.toThrow(/not found/);
  });
});
