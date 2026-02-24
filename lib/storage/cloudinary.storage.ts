import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import type { StorageProvider } from "./storage.interface.js";

// ── Provider ─────────────────────────────────────────────────────────

export class CloudinaryStorage implements StorageProvider {
  constructor() {
    cloudinary.config({
      cloud_name: process.env["CLOUDINARY_CLOUD_NAME"] as string,
      api_key: process.env["CLOUDINARY_API_KEY"] as string,
      api_secret: process.env["CLOUDINARY_API_SECRET"] as string,
    });
  }
  async upload(
    buffer: Buffer,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<{ url: string; key: string }> {
    return new Promise<{ url: string; key: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          public_id: fileName,
          ...options,
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(error);
          }

          resolve({
            url: result.secure_url,
            key: result.public_id,
          });
        },
      );

      stream.end(buffer);
    });
  }

  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    return cloudinary.url(key, {
      resource_type: "raw",
      sign_url: true,
      type: "authenticated",
      ...(expiresIn && { expires_at: Math.floor(Date.now() / 1000) + expiresIn }),
    });
  }

  async delete(key: string): Promise<void> {
    await cloudinary.uploader.destroy(key, {
      resource_type: "raw",
    });
  }
}