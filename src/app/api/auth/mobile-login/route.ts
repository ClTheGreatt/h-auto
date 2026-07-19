import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/jwt";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// Fixed dummy hash to equalize response time when the user doesn't exist.
// Prevents timing-based user enumeration (bcrypt.compare always runs).
const DUMMY_BCRYPT_HASH =
  "$2b$10$abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz012345";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Validate input
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email or password format" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Trim only — email casing as entered by an admin (or at signup) is
    // preserved in the DB, so the lookup must be case-insensitive rather
    // than forcing lowercase on the input.
    const emailInput = email.trim();

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: emailInput,
          mode: "insensitive",
        },
      },
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
        passwordHash: true,
        tokenVersion: true,
      },
    });

    // Always run bcrypt.compare, even when the user doesn't exist, so the
    // response time doesn't reveal whether the email is registered.
    const valid = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_BCRYPT_HASH
    );

    if (!user || !valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check account status
    if (user.status !== "ACTIVE") {
      const message =
        user.status === "SUSPENDED"
          ? "Your account has been suspended. Please contact an administrator."
          : "Your account is inactive. Please contact an administrator.";
      return NextResponse.json({ error: message }, { status: 403 });
    }

    // Update lastLoginAt best-effort; don't fail login if this fails.
    void prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch((err) => {
        console.error("[mobile-login] failed to update lastLoginAt:", err);
      });

    // Generate JWT with a 30 day expiry.
    const token = signMobileToken(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      "30d"
    );

    // Strip passwordHash and tokenVersion before returning
    const { passwordHash: _, tokenVersion: __, ...userSafe } = user;
    void _;
    void __;

    return NextResponse.json({
      user: userSafe,
      token,
    });
  } catch (error) {
    console.error("[mobile-login] error:", error);
    return NextResponse.json(
      { error: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
