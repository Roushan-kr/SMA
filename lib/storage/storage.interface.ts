export interface StorageProvider {
  upload(
    buffer: Buffer,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<{ url: string; key: string }>;

  delete(key: string): Promise<void>;

  getSignedUrl?(key: string, expiresIn?: number): Promise<string>;
}