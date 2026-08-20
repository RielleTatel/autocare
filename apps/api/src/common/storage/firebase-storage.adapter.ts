import { Injectable } from "@nestjs/common";
import * as admin from "firebase-admin";
import { StoragePort } from "./storage.port";

const UPLOAD_TTL_MS = 15 * 60_000;

@Injectable()
export class FirebaseStorageAdapter implements StoragePort {
  private bucket() { return admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET); }

  async putObject(path: string, data: Buffer, contentType: string) {
    await this.bucket().file(path).save(data, { contentType });
    return { publicUrl: `https://storage.googleapis.com/${this.bucket().name}/${path}` };
  }
  async createUploadUrl(path: string, contentType: string) {
    const expires = Date.now() + UPLOAD_TTL_MS;
    const [uploadUrl] = await this.bucket().file(path).getSignedUrl({ version: "v4", action: "write", expires, contentType });
    return { uploadUrl, publicUrl: `https://storage.googleapis.com/${this.bucket().name}/${path}`, expiresAt: new Date(expires).toISOString() };
  }
  async createDownloadUrl(path: string, expiresSeconds: number) {
    const [url] = await this.bucket().file(path).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + expiresSeconds * 1000 });
    return url;
  }
}
