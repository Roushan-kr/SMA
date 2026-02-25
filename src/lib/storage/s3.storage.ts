import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./storage.interface.js";

// ── Lazy S3 Client ───────────────────────────────────────────────────

let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env["AWS_REGION"] ?? "us-east-1",
    });
  }
  return _s3;
}

function getBucket(): string {
  const bucket = process.env["S3_BUCKET"];
  if (!bucket) throw new Error("S3_BUCKET environment variable is not set");
  return bucket;
}

// ── Provider ─────────────────────────────────────────────────────────

export class S3Storage implements StorageProvider {
  async upload(
    buffer: Buffer,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<{ url: string; key: string }> {
    const bucket = getBucket();

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileName,
        Body: buffer,
        ContentType: (options?.contentType as string) ?? "application/octet-stream",
      }),
    );

    return {
      url: `https://${bucket}.s3.amazonaws.com/${fileName}`,
      key: fileName,
    };
  }

  async delete(key: string): Promise<void> {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
  }

  async getSignedUrl(key: string, expiresIn = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    });

    return await getSignedUrl(getS3Client(), command, { expiresIn });
  }
}