import { S3Storage } from "./s3-storage.js";
import type { AbstractStorage } from "./storage.js";
import { buildTrustedOrigins } from "../http/origins.js";

export { AbstractStorage } from "./storage.js";
export type {
  PresignOptions,
  PresignedUpload,
  PutOptions,
  StorageBody,
  StorageObject,
  StoredObject,
} from "./storage.js";
export { S3Storage } from "./s3-storage.js";

let storage: AbstractStorage | null = null;

export type StorageInfo = {
  driver: string;
  bucket: string | null;
  endpoint: string | null;
  configured: boolean;
};

/**
 * Reads the storage settings from the environment.
 *
 * STORAGE_DRIVER=s3 works for AWS S3, RustFS, MinIO and any other
 * S3-compatible endpoint. When S3_ENDPOINT is set, path-style addressing is
 * used automatically, which is what self-hosted servers expect.
 */
export function storageInfo(): StorageInfo {
  const driver = (process.env.STORAGE_DRIVER ?? "s3").toLowerCase();
  const bucket = process.env.S3_BUCKET?.trim() || null;
  const endpoint = process.env.S3_ENDPOINT?.trim() || null;
  const accessKey = process.env.S3_ACCESS_KEY?.trim();
  const secretKey = process.env.S3_SECRET_KEY?.trim();

  return {
    driver,
    bucket,
    endpoint,
    configured: Boolean(bucket && accessKey && secretKey),
  };
}

export function isStorageConfigured(): boolean {
  return storageInfo().configured;
}

/**
 * Resolves the configured driver once per process.
 *
 * Callers that can run without storage should check `isStorageConfigured()`
 * first; otherwise a missing configuration is a clear startup-time error for
 * the request that needs it.
 */
export function getStorage(): AbstractStorage {
  if (storage) return storage;

  const info = storageInfo();

  if (info.driver !== "s3") {
    throw new Error(
      `Unsupported STORAGE_DRIVER "${info.driver}". Only "s3" is implemented.`,
    );
  }

  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Object storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY and " +
        "S3_SECRET_KEY (see mushak/backend/.env.example).",
    );
  }

  storage = new S3Storage({
    bucket,
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    accessKeyId,
    secretAccessKey,
    forcePathStyle:
      (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() !== "false",
    publicUrl: process.env.S3_PUBLIC_URL?.trim() || undefined,
    corsOrigins: buildTrustedOrigins(),
  });

  return storage;
}
