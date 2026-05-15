import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/sms/semaphore";
import { checkThresholds } from "./threshold-checker";

type Recipient = {
  id: string;
  firstName: string;
  lastName: string;
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
            include: {
              student: true,
              faculty: true,
            },
          },
        },
      },
    },
  });

  if (!reading || !reading.plot.currentStage) return;

  const violations = checkThresholds(reading, reading.plot.currentStage);

  // === Process new violations ===
  for (const v of violations) {
    // Skip if there's already an unresolved alert of the same type for this plot
    const existing = await prisma.alert.findFirst({
      where: {
        plotId: reading.plotId,
        type: v.type,
        resolved: false,
      },
    });
    if (existing) continue;

    // Create the alert
    const alert = await prisma.alert.create({
      data: {
        plotId: reading.plotId,
        readingId: reading.id,
        type: v.type,
        severity: v.severity,
        message: v.message,
      },
    });

    // Collect unique recipients (students + faculty from active assignments)
    const recipientMap = new Map<string, Recipient>();
    for (const a of reading.plot.assignments) {
      recipientMap.set(a.student.id, a.student);
      recipientMap.set(a.faculty.id, a.faculty);
    }

    // Send SMS to each recipient
    for (const user of recipientMap.values()) {
      const smsMessage = `H-Auto Alert (${v.severity}): ${reading.plot.name} - ${v.message}`;
      const result = await sendSMS(user.phoneNumber, smsMessage);

      await prisma.alertNotification.create({
        data: {
          alertId: alert.id,
          userId: user.id,
          channel: "SMS",
          status: result.success ? "SENT" : "FAILED",
          providerMessageId: result.messageId ?? null,
          errorMessage: result.error ?? null,
          sentAt: result.success ? new Date() : null,
        },
      });
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