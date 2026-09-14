import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCurrentSensorEvidence,
  isHistoricalSensorEvidence,
} from "./reading-evidence";

const fresh = { state: "FRESH", elapsedMs: 1_000 } as const;
const delayed = { state: "STALE", elapsedMs: 16 * 60 * 1_000 } as const;
const offline = { state: "OFFLINE", elapsedMs: 61 * 60 * 1_000 } as const;

test("a fresh reading from the linked device is current evidence", () => {
  assert.equal(
    isCurrentSensorEvidence({
      readingDeviceId: "device-1",
      linkedDeviceId: "device-1",
      readingFreshness: fresh,
      deviceFreshness: fresh,
      devicePaused: false,
    }),
    true
  );
});

test("a fresh reading from a delayed current device is historical", () => {
  const currentEvidence = isCurrentSensorEvidence({
    readingDeviceId: "device-1",
    linkedDeviceId: "device-1",
    readingFreshness: fresh,
    deviceFreshness: delayed,
    devicePaused: false,
  });

  assert.equal(currentEvidence, false);
  assert.equal(
    isHistoricalSensorEvidence({
      readingRecordedAt: new Date(),
      currentEvidence,
      devicePaused: false,
    }),
    true
  );
});

test("a fresh reading from an offline current device is historical", () => {
  const currentEvidence = isCurrentSensorEvidence({
    readingDeviceId: "device-1",
    linkedDeviceId: "device-1",
    readingFreshness: fresh,
    deviceFreshness: offline,
    devicePaused: false,
  });

  assert.equal(currentEvidence, false);
  assert.equal(
    isHistoricalSensorEvidence({
      readingRecordedAt: new Date(),
      currentEvidence,
      devicePaused: false,
    }),
    true
  );
});

test("an old target-plot reading from another device is historical", () => {
  const currentEvidence = isCurrentSensorEvidence({
    readingDeviceId: "old-device",
    linkedDeviceId: "new-device",
    readingFreshness: fresh,
    deviceFreshness: fresh,
    devicePaused: false,
  });

  assert.equal(currentEvidence, false);
  assert.equal(
    isHistoricalSensorEvidence({
      readingRecordedAt: new Date(),
      currentEvidence,
      devicePaused: false,
    }),
    true
  );
});

test("a retained source-plot reading is historical after its device leaves", () => {
  const currentEvidence = isCurrentSensorEvidence({
    readingDeviceId: "device-1",
    linkedDeviceId: null,
    readingFreshness: fresh,
    deviceFreshness: fresh,
    devicePaused: false,
  });

  assert.equal(currentEvidence, false);
  assert.equal(
    isHistoricalSensorEvidence({
      readingRecordedAt: new Date(),
      currentEvidence,
      devicePaused: false,
    }),
    true
  );
});

test("a fresh heartbeat cannot make a stale reading current", () => {
  const currentEvidence = isCurrentSensorEvidence({
    readingDeviceId: "device-1",
    linkedDeviceId: "device-1",
    readingFreshness: delayed,
    deviceFreshness: fresh,
    devicePaused: false,
  });

  assert.equal(currentEvidence, false);
  assert.equal(
    isHistoricalSensorEvidence({
      readingRecordedAt: new Date(),
      currentEvidence,
      devicePaused: false,
    }),
    true
  );
});

test("powered-off sensor evidence is presented as historical", () => {
  const currentEvidence = isCurrentSensorEvidence({
    readingDeviceId: "device-1",
    linkedDeviceId: "device-1",
    readingFreshness: fresh,
    deviceFreshness: fresh,
    devicePaused: true,
  });

  assert.equal(currentEvidence, false);
  assert.equal(
    isHistoricalSensorEvidence({
      readingRecordedAt: new Date(),
      currentEvidence,
      devicePaused: true,
    }),
    true
  );
});

test("both fresh current signals permit active threshold presentation", () => {
  const currentEvidence = isCurrentSensorEvidence({
    readingDeviceId: "device-1",
    linkedDeviceId: "device-1",
    readingFreshness: fresh,
    deviceFreshness: fresh,
    devicePaused: false,
  });

  assert.equal(currentEvidence, true);
  assert.equal(
    isHistoricalSensorEvidence({
      readingRecordedAt: new Date(),
      currentEvidence,
      devicePaused: false,
    }),
    false
  );
});
