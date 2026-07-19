import { NextRequest } from "next/server";
import { verifyMobileToken } from "./jwt";
import { prisma } from "./prisma";

export async function getMobileUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyMobileToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
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
      tokenVersion: true,
    },
  });

  if (!user || user.status !== "ACTIVE") return null;
  // Token superseded by a password change (or any other tokenVersion bump).
  if (user.tokenVersion !== payload.tokenVersion) return null;

  const { tokenVersion: _tokenVersion, ...userWithoutTokenVersion } = user;
  void _tokenVersion;
  return userWithoutTokenVersion;
}