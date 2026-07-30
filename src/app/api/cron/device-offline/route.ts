import { NextRequest, NextResponse } from "next/server";
import { scanOfflineDevices } from "@/lib/alerts/device-offline";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const summary = await scanOfflineDevices({
      now,
      sendNotifications: true,
    });

    return NextResponse.json({
      ok: summary.failures === 0,
      ranAt: now.toISOString(),
      summary,
    });
  } catch (error) {
    console.error("[cron/device-offline] scan could not start", {
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    });
    return NextResponse.json(
      { ok: false, error: "Offline-device scan could not start" },
      { status: 500 }
    );
  }
}
