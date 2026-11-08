import { api } from "@/lib/api";

/** Same-origin URL for an object-storage image, or null when unset. */
export function imageSrc(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/storage/objects/content?key=${encodeURIComponent(key)}`;
}

type PresignedUpload = {
  key: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

const allowedTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
];

const maxBytes = 5 * 1024 * 1024;

/**
 * Uploads an image straight to object storage and returns its key.
 *
 * The API only signs the PUT, so bytes never pass through the backend. Save the
 * returned key on the product or merchant record.
 */
export async function uploadImage(
  file: File,
  prefix = "images",
): Promise<string> {
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Choose a PNG, JPEG, WebP, GIF or AVIF image.");
  }

  if (file.size > maxBytes) {
    throw new Error("Keep the image under 5 MB.");
  }

  const presigned = await api<PresignedUpload>("/api/storage/presign-upload", {
    method: "POST",
    body: {
      filename: file.name,
      contentType: file.type,
      prefix,
    },
  });

  const response = await fetch(presigned.url, {
    method: presigned.method,
    headers: presigned.headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error("The image upload failed. Try again.");
  }

  return presigned.key;
}
