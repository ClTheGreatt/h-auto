// Server-side report media policy. Never fetch a stored URL without this check.
import resolveImage from "@react-pdf/image";
export const MAX_GROWTH_LOG_PHOTOS = 3;
export const MAX_GROWTH_REPORT_PHOTO_FETCHES = 48;
export const GROWTH_LOG_PHOTO_FETCH_CONCURRENCY = 4;
export const GROWTH_LOG_THUMBNAIL_MAX_BYTES = 1_500_000;
export const GROWTH_LOG_THUMBNAIL_TIMEOUT_MS = 5_000;

const DELIVERY_HOST = "res.cloudinary.com";
const THUMBNAIL_TRANSFORMATION = "c_limit,w_600,h_450,q_auto:good,f_jpg";
const THUMBNAIL_MAX_WIDTH = 600;
const THUMBNAIL_MAX_HEIGHT = 450;

export type GrowthLogPhotoEvidence = { src?: string; omittedFromPdfLimit?: boolean };

export function trustedCloudinaryUrl(
  input: string | undefined,
  cloudName: string | undefined = process.env.CLOUDINARY_CLOUD_NAME
): string | null {
  if (!input || !cloudName || !/^[a-z0-9_-]+$/i.test(cloudName)) return null;
  // Backslashes and encoded path separators can be interpreted differently by proxies.
  if (/\\|%(?:2f|5c|2e)/i.test(input)) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== DELIVERY_HOST ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.href !== input
  ) {
    return null;
  }

  const prefix = `/${cloudName}/image/upload/`;
  if (!url.pathname.startsWith(prefix)) return null;
  const deliveryPath = url.pathname.slice(prefix.length);
  // Both current web and mobile uploaders use these fixed project folders.
  if (!/^(?:v\d+\/)?h-auto\/(?:growth-logs|observations)\/(?:[a-z0-9_!~*'().-]+\/)*[a-z0-9_!~*'().-]+$/i.test(deliveryPath)) {
    return null;
  }
  return url.href;
}

export function selectGrowthLogPhotos(imageUrls: readonly string[], totalCount = imageUrls.length) {
  return {
    selected: imageUrls.slice(0, MAX_GROWTH_LOG_PHOTOS),
    remainingCount: Math.max(0, totalCount - MAX_GROWTH_LOG_PHOTOS),
    totalCount,
  };
}

export function cloudinaryThumbnailUrl(trustedUrl: string, cloudName: string): string {
  const prefix = `/${cloudName}/image/upload/`;
  const url = new URL(trustedUrl);
  url.pathname = url.pathname.replace(prefix, `${prefix}${THUMBNAIL_TRANSFORMATION}/`);
  return url.href;
}

function hasJpegSignature(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best-effort; a rejected image remains unavailable.
  }
}

export async function fetchGrowthLogPhoto(
  storedUrl: string | undefined,
  options: {
    cloudName?: string;
    fetcher?: typeof fetch;
    timeoutMs?: number;
    maxBytes?: number;
  } = {}
): Promise<GrowthLogPhotoEvidence> {
  const cloudName = options.cloudName ?? process.env.CLOUDINARY_CLOUD_NAME;
  const trustedUrl = trustedCloudinaryUrl(storedUrl, cloudName);
  if (!trustedUrl || !cloudName) return {};

  const thumbnailUrl = cloudinaryThumbnailUrl(trustedUrl, cloudName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? GROWTH_LOG_THUMBNAIL_TIMEOUT_MS);
  const maxBytes = options.maxBytes ?? GROWTH_LOG_THUMBNAIL_MAX_BYTES;
  try {
    const response = await (options.fetcher ?? fetch)(thumbnailUrl, {
      signal: controller.signal,
      redirect: "manual",
      cache: "no-store",
    });
    if (!response.ok || response.status >= 300 || !response.body) {
      await cancelResponseBody(response);
      return {};
    }
    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > maxBytes)) {
      await cancelResponseBody(response);
      return {};
    }
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "image/jpeg") {
      await cancelResponseBody(response);
      return {};
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    let fullyRead = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          fullyRead = true;
          break;
        }
        bytesRead += value.byteLength;
        if (bytesRead > maxBytes) {
          return {};
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      if (!fullyRead) {
        try {
          await reader.cancel();
        } catch {
          // Abort/overflow cleanup must not replace the unavailable result.
        }
      }
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks, bytesRead);
    if (!hasJpegSignature(bytes)) return {};
    // Use the PDF renderer's own image parser before embedding. A correct MIME
    // header and file signature alone do not guarantee a renderable image.
    const decoded = await resolveImage(bytes, { cache: false });
    if (
      !decoded ||
      decoded.format !== "jpeg" ||
      !Number.isFinite(decoded.width) ||
      !Number.isFinite(decoded.height) ||
      decoded.width <= 0 ||
      decoded.height <= 0 ||
      decoded.width > THUMBNAIL_MAX_WIDTH ||
      decoded.height > THUMBNAIL_MAX_HEIGHT
    ) {
      return {};
    }
    return { src: `data:image/jpeg;base64,${bytes.toString("base64")}` };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

export async function prepareGrowthLogPhotoEvidence(
  rows: readonly { imageCount: number; imageUrls?: readonly string[] }[],
  options: Parameters<typeof fetchGrowthLogPhoto>[1] = {}
): Promise<GrowthLogPhotoEvidence[][]> {
  const evidence = rows.map((row) => Array.from({ length: Math.min(row.imageCount, MAX_GROWTH_LOG_PHOTOS) }, () => ({} as GrowthLogPhotoEvidence)));
  const tasks: Array<{ rowIndex: number; photoIndex: number; url: string }> = [];
  for (const [rowIndex, row] of rows.entries()) {
    for (const [photoIndex, url] of selectGrowthLogPhotos(row.imageUrls ?? [], row.imageCount).selected.entries()) {
      if (tasks.length < MAX_GROWTH_REPORT_PHOTO_FETCHES) {
        tasks.push({ rowIndex, photoIndex, url });
      } else {
        evidence[rowIndex][photoIndex] = { omittedFromPdfLimit: true };
      }
    }
  }
  let nextTask = 0;
  await Promise.all(
    Array.from({ length: Math.min(GROWTH_LOG_PHOTO_FETCH_CONCURRENCY, tasks.length) }, async () => {
      while (nextTask < tasks.length) {
        const task = tasks[nextTask++];
        evidence[task.rowIndex][task.photoIndex] = await fetchGrowthLogPhoto(task.url, options);
      }
    })
  );
  return evidence;
}
