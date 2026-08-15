import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";
import { uploadToCloudinary } from "@/lib/cloudinary-server";
import { validateImageFile } from "@/lib/upload-limits";

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  middleName: true,
  lastName: true,
  phoneNumber: true,
  role: true,
  status: true,
  idNumber: true,
  department: true,
  course: true,
  yearLevel: true,
  section: true,
  position: true,
  profileImage: true,
};

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;

    if (!image || image.size === 0) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const validationError = validateImageFile(image);
    if (validationError) {
      return NextResponse.json(
        { error: validationError.error },
        { status: validationError.status }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const { url } = await uploadToCloudinary(buffer, "h-auto/avatars");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { profileImage: url },
      select: USER_SELECT,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[mobile/me/avatar] error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

// Clears the AUTHENTICATED user's own avatar. Never accepts a userId from
// the request — always scoped to getMobileUser(req)'s id. Cloudinary asset
// is intentionally not deleted here (see AVATAR-1 batch report).
export async function DELETE(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { profileImage: null },
      select: USER_SELECT,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[mobile/me/avatar] error:", error);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 }
    );
  }
}