import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLiveSplCapture } from "../src/audio/liveSplCapture.ts";

const input = (overrides = {}) => ({
  running: true,
  weightedDbfs: -35,
  calibrationOffsetDb: 120,
  peakDbfs: -6,
  ...overrides,
});

test("converts weighted dBFS only with an active calibrated microphone", () => {
  assert.deepEqual(analyzeLiveSplCapture(input()), { status: "valid", splDb: 85 });
});

test("does not label stopped or uncalibrated input as SPL", () => {
  assert.deepEqual(analyzeLiveSplCapture(input({ running: false })), { status: "stopped", splDb: null });
  assert.deepEqual(analyzeLiveSplCapture(input({ calibrationOffsetDb: 0 })), { status: "uncalibrated", splDb: null });
});

test("withholds SPL for clipping and invalid peak metadata", () => {
  assert.equal(analyzeLiveSplCapture(input({ peakDbfs: -0.05 })).status, "clipped");
  assert.equal(analyzeLiveSplCapture(input({ peakDbfs: Number.NaN })).status, "clipped");
});

test("rejects silent, non-finite, over-range and impossible SPL values", () => {
  assert.equal(analyzeLiveSplCapture(input({ weightedDbfs: -100 })).status, "invalid");
  assert.equal(analyzeLiveSplCapture(input({ weightedDbfs: Number.NaN })).status, "invalid");
  assert.equal(analyzeLiveSplCapture(input({ calibrationOffsetDb: 200 })).status, "invalid");
});

test("accepts a valid zero-dBFS peak margin only below the configured guard", () => {
  assert.equal(analyzeLiveSplCapture(input({ peakDbfs: -0.1 })).status, "clipped");
  assert.equal(analyzeLiveSplCapture(input({ peakDbfs: -0.11 })).status, "valid");
});
