import type { NotificationChannel, NotificationStatus } from "@prisma/client";

export type AlertNotificationDetail = {
  recipient: string;
  channel: NotificationChannel;
  status: NotificationStatus;
};

export type AlertReportRow = {
  createdAt: Date;
  plotName: string;
  type: string;
  severity: string;
  message: string;
  resolved: boolean;
  resolvedAt: Date | null;
  sentNotificationRecords: number;
  failedNotificationRecords: number;
  recipientUsers: number;
  notificationDetails: AlertNotificationDetail[];
};

type ScopedNotification = {
  userId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  user: { firstName: string; lastName: string };
};

export function summarizeAlertNotifications(
  notifications: readonly ScopedNotification[]
) {
  const userIds = new Set<string>();
  let sentNotificationRecords = 0;
  let failedNotificationRecords = 0;
  const notificationDetails: AlertNotificationDetail[] = [];

  for (const notification of notifications) {
    userIds.add(notification.userId);
    if (notification.status === "SENT") sentNotificationRecords++;
    if (notification.status === "FAILED") failedNotificationRecords++;
    notificationDetails.push({
      recipient: `${notification.user.firstName} ${notification.user.lastName}`,
      channel: notification.channel,
      status: notification.status,
    });
  }

  return {
    sentNotificationRecords,
    failedNotificationRecords,
    recipientUsers: userIds.size,
    notificationDetails,
  };
}
