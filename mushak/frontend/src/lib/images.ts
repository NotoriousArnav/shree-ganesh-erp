/** Same-origin URL for an object-storage image, or null when unset. */
export function imageSrc(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/storage/objects/content?key=${encodeURIComponent(key)}`;
}

type StoredObject = {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
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
 * Uploads an image through the API and returns its key.
 *
 * The browser never talks to object storage directly, so the bucket needs no
 * CORS policy. Save the returned key on the product or merchant record.
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

  const params = new URLSearchParams({
    filename: file.name,
    contentType: file.type,
    prefix,
  });

  const response = await fetch(`/api/storage/uploads?${params}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/octet-stream" },
    body: file,
  });

  if (!response.ok) {
    let message = "The image upload failed. Try again.";
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (payload.error) message = String(payload.error);
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new Error(message);
  }

  const object = (await response.json()) as StoredObject;
  if (!object.key) {
    throw new Error("The upload finished without a storage key.");
  }

  return object.key;
}
