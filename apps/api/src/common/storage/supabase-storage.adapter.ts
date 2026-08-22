import { Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StoragePort } from "./storage.port";

// Supabase Storage adapter (System Architecture §7.3): the service-role key lives
// only here in the API; mobile/web clients never hold a Supabase key and reach
// files only through short-lived signed URLs minted after the API's CASL check.
// The bucket is private.
const UPLOAD_TTL_MS = 2 * 60 * 60_000; // Supabase signed upload URLs default to ~2h.

@Injectable()
export class SupabaseStorageAdapter implements StoragePort {
  private _client?: SupabaseClient;

  private client(): SupabaseClient {
    if (!this._client) {
      this._client = createClient(
        process.env.SUPABASE_URL as string,
        process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        { auth: { persistSession: false } },
      );
    }
    return this._client;
  }

  private bucketName() {
    return process.env.SUPABASE_STORAGE_BUCKET as string;
  }

  private bucket() {
    return this.client().storage.from(this.bucketName());
  }

  private objectUrl(path: string) {
    return `${process.env.SUPABASE_URL}/storage/v1/object/${this.bucketName()}/${path}`;
  }

  async putObject(path: string, data: Buffer, contentType: string) {
    const { error } = await this.bucket().upload(path, data, { contentType, upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return { publicUrl: this.objectUrl(path) };
  }

  async createUploadUrl(path: string, _contentType: string) {
    const { data, error } = await this.bucket().createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Supabase signed upload URL failed: ${error?.message}`);
    return {
      uploadUrl: data.signedUrl,
      publicUrl: this.objectUrl(path),
      expiresAt: new Date(Date.now() + UPLOAD_TTL_MS).toISOString(),
    };
  }

  async createDownloadUrl(path: string, expiresSeconds: number) {
    const { data, error } = await this.bucket().createSignedUrl(path, expiresSeconds);
    if (error || !data) throw new Error(`Supabase signed URL failed: ${error?.message}`);
    return data.signedUrl;
  }
}
