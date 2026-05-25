import { v2 as cloudinary } from "cloudinary";

let configured = false;

function getCloudinary() {
  if (!configured) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary environment variables are not configured");
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    configured = true;
  }

  return cloudinary;
}

export async function uploadImageToCloudinary(
  file: File,
  folder: string = "h-auto/growth-logs"
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await getCloudinary().uploader.upload(base64, {
   folder,
      resource_type: "image",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });

    return { success: true, url: result.secure_url };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}
