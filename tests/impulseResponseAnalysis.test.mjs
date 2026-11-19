import test from "node:test";
import assert from "node:assert/strict";
import { analyzeImpulseResponse } from "../src/audio/impulseResponseAnalysis.ts";

function exponentialCapture({ rt60 = 1.2, sampleRateHz = 8000, noise = 1e-7, id = "ir-1" } = {}) {
  const length = sampleRateHz * 3;
  const samples = Array.from({ length }, (_, i) => {
    const t = i / sampleRateHz;
    const envelope = Math.exp((-6.907755278982137 / rt60) * t);
    // Deterministic low-level noise avoids a fabricated silence tail.
    const n = noise * Math.sin(i * 12.9898);
    return (i === 0 ? 0.5 : 0.5 * envelope) + n;
  });
  return { id, zone: "Main", position: "Seat 1", sampleRateHz,
    inputLabel: "USB measurement input", capturedAt: 1000, samples, noiseFloorDbfs: -135 };
}

test("derives EDT, T20 and T30 from a valid measured impulse response", () => {
  const result = analyzeImpulseResponse(exponentialCapture());
  assert.notEqual(result.metrics.edtSeconds, null);
  assert.notEqual(result.metrics.t20Seconds, null);
  assert.notEqual(result.metrics.t30Seconds, null);
  assert.ok(Math.abs(result.metrics.t20Seconds - 1.2) < 0.08);
  assert.equal(result.status, "ready");
});

test("blocks clipped PCM and withholds all RT metrics", () => {
  const capture = exponentialCapture();
  capture.samples[20] = 1;
  const result = analyzeImpulseResponse(capture);
  assert.equal(result.status, "blocked");
  assert.equal(result.metrics.t20Seconds, null);
  assert.ok(result.checks.some(c => c.id === "clipping" && c.status === "fail"));
});

test("blocks invalid sample rate and malformed samples", () => {
  const capture = exponentialCapture();
  capture.sampleRateHz = 4000;
  assert.equal(analyzeImpulseResponse(capture).status, "blocked");
  const malformed = exponentialCapture();
  malformed.samples[30] = Number.NaN;
  assert.equal(analyzeImpulseResponse(malformed).status, "blocked");
});

test("withholds T20/T30 when the declared noise floor cannot support the decay range", () => {
  const result = analyzeImpulseResponse(exponentialCapture({ noise: 1e-3 }));
  assert.equal(result.metrics.t20Seconds, null);
  assert.equal(result.metrics.t30Seconds, null);
  assert.equal(result.status, "review");
});

test("does not convert dBFS to dB SPL and records provenance", () => {
  const result = analyzeImpulseResponse(exponentialCapture());
  assert.equal(result.unit, "seconds");
  assert.equal(result.captureId, "ir-1");
  assert.ok(result.note.includes("dBFS không phải dB SPL"));
});
