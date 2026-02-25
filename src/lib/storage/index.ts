import type { StorageProvider } from "./storage.interface.js";

let _provider: StorageProvider | null = null;

/**
 * Lazily initialise and return the configured storage provider.
 * Uses dynamic imports so only the selected provider's SDK is loaded.
 */
export async function getStorage(): Promise<StorageProvider> {
  if (_provider) return _provider;

  if (process.env["STORAGE_PROVIDER"] === "s3") {
    const { S3Storage } = await import("./s3.storage.js");
    _provider = new S3Storage();
  } else {
    const { CloudinaryStorage } = await import("./cloudinary.storage.js");
    _provider = new CloudinaryStorage();
  }

  return _provider;
}

export type { StorageProvider };