import type {
  NotificationChannel,
  NotificationStatus,
} from "@prisma/client";

export type NotificationSummaryRow = {
  userId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  user: { phoneNumber: string | null };
};

export type NotificationSummary = {
  recipientCount: number;
  smsAttemptCount: number;
  smsSentCount: number;
  smsDeliveredCount: number;
  smsFailedCount: number;
  smsPendingCount: number;
  withoutPhoneCount: number;
};

export function summarizeAlertNotifications(
  notifications: NotificationSummaryRow[]
): NotificationSummary {
  const recipientIds = new Set<string>();
  const usersWithPhone = new Set<string>();
  const smsStatusesByUser = new Map<string, Set<NotificationStatus>>();

  for (const notification of notifications) {
    recipientIds.add(notification.userId);
    if (notification.user.phoneNumber) {
      usersWithPhone.add(notification.userId);
    }

    if (notification.channel === "SMS") {
      let statuses = smsStatusesByUser.get(notification.userId);
      if (!statuses) {
        statuses = new Set<NotificationStatus>();
        smsStatusesByUser.set(notification.userId, statuses);
      }
      statuses.add(notification.status);
    }
  }

  let smsSentCount = 0;
  let smsDeliveredCount = 0;
  let smsFailedCount = 0;
  let smsPendingCount = 0;

  for (const statuses of smsStatusesByUser.values()) {
    if (statuses.has("DELIVERED")) {
      smsDeliveredCount++;
    } else if (statuses.has("SENT")) {
      smsSentCount++;
    } else if (statuses.has("FAILED")) {
      smsFailedCount++;
    } else {
      smsPendingCount++;
    }
  }

  return {
    recipientCount: recipientIds.size,
    smsAttemptCount: smsStatusesByUser.size,
    smsSentCount,
    smsDeliveredCount,
    smsFailedCount,
    smsPendingCount,
    withoutPhoneCount: Array.from(recipientIds).filter(
      (userId) => !usersWithPhone.has(userId)
    ).length,
  };
}

function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatNotificationSummary(
  notifications: NotificationSummaryRow[]
): string {
  if (notifications.length === 0) {
    return "No notification records were created";
  }

  const summary = summarizeAlertNotifications(notifications);
  const parts = [countLabel(summary.recipientCount, "recipient")];

  if (summary.smsAttemptCount === 0) {
    if (summary.withoutPhoneCount === summary.recipientCount) {
      parts.push("No phone numbers available");
    } else {
      parts.push("No SMS attempt recorded");
      if (summary.withoutPhoneCount > 0) {
        parts.push(
          countLabel(summary.withoutPhoneCount, "without phone", "without phone")
        );
      }
    }
    return parts.join(" · ");
  }

  const smsParts: string[] = [];
  if (summary.smsDeliveredCount > 0) {
    smsParts.push(countLabel(summary.smsDeliveredCount, "delivered", "delivered"));
  }
  if (summary.smsSentCount > 0) {
    smsParts.push(countLabel(summary.smsSentCount, "sent", "sent"));
  }
  if (summary.smsFailedCount > 0) {
    smsParts.push(countLabel(summary.smsFailedCount, "failed", "failed"));
  }
  if (summary.smsPendingCount > 0) {
    smsParts.push(countLabel(summary.smsPendingCount, "pending", "pending"));
  }
  parts.push(`SMS: ${smsParts.join(" · ")}`);

  if (summary.withoutPhoneCount > 0) {
    parts.push(
      countLabel(summary.withoutPhoneCount, "without phone", "without phone")
    );
  }

  return parts.join(" · ");
}
