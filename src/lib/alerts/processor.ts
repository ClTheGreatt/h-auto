import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/sms/semaphore";
import { sendEmail } from "@/lib/email/send-email";
import { sendExpoPush } from "@/lib/push/expo";
import { checkThresholds } from "./threshold-checker";
import { buildAlertSuggestion, type AlertSuggestion } from "./suggestions";

type Recipient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
};

export async function processSensorReading(readingId: string) {
  const reading = await prisma.sensorReading.findUnique({
    where: { id: readingId },
    include: {
      plot: {
        include: {
          currentStage: true,
          assignments: {
            where: { status: "ACTIVE" },
            include: { student: true, faculty: true },
          },
        },
      },
    },
  });

  if (!reading) return;

  // A reading arrived → the device is alive, so clear any open offline alert
  await prisma.alert.updateMany({
    where: { plotId: reading.plotId, type: "DEVICE_OFFLINE", resolved: false },
    data: { resolved: true, resolvedAt: new Date() },
  });

  if (!reading.plot.currentStage) return;

  const violations = checkThresholds(reading, reading.plot.currentStage);

  // === Process new violations ===
  for (const v of violations) {
    // Skip if there's already an unresolved alert of the same type for this plot
    const existing = await prisma.alert.findFirst({
      where: { plotId: reading.plotId, type: v.type, resolved: false },
    });
    if (existing) continue;

    let suggestion: AlertSuggestion | null = null;
    try {
      suggestion = buildAlertSuggestion({
        type: v.type,
        currentValue: v.value,
        threshold: v.type.startsWith("LOW_") ? v.min : v.max,
      });
    } catch (err) {
      console.warn("[processSensorReading] suggestion builder failed:", err);
    }

    const alert = await prisma.alert.create({
      data: {
        plotId: reading.plotId,
        readingId: reading.id,
        type: v.type,
        severity: v.severity,
        message: v.message,
        suggestionTitle: suggestion?.title ?? null,
        suggestionSteps: suggestion?.steps ?? [],
      },
    });

    // Unique recipients (students + faculty from active assignments)
    const recipientMap = new Map<string, Recipient>();
    for (const a of reading.plot.assignments) {
      recipientMap.set(a.student.id, a.student);
      recipientMap.set(a.faculty.id, a.faculty);
    }

    for (const user of recipientMap.values()) {
      // 1) In-app — always recorded so it shows inside the app (no external service)
      await prisma.alertNotification.create({
        data: {
          alertId: alert.id,
          userId: user.id,
          channel: "IN_APP",
          status: "DELIVERED",
          sentAt: new Date(),
        },
      });

      // 2) SMS — only if the user has a phone number
      if (user.phoneNumber) {
        const smsMessage = `H-Auto Alert (${v.severity}): ${reading.plot.name} - ${v.message}`;
        const smsResult = await sendSMS(user.phoneNumber, smsMessage);
        await prisma.alertNotification.create({
          data: {
            alertId: alert.id,
            userId: user.id,
            channel: "SMS",
            status: smsResult.success ? "SENT" : "FAILED",
            providerMessageId: smsResult.messageId ?? null,
            errorMessage: smsResult.error ?? null,
            sentAt: smsResult.success ? new Date() : null,
          },
        });
      }

      // 3) Email — best-effort (works to anyone once the Resend domain is verified)
      const emailResult = await sendAlertEmail(
        user,
        reading.plot.name,
        v.severity,
        v.message
      );
      await prisma.alertNotification.create({
        data: {
          alertId: alert.id,
          userId: user.id,
          channel: "EMAIL",
          status: emailResult.success ? "SENT" : "FAILED",
          errorMessage: emailResult.error ?? null,
          sentAt: emailResult.success ? new Date() : null,
        },
      });

      // 4) Push — to all of this user's registered devices
      const tokens = await prisma.pushToken.findMany({
        where: { userId: user.id },
        select: { token: true },
      });
if (tokens.length > 0) {
        const severityLabel =
          v.severity === "CRITICAL"
            ? "🔴 Critical"
            : v.severity === "WARNING"
            ? "🟡 Warning"
            : "🔵 Info";
        const pushResult = await sendExpoPush(
          tokens.map((t) => ({
            to: t.token,
            title: `${severityLabel} · ${reading.plot.name}`,
            body: `${v.message}${suggestion ? ` · ${suggestion.title}` : ""}`,
            sound: "default" as const,
            priority: "high" as const,
            data: { alertId: alert.id, plotId: reading.plotId, type: v.type },
          }))
        );
        await prisma.alertNotification.create({
          data: {
            alertId: alert.id,
            userId: user.id,
            channel: "PUSH",
            status: pushResult.success ? "SENT" : "FAILED",
            errorMessage: pushResult.error ?? null,
            sentAt: pushResult.success ? new Date() : null,
          },
        });
      }
    }
  }

  // === Auto-resolve alerts no longer violating ===
  const activeAlerts = await prisma.alert.findMany({
    where: { plotId: reading.plotId, resolved: false },
  });
  const stillViolatingTypes = new Set(violations.map((v) => v.type));
  for (const alert of activeAlerts) {
    if (!stillViolatingTypes.has(alert.type)) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { resolved: true, resolvedAt: new Date() },
      });
    }
  }
}

// Simple alert email (best-effort)
async function sendAlertEmail(
  user: Recipient,
  plotName: string,
  severity: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = `H-Auto Alert (${severity}) - ${plotName}`;
    const text =
      `Hi ${user.firstName},\n\n` +
      `A new ${severity.toLowerCase()} alert was raised for ${plotName}:\n` +
      `${message}\n\n` +
      `Please check the plot when you can.\n\n- H-Auto`;
    const html =
      `<p>Hi ${user.firstName},</p>` +
      `<p>A new <strong>${severity.toLowerCase()}</strong> alert was raised for <strong>${plotName}</strong>:</p>` +
      `<p style="padding:12px;background:#f8fafc;border-left:3px solid #16a34a;">${message}</p>` +
      `<p>Please check the plot when you can.</p><p>- H-Auto</p>`;

    const result = await sendEmail({ to: user.email, subject, html, text });
    if ("error" in result) {
      return { success: false, error: String((result as { error?: unknown }).error) };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email failed",
    };
  }
}