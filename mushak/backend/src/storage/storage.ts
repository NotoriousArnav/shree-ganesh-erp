import type { Readable } from "node:stream";

/** Bytes accepted by `put()`: a buffer, a string or a readable stream. */
export type StorageBody = Buffer | Uint8Array | string | Readable;

export type PutOptions = {
  contentType?: string;
  cacheControl?: string;
  /** Custom object metadata; values must be strings. */
  metadata?: Record<string, string>;
};

export type StoredObject = {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
};

export type StorageObject = StoredObject & {
  body: Readable;
};

export type PresignOptions = {
  /** Seconds until the signed URL expires. Defaults to 900 (15 minutes). */
  expiresIn?: number;
  /** MIME type the client must send with the upload. */
  contentType?: string;
  /** Browser download name for `presignDownload`. */
  downloadName?: string;
};

export type PresignedUpload = {
  key: string;
  url: string;
  method: "PUT";
  expiresIn: number;
  headers: Record<string, string>;
};

/**
 * Base class for object storage.
 *
 * `getStorage()` resolves the configured driver once per process. Callers work
 * against this interface, so a RustFS/MinIO endpoint, AWS S3 or a future local
 * disk driver are interchangeable.
 */
export abstract class AbstractStorage {
  abstract readonly driver: string;
  abstract readonly bucket: string;

  abstract put(
    key: string,
    body: StorageBody,
    options?: PutOptions,
  ): Promise<StoredObject>;

  abstract get(key: string): Promise<StorageObject>;

  abstract delete(key: string): Promise<void>;

  /** Returns object metadata, or null when the key does not exist. */
  abstract head(key: string): Promise<StoredObject | null>;

  abstract list(prefix: string, limit?: number): Promise<StoredObject[]>;

  abstract presignUpload(
    key: string,
    options?: PresignOptions,
  ): Promise<PresignedUpload>;

  abstract presignDownload(key: string, options?: PresignOptions): Promise<string>;

  /** True when the bucket exists and this process can reach it. */
  abstract check(): Promise<boolean>;
}
