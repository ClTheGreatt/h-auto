import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile-auth";

function isExpoPushToken(token: unknown): token is string {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken["))
  );
}

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { token, platform, deviceName } = body;

    if (!isExpoPushToken(token)) {
      return NextResponse.json({ error: "Invalid Expo push token" }, { status: 400 });
    }

    // Token ay globally unique — i-assign sa kasalukuyang user
    // (kaya kung ibang account mag-login sa parehong phone, lilipat ang token).
    await prisma.pushToken.upsert({
      where: { token },
      create: {
        token,
        userId: user.id,
        platform: typeof platform === "string" ? platform : null,
        deviceName: typeof deviceName === "string" ? deviceName : null,
      },
      update: {
        userId: user.id,
        platform: typeof platform === "string" ? platform : null,
        deviceName: typeof deviceName === "string" ? deviceName : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[mobile/me/push-token POST] error:", error);
    return NextResponse.json({ error: "Failed to register push token" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;

    if (isExpoPushToken(token)) {
      await prisma.pushToken.deleteMany({ where: { token, userId: user.id } });
    } else {
      await prisma.pushToken.deleteMany({ where: { userId: user.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[mobile/me/push-token DELETE] error:", error);
    return NextResponse.json({ error: "Failed to remove push token" }, { status: 500 });
  }
}