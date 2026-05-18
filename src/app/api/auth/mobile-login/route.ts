import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/jwt";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
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
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
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
      },
      "30d"
    );

    // Strip passwordHash before returning
    const { passwordHash: _, ...userSafe } = user;
    void _;

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
