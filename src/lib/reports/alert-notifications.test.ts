import assert from "node:assert/strict";
import { test } from "node:test";
import type { NotificationChannel, NotificationStatus } from "@prisma/client";
import { summarizeAlertNotifications } from "./alert-notifications";

function row(
  userId: string,
  channel: NotificationChannel,
  status: NotificationStatus,
  firstName = "Aaron",
  lastName = "Alfonso"
) {
  return { userId, channel, status, user: { firstName, lastName } };
}

test("one user across channels and repeated attempts counts once but retains every record", () => {
  const result = summarizeAlertNotifications([
    row("user-a", "SMS", "SENT"),
    row("user-a", "EMAIL", "SENT"),
    row("user-a", "PUSH", "FAILED"),
    row("user-a", "SMS", "FAILED"),
  ]);
  assert.equal(result.recipientUsers, 1);
  assert.equal(result.sentNotificationRecords, 2);
  assert.equal(result.failedNotificationRecords, 2);
  assert.deepEqual(result.notificationDetails.map((item) => item.channel), [
    "SMS", "EMAIL", "PUSH", "SMS",
  ]);
});

test("different user IDs with identical names remain two recipient users", () => {
  const result = summarizeAlertNotifications([
    row("user-a", "SMS", "SENT"),
    row("user-b", "EMAIL", "SENT"),
  ]);
  assert.equal(result.recipientUsers, 2);
  assert.deepEqual(result.notificationDetails.map((item) => item.recipient), [
    "Aaron Alfonso", "Aaron Alfonso",
  ]);
});

test("zero rows and one row keep factual zero and one counts", () => {
  assert.deepEqual(summarizeAlertNotifications([]), {
    sentNotificationRecords: 0,
    failedNotificationRecords: 0,
    recipientUsers: 0,
    notificationDetails: [],
  });
  const single = summarizeAlertNotifications([row("user-a", "IN_APP", "DELIVERED")]);
  assert.equal(single.recipientUsers, 1);
  assert.equal(single.sentNotificationRecords, 0);
  assert.equal(single.failedNotificationRecords, 0);
});

test("SENT and FAILED are row-based across channels; PENDING and DELIVERED are excluded", () => {
  const result = summarizeAlertNotifications([
    row("user-a", "SMS", "SENT"),
    row("user-a", "EMAIL", "FAILED"),
    row("user-b", "PUSH", "SENT"),
    row("user-c", "IN_APP", "DELIVERED"),
    row("user-d", "SMS", "PENDING"),
  ]);
  assert.equal(result.sentNotificationRecords, 2);
  assert.equal(result.failedNotificationRecords, 1);
  assert.equal(result.recipientUsers, 4);
  assert.deepEqual(result.notificationDetails.map((item) => item.status), [
    "SENT", "FAILED", "SENT", "DELIVERED", "PENDING",
  ]);
});

test("many notification rows retain distinct user counts without shortening detail", () => {
  const rows = Array.from({ length: 25 }, (_, index) => [
    row(`user-${index}`, "SMS", "SENT"),
    row(`user-${index}`, "EMAIL", "FAILED"),
  ]).flat();
  const result = summarizeAlertNotifications(rows);
  assert.equal(result.recipientUsers, 25);
  assert.equal(result.sentNotificationRecords, 25);
  assert.equal(result.failedNotificationRecords, 25);
  assert.equal(result.notificationDetails.length, 50);
});
