import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

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

export async function PATCH(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { firstName, middleName, lastName, phoneNumber } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    if (phoneNumber && !phoneNumber.match(/^[+\d\s\-()]+$/)) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: firstName.trim(),
        middleName: middleName?.trim() || null,
        lastName: lastName.trim(),
        phoneNumber: phoneNumber?.trim() || null,
      },
      select: USER_SELECT,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[mobile/me/profile PATCH] error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}