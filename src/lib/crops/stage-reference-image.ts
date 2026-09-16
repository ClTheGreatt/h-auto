import {
  ALLOWED_IMAGE_TYPES,
  type ImageValidationError,
} from "@/lib/upload-limits";
import { MAX_STAGE_REFERENCE_IMAGE_BYTES } from "./stage-reference-constants";

type ImageFile = Pick<File, "type" | "size" | "slice">;

const SIGNATURE_LENGTH = 12;

function detectedMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function validateStageReferenceImage(
  file: ImageFile
): Promise<ImageValidationError | null> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Invalid image type. Use JPEG, PNG, or WebP.", status: 400 };
  }
  if (file.size > MAX_STAGE_REFERENCE_IMAGE_BYTES) {
    return {
      error: `Image is too large (max ${MAX_STAGE_REFERENCE_IMAGE_BYTES / (1024 * 1024)}MB).`,
      status: 400,
    };
  }

  const bytes = new Uint8Array(await file.slice(0, SIGNATURE_LENGTH).arrayBuffer());
  if (detectedMimeType(bytes) !== file.type) {
    return { error: "The file contents do not match its image type.", status: 400 };
  }
  return null;
}
