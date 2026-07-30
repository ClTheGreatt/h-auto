import "server-only";

import { prisma } from "@/lib/prisma";

export type AlertNotificationRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
};

const recipientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
} as const;

function compareRecipients(
  a: AlertNotificationRecipient,
  b: AlertNotificationRecipient
): number {
  return (
    a.lastName.localeCompare(b.lastName, "en") ||
    a.firstName.localeCompare(b.firstName, "en") ||
    a.id.localeCompare(b.id, "en")
  );
}

export async function getEligibleAlertRecipients(
  plotId: string
): Promise<AlertNotificationRecipient[]> {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    select: {
      adviser: {
        select: {
          ...recipientSelect,
          status: true,
          graduatedAt: true,
        },
      },
      assignments: {
        where: {
          status: "ACTIVE",
          endedAt: null,
          student: {
            role: "STUDENT_FARMER",
            status: "ACTIVE",
            graduatedAt: null,
          },
        },
        select: {
          student: { select: recipientSelect },
        },
      },
    },
  });

  if (!plot) return [];

  const recipients = new Map<string, AlertNotificationRecipient>();
  const adviser = plot.adviser;
  if (adviser?.status === "ACTIVE" && adviser.graduatedAt === null) {
    recipients.set(adviser.id, {
      id: adviser.id,
      firstName: adviser.firstName,
      lastName: adviser.lastName,
      email: adviser.email,
      phoneNumber: adviser.phoneNumber,
    });
  }

  const students = plot.assignments
    .map((assignment) => assignment.student)
    .sort(compareRecipients);
  for (const student of students) {
    if (!recipients.has(student.id)) {
      recipients.set(student.id, student);
    }
  }

  return Array.from(recipients.values());
}
