import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSplCapture } from "../src/audio/splCaptureAnalysis.ts";

const tone = (amplitude = 0.1, count = 2048) =>
  Float32Array.from({ length: count }, (_, index) =>
    amplitude * Math.sin((2 * Math.PI * 1000 * index) / 48000));

const metadata = (overrides = {}) => ({
  sampleRateHz: 48000,
  weighting: "Z",
  weightingApplied: false,
  calibrationOffsetDb: 120,
  inputLabel: "USB measurement microphone",
  capturedAt: "2026-11-20T10:00:00.000Z",
  ...overrides,
});

test("converts PCM RMS to SPL only with a supplied calibration offset", () => {
  const result = analyzeSplCapture(tone(), metadata());
  assert.equal(result.status, "valid");
  assert.ok(result.rmsDbfs !== null);
  assert.ok(Math.abs(result.splDb - (result.rmsDbfs + 120)) < 1e-9);
});

test("keeps uncalibrated captures in dBFS and never labels them SPL", () => {
  const result = analyzeSplCapture(tone(), metadata({ calibrationOffsetDb: null }));
  assert.equal(result.status, "uncalibrated");
  assert.equal(result.splDb, null);
  assert.ok(result.warnings.some((warning) => warning.includes("dBFS")));
});

test("requires pre-weighted PCM for A and C weighting", () => {
  const result = analyzeSplCapture(tone(), metadata({
    weighting: "A",
    weightingApplied: false,
  }));
  assert.equal(result.status, "invalid");
  assert.equal(result.splDb, null);
});

test("withholds SPL when clipping exceeds the configured threshold", () => {
  const samples = tone();
  for (let index = 0; index < 8; index++) samples[index] = 1;
  const result = analyzeSplCapture(samples, metadata());
  assert.equal(result.status, "clipped");
  assert.equal(result.splDb, null);
  assert.ok(result.clippingRatio > 0.001);
});

test("rejects invalid sample rates, short buffers and non-finite samples", () => {
  assert.equal(analyzeSplCapture(tone(), metadata({ sampleRateHz: 1000 })).status, "invalid");
  assert.equal(analyzeSplCapture(new Float32Array(32), metadata()).status, "invalid");
  const samples = tone();
  samples[4] = Number.NaN;
  assert.equal(analyzeSplCapture(samples, metadata()).status, "invalid");
});

test("removes DC offset before computing RMS", () => {
  const samples = Float32Array.from(tone(), (sample) => sample + 0.2);
  const result = analyzeSplCapture(samples, metadata());
  const reference = analyzeSplCapture(tone(), metadata());
  assert.ok(Math.abs(result.rmsDbfs - reference.rmsDbfs) < 0.01);
});
