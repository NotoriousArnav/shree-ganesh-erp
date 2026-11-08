import type { Readable } from "node:stream";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  AbstractStorage,
  type PresignOptions,
  type PresignedUpload,
  type PutOptions,
  type StorageBody,
  type StorageObject,
  type StoredObject,
} from "./storage.js";

export type S3StorageOptions = {
  bucket: string;
  /** Custom endpoint for RustFS/MinIO; omit for AWS S3. */
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Path-style URLs are required by most self-hosted S3 servers. */
  forcePathStyle?: boolean;
  /**
   * Public base URL used to build permanent links (e.g. a CDN or
   * `https://s3.example.com/bucket`). Optional; presigned URLs are used
   * otherwise.
   */
  publicUrl?: string;
  /**
   * Browser origins allowed to PUT presigned uploads directly to the bucket.
   * A CORS policy is written on first use so uploads work from the shop UI.
   */
  corsOrigins?: string[];
};

/**
 * S3-compatible driver. Works with AWS S3, RustFS, MinIO, Ceph RGW and any
 * endpoint that speaks the S3 API.
 */
export class S3Storage extends AbstractStorage {
  readonly driver = "s3";
  readonly bucket: string;

  private readonly client: S3Client;
  private readonly publicUrl?: string;
  private readonly corsOrigins: string[];
  private bucketReady: Promise<void> | null = null;

  constructor(options: S3StorageOptions) {
    super();
    this.bucket = options.bucket;
    this.publicUrl = options.publicUrl?.replace(/\/+$/, "");
    this.corsOrigins = options.corsOrigins ?? [];
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async put(
    key: string,
    body: StorageBody,
    options: PutOptions = {},
  ): Promise<StoredObject> {
    await this.ensureBucket();

    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
        Metadata: options.metadata,
      }),
    );

    return {
      key,
      size:
        typeof body === "string"
          ? Buffer.byteLength(body)
          : body instanceof Uint8Array
            ? body.byteLength
            : 0,
      contentType: options.contentType,
      etag: stripQuotes(result.ETag),
    };
  }

  async get(key: string): Promise<StorageObject> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!result.Body) {
      throw new Error(`Storage object "${key}" has no body.`);
    }

    return {
      key,
      body: result.Body as Readable,
      size: result.ContentLength ?? 0,
      contentType: result.ContentType,
      etag: stripQuotes(result.ETag),
      lastModified: result.LastModified,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        key,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType,
        etag: stripQuotes(result.ETag),
        lastModified: result.LastModified,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async list(prefix: string, limit = 100): Promise<StoredObject[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: Math.min(Math.max(limit, 1), 1000),
      }),
    );

    return (result.Contents ?? []).flatMap((entry) =>
      entry.Key
        ? [
            {
              key: entry.Key,
              size: entry.Size ?? 0,
              etag: stripQuotes(entry.ETag),
              lastModified: entry.LastModified,
            },
          ]
        : [],
    );
  }

  async presignUpload(
    key: string,
    options: PresignOptions = {},
  ): Promise<PresignedUpload> {
    await this.ensureBucket();

    const expiresIn = options.expiresIn ?? 900;
    const headers: Record<string, string> = {};
    if (options.contentType) headers["content-type"] = options.contentType;

    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: options.contentType,
      }),
      { expiresIn },
    );

    return { key, url, method: "PUT", expiresIn, headers };
  }

  async presignDownload(
    key: string,
    options: PresignOptions = {},
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: options.downloadName
          ? `attachment; filename="${sanitizeHeader(options.downloadName)}"`
          : undefined,
      }),
      { expiresIn: options.expiresIn ?? 900 },
    );
  }

  async check(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch (error) {
      if (isNotFound(error)) {
        try {
          await this.createBucket();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /** Public URL when configured, otherwise the presigned URL. */
  async publicUrlFor(key: string): Promise<string> {
    if (this.publicUrl) return `${this.publicUrl}/${encodeKey(key)}`;
    return this.presignDownload(key);
  }

  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = this.createBucket()
        .then(() => this.configureCors())
        .catch((error: unknown) => {
          // Lost a race with another process creating the same bucket.
          if (!isBucketExists(error)) {
            this.bucketReady = null;
            throw error;
          }
        });
    }

    return this.bucketReady;
  }

  /**
   * Writes the bucket CORS policy so browsers can PUT presigned uploads and
   * read thumbnails. Failure is logged but not fatal: server-side uploads and
   * presigned downloads still work without it.
   */
  private async configureCors(): Promise<void> {
    if (this.corsOrigins.length === 0) return;

    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: this.corsOrigins,
                AllowedMethods: ["GET", "PUT", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
    } catch (error) {
      console.warn(
        `Could not set CORS on bucket "${this.bucket}": ${(error as Error).message}`,
      );
    }
  }

  private async createBucket(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.bucket }),
      );
      return;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }

    try {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.bucket }),
      );
    } catch (error) {
      if (!isBucketExists(error)) throw error;
    }
  }
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof S3ServiceException)) return false;
  return (
    error.name === "NotFound" ||
    error.name === "NoSuchKey" ||
    error.$metadata.httpStatusCode === 404
  );
}

function isBucketExists(error: unknown): boolean {
  if (!(error instanceof S3ServiceException)) return false;
  return (
    error.name === "BucketAlreadyOwnedByYou" ||
    error.name === "BucketAlreadyExists"
  );
}

function stripQuotes(value?: string): string | undefined {
  return value?.replace(/^"|"$/g, "");
}

function sanitizeHeader(value: string): string {
  return value.replace(/["\r\n]/g, "");
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}
