export interface StoragePort {
  putObject(path: string, data: Buffer, contentType: string): Promise<{ publicUrl: string }>;
  createUploadUrl(
    path: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string; expiresAt: string }>;
  createDownloadUrl(path: string, expiresSeconds: number): Promise<string>;
}
export const STORAGE_PORT = Symbol("STORAGE_PORT");
