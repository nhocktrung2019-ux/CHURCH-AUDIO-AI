import test from "node:test";
import assert from "node:assert/strict";
import {
  assessSessionCompatibility,
  createCaptureContext,
  createMeasurementSession,
} from "../src/audio/measurementSession.ts";

test("creates validated session identity and stamps captures with shared room/session", () => {
  const startedAt = new Date("2026-11-24T10:00:00.000Z");
  const session = createMeasurementSession("Sunday service survey", "SANCTUARY", startedAt);
  assert.equal(session.schemaVersion, 1);
  assert.match(session.sessionId, /^ca-/);
  assert.equal(session.startedAt, startedAt.toISOString());
  const rt60 = createCaptureContext(session, { inputDeviceId: "usb-mic-1" }, startedAt);
  const transfer = createCaptureContext(session, { inputDeviceId: "usb-mic-1", outputDeviceId: "usb-out-1" }, startedAt);
  assert.equal(rt60.sessionId, transfer.sessionId);
  assert.equal(rt60.roomId, "SANCTUARY");
  assert.equal(assessSessionCompatibility([rt60, transfer]).compatible, true);
});

test("refuses to combine captures from separate sessions or without session metadata", () => {
  const a = createMeasurementSession("Survey A", "SANCTUARY", new Date("2026-11-24T10:00:00.000Z"));
  const b = createMeasurementSession("Survey B", "SANCTUARY", new Date("2026-11-24T11:00:00.000Z"));
  const ca = createCaptureContext(a);
  const cb = createCaptureContext(b);
  assert.equal(assessSessionCompatibility([ca, cb]).compatible, false);
  assert.equal(assessSessionCompatibility([ca, createCaptureContext(null)]).compatible, false);
  assert.equal(assessSessionCompatibility([ca, null]).compatible, false);
});

test("validates required session and room labels", () => {
  assert.throws(() => createMeasurementSession(" ", "SANCTUARY"), /Tên phiên đo/);
  assert.throws(() => createMeasurementSession("Survey", " "), /Mã phòng/);
});
