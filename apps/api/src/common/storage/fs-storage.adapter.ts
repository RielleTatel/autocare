import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { StoragePort } from "./storage.port";

const ROOT = join(process.cwd(), ".storage");

export class FsStorageAdapter implements StoragePort {
  async putObject(path: string, data: Buffer) {
    const full = join(ROOT, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
    return { publicUrl: `file://${full}` };
  }
  async createUploadUrl(path: string) {
    const full = join(ROOT, path);
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    return { uploadUrl: `file://${full}?upload`, publicUrl: `file://${full}`, expiresAt };
  }
  async createDownloadUrl(path: string) {
    return `file://${join(ROOT, path)}`;
  }
}
