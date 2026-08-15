// Shared image-upload limits, used by every route that accepts a photo
// (mobile avatar, mobile growth-log observations). Kept separate from
// cloudinary-server.ts on purpose: that module's uploadToCloudinary() only
// ever sees an already-buffered Buffer, with no access to the original
// File's size/type — this check MUST run on the File itself, before it's
// buffered into memory, or the memory-pressure problem it exists to prevent
// has already happened by the time it runs.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ImageValidationError = { error: string; status: number };

// Call this on the raw File from formData.get(...) BEFORE calling
// file.arrayBuffer() anywhere. Returns null when the file is acceptable.
// Presence is each caller's own concern (a missing file isn't a File at
// all); this checks type before size once a File is confirmed present.
export function validateImageFile(file: File): ImageValidationError | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      error: "Invalid image type. Use JPEG, PNG, or WebP.",
      status: 400,
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      error: `Image is too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)}MB).`,
      status: 400,
    };
  }
  return null;
}
