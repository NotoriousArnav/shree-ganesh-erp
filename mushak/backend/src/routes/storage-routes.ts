import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import {
  requireMerchant,
  requirePermission,
} from "../http/auth-guard.js";
import { getStorage, isStorageConfigured, storageInfo } from "../storage/index.js";

const UPLOAD_BODY_LIMIT = 25 * 1024 * 1024;

const presignUploadBody = z.object({
  /** Original file name; used to build a readable key. */
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(200).optional(),
  /** Optional folder inside the merchant's own prefix, e.g. "products". */
  prefix: z.string().trim().max(200).optional(),
  expiresIn: z.number().int().min(60).max(7 * 24 * 60 * 60).optional(),
});

const keyQuery = z.object({
  key: z.string().trim().min(1).max(1024),
  expiresIn: z.coerce.number().int().min(60).max(7 * 24 * 60 * 60).optional(),
  downloadName: z.string().trim().max(200).optional(),
});

const listQuery = z.object({
  prefix: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

const uploadPrefixQuery = z.object({
  key: z.string().trim().min(1).max(1024),
  contentType: z.string().trim().max(200).optional(),
});

/**
 * Storage controller.
 *
 * Keys are always tenant-scoped: a merchant may only sign, read or delete
 * objects under its own `${merchantId}/` prefix. Uploads use presigned PUT URLs
 * so file bytes never pass through the API server; `PUT /api/storage/objects`
 * exists for scripts and server-to-server uploads.
 */
export async function registerStorageRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: UPLOAD_BODY_LIMIT },
    (_request, body, done) => done(null, body),
  );

  app.get("/api/storage/status", { preHandler: requireMerchant() }, async (request) => {
    const access = request.merchantAccess!;
    const info = storageInfo();

    let reachable: boolean | null = null;

    if (info.configured) {
      try {
        reachable = await getStorage().check();
      } catch {
        reachable = false;
      }
    }

    return { ...info, reachable, prefix: merchantPrefix(access.merchantId) };
  });

  app.post(
    "/api/storage/presign-upload",
    { preHandler: requirePermission("catalogue") },
    async (request, reply) => {
      if (!requireStorage(reply)) return reply;

      const input = presignUploadBody.safeParse(request.body);
      if (!input.success) {
        return reply.code(400).send({ error: input.error.issues[0]?.message });
      }

      const access = request.merchantAccess!;
      const folder = input.data.prefix
        ? `${safeSegment(input.data.prefix)}/`
        : "";
      const key = `${merchantPrefix(access.merchantId)}${folder}${dateFolder()}/${randomUUID()}-${slugify(
        input.data.filename,
      )}`;

      return getStorage().presignUpload(key, {
        contentType: input.data.contentType,
        expiresIn: input.data.expiresIn,
      });
    },
  );

  app.get(
    "/api/storage/presign-download",
    { preHandler: requireMerchant() },
    async (request, reply) => {
      if (!requireStorage(reply)) return reply;

      const query = keyQuery.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: query.error.issues[0]?.message });
      }

      const key = scopedKey(request.merchantAccess!.merchantId, query.data.key);
      if (!key) return invalidKey(reply);

      const url = await getStorage().presignDownload(key, {
        expiresIn: query.data.expiresIn,
        downloadName: query.data.downloadName,
      });

      return { key, url };
    },
  );

  app.get(
    "/api/storage/objects",
    { preHandler: requireMerchant() },
    async (request, reply) => {
      if (!requireStorage(reply)) return reply;

      const query = listQuery.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: query.error.issues[0]?.message });
      }

      const merchantId = request.merchantAccess!.merchantId;
      const prefix = scopedPrefix(merchantId, query.data.prefix);
      if (prefix === null) return invalidKey(reply);

      const objects = await getStorage().list(prefix, query.data.limit);
      return { prefix, objects };
    },
  );

  /**
   * Streams one object back through the API so that `<img src>` and other
   * same-origin consumers work without a fresh presigned URL on every render.
   * Keys are tenant-scoped and responses are private to the browser cache.
   */
  app.get(
    "/api/storage/objects/content",
    { preHandler: requireMerchant() },
    async (request, reply) => {
      if (!requireStorage(reply)) return reply;

      const query = keyQuery.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: query.error.issues[0]?.message });
      }

      const key = scopedKey(request.merchantAccess!.merchantId, query.data.key);
      if (!key) return invalidKey(reply);

      // A key can outlive its object when storage is pruned out of band, so a
      // missing file is a plain 404 rather than an error page in the console.
      if (!(await getStorage().head(key))) {
        return reply.code(404).send({ error: "Image not found." });
      }

      const object = await getStorage().get(key);

      return reply
        .header("content-type", object.contentType ?? "application/octet-stream")
        .header("content-length", object.size)
        .header("cache-control", "private, max-age=31536000, immutable")
        .send(object.body);
    },
  );

  app.put(
    "/api/storage/objects",
    { preHandler: requirePermission("catalogue") },
    async (request, reply) => {
      if (!requireStorage(reply)) return reply;

      const query = uploadPrefixQuery.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: query.error.issues[0]?.message });
      }

      const key = scopedKey(request.merchantAccess!.merchantId, query.data.key);
      if (!key) return invalidKey(reply);

      const body = request.body;
      if (!Buffer.isBuffer(body)) {
        return reply.code(415).send({
          error:
            "Send the file as application/octet-stream, or use " +
            "POST /api/storage/presign-upload for browser uploads.",
        });
      }

      const object = await getStorage().put(key, body, {
        contentType:
          query.data.contentType ?? request.headers["content-type"] ?? undefined,
      });

      return reply.code(201).send(object);
    },
  );

  app.delete(
    "/api/storage/objects",
    { preHandler: requirePermission("catalogue") },
    async (request, reply) => {
      if (!requireStorage(reply)) return reply;

      const query = keyQuery.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: query.error.issues[0]?.message });
      }

      const key = scopedKey(request.merchantAccess!.merchantId, query.data.key);
      if (!key) return invalidKey(reply);

      await getStorage().delete(key);
      return reply.code(204).send();
    },
  );
}

