import test from "node:test";
import assert from "node:assert/strict";
import { assessMultiSourceInput, multiSourceSynchronizationWarning } from "../src/audio/multiSourceDiagnostics.ts";

const cleanTrack = {
  requestedDeviceId: "selected-device",
  actualDeviceId: "selected-device",
  trackState: "live",
  sampleRate: 48000,
  channelCount: 1,
  latencySeconds: 0.012,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

test("confirms the requested input route and reports track metadata", () => {
  const result = assessMultiSourceInput(cleanTrack);
  assert.equal(result.routeState, "verified");
  assert.equal(result.trackState, "live");
  assert.equal(result.sampleRate, 48000);
  assert.equal(result.channelCount, 1);
  assert.equal(result.latencyMs, 12);
  assert.equal(result.warnings.length, 0);
});

test("rejects an actual device mismatch and does not claim the selected route", () => {
  const result = assessMultiSourceInput({ ...cleanTrack, actualDeviceId: "different-device" });
  assert.equal(result.routeState, "mismatch");
  assert.ok(result.warnings.some((warning) => warning.includes("không khớp")));
});

test("marks missing browser identity and metadata as unconfirmed", () => {
  const result = assessMultiSourceInput({
    ...cleanTrack,
    actualDeviceId: undefined,
    sampleRate: undefined,
    channelCount: undefined,
    echoCancellation: undefined,
    noiseSuppression: undefined,
    autoGainControl: undefined,
  });
  assert.equal(result.routeState, "unconfirmed");
  assert.equal(result.sampleRate, null);
  assert.equal(result.channelCount, null);
  assert.ok(result.warnings.length >= 4);
});

test("reports muted and ended tracks and automatic audio processing", () => {
  const muted = assessMultiSourceInput({
    ...cleanTrack,
    trackState: "muted",
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });
  assert.equal(muted.trackState, "muted");
  assert.equal(muted.processingFlags.length, 3);
  assert.ok(muted.warnings.some((warning) => warning.includes("mute")));
  assert.ok(muted.warnings.some((warning) => warning.includes("tự động")));

  const ended = assessMultiSourceInput({ ...cleanTrack, trackState: "ended" });
  assert.equal(ended.trackState, "ended");
  assert.ok(ended.warnings.some((warning) => warning.includes("kết thúc")));
});

test("never treats separately opened input streams as sample-synchronous", () => {
  const result = assessMultiSourceInput(cleanTrack);
  assert.equal(result.synchronization, "independent-stream-not-sample-synchronous");
  assert.match(multiSourceSynchronizationWarning(3), /không được xác nhận chung hardware clock/);
  assert.match(multiSourceSynchronizationWarning(0), /Chưa có nguồn/);
});
