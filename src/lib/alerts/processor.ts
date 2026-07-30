import type { AlertSeverity, AlertType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/sms/semaphore";
import { sendEmail } from "@/lib/email/send-email";
import { sendExpoPush } from "@/lib/push/expo";
import {
  checkThresholds,
  getEvaluatedThresholdAlertTypes,
} from "./threshold-checker";
import { isWithinLightEvaluationWindow } from "./light-evaluation";
import { buildAlertSuggestion, type AlertSuggestion } from "./suggestions";
import {
  createOpenAlertIfAbsent,
  refreshOpenThresholdAlert,
} from "./open-alert";
import {
  getEligibleAlertRecipients,
  type AlertNotificationRecipient,
} from "./recipients";

export async function processSensorReading(
  readingId: string,
  {
    offlineRecoveryHandled = false,
  }: {
    offlineRecoveryHandled?: boolean;
  } = {}
) {
  const reading = await prisma.sensorReading.findUnique({
    where: { id: readingId },
    include: {
      plot: {
        include: {
          currentStage: true,
        },
      },
    },
  });

  if (!reading) return;

  // Normal sensor ingestion resolves this synchronously before responding.
  // Keep this idempotent fallback for other reading producers.
  if (!offlineRecoveryHandled) {
    await prisma.alert.updateMany({
      where: {
        plotId: reading.plotId,
        type: "DEVICE_OFFLINE",
        resolved: false,
      },
      data: { resolved: true, resolvedAt: new Date() },
    });
  }

  if (!reading.plot.currentStage) return;

  const thresholdEvaluationPolicy = {
    evaluateLight: isWithinLightEvaluationWindow(reading.recordedAt),
  };
  const violations = checkThresholds(
    reading,
    reading.plot.currentStage,
    thresholdEvaluationPolicy
  );

  // === Process new violations ===
  for (const v of violations) {
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

    const { alert, created } = await createOpenAlertIfAbsent({
      plotId: reading.plotId,
      type: v.type,
      data: {
        readingId: reading.id,
        severity: v.severity,
        message: v.message,
        suggestionTitle: suggestion?.title ?? null,
        suggestionSteps: suggestion?.steps ?? [],
      },
    });
    if (!created) {
      await refreshOpenThresholdAlert({
        alertId: alert.id,
        plotId: reading.plotId,
        type: v.type,
        incomingReadingId: reading.id,
        incomingRecordedAt: reading.recordedAt,
        severity: v.severity,
        message: v.message,
        suggestionTitle: suggestion?.title ?? null,
        suggestionSteps: suggestion?.steps ?? [],
      });
      continue;
    }

    const recipients = await getEligibleAlertRecipients(reading.plotId);
    await sendAlertNotifications(alert, recipients, {
      plotId: reading.plotId,
      plotName: reading.plot.name,
      alertType: v.type,
      severity: v.severity,
      message: v.message,
      suggestion,
    });
  }

  // === Auto-resolve alerts no longer violating ===
  const activeAlerts = await prisma.alert.findMany({
    where: { plotId: reading.plotId, resolved: false },
  });
  const evaluatedAlertTypes = getEvaluatedThresholdAlertTypes(
    reading,
    thresholdEvaluationPolicy
  );
  const stillViolatingTypes = new Set<AlertType>(
    violations.map((v) => v.type)
  );
  for (const alert of activeAlerts) {
    if (
      evaluatedAlertTypes.has(alert.type) &&
      !stillViolatingTypes.has(alert.type)
    ) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { resolved: true, resolvedAt: new Date() },
      });
    }
  }
}

// Sends the 4-channel notification set (IN_APP, SMS, EMAIL, PUSH) for one
// alert to a list of recipients. Shared by processSensorReading (threshold
// violations) and the focused device-offline scan.
export async function sendAlertNotifications(
  alert: { id: string },
  recipients: AlertNotificationRecipient[],
  content: {
    plotId: string;
    plotName: string;
    alertType: string;
    severity: AlertSeverity;
    message: string;
    suggestion: AlertSuggestion | null;
  }
) {
  const { plotId, plotName, alertType, severity, message, suggestion } = content;

  for (const user of recipients) {
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
      const smsMessage = `H-Auto Alert (${severity}): ${plotName} - ${message}`;
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
    const emailResult = await sendAlertEmail(user, plotName, severity, message);
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
        severity === "CRITICAL"
          ? "🔴 Critical"
          : severity === "WARNING"
          ? "🟡 Warning"
          : "🔵 Info";
      const pushResult = await sendExpoPush(
        tokens.map((t) => ({
          to: t.token,
          title: `${severityLabel} · ${plotName}`,
          body: `${message}${suggestion ? ` · ${suggestion.title}` : ""}`,
          sound: "default" as const,
          priority: "high" as const,
          data: { alertId: alert.id, plotId, type: alertType },
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

// Simple alert email (best-effort)
async function sendAlertEmail(
  user: AlertNotificationRecipient,
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