function merchantPrefix(merchantId: string): string {
  return `${merchantId}/`;
}

/**
 * Returns the key when it belongs to this merchant, otherwise null.
 * Rejects empty keys, parent-directory segments and other tenants' prefixes.
 */
function scopedKey(merchantId: string, raw: string): string | null {
  const key = raw.replace(/^\/+/, "");

  if (!key || key.includes("..") || key.includes("\0")) return null;
  if (!key.startsWith(merchantPrefix(merchantId))) return null;

  return key;
}

/** Listing prefix inside the merchant's own prefix; null when invalid. */
function scopedPrefix(merchantId: string, raw?: string): string | null {
  const base = merchantPrefix(merchantId);
  const extra = raw ? raw.replace(/^\/+/, "") : "";

  if (extra.includes("..") || extra.includes("\0")) return null;

  return `${base}${extra}`;
}

function safeSegment(value: string): string {
  return value
    .split("/")
    .map(slugify)
    .filter(Boolean)
    .join("/");
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);

  return slug || "file";
}

function dateFolder(): string {
  return new Date().toISOString().slice(0, 7);
}

function requireStorage(reply: FastifyReply): boolean {
  if (!isStorageConfigured()) {
    reply.code(503).send({
      error:
        "Object storage is not configured. Start RustFS and set S3_BUCKET, " +
        "S3_ACCESS_KEY and S3_SECRET_KEY.",
    });
    return false;
  }

  return true;
}

function invalidKey(reply: FastifyReply) {
  return reply.code(400).send({
    error: "The object key must stay inside the merchant's own storage prefix.",
  });
}
