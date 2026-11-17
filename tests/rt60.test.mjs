import test from "node:test";
import assert from "node:assert/strict";
import { analyzeImpulseResponse, createLogSweep } from "../src/audio/rt60.ts";

test("creates a finite logarithmic sweep at a supported sample rate", () => {
  const sweep = createLogSweep(48000, 2, 30, 18000, 0.1);
  assert.equal(sweep.length, 96000);
  assert.ok(sweep.every(Number.isFinite));
  assert.ok(Math.max(...sweep.slice(100, 1000).map(Math.abs)) <= 0.1);
});

test("rejects invalid sweep parameters before allocating PCM", () => {
  assert.throws(() => createLogSweep(Number.NaN));
  assert.throws(() => createLogSweep(48000, 0.1));
  assert.throws(() => createLogSweep(48000, 31));
  assert.throws(() => createLogSweep(48000, 2, 18000, 1000));
  assert.throws(() => createLogSweep(48000, 2, 30, 18000, 1.2));
  assert.throws(() => createLogSweep(8000, 2, 30, 18000));
});

test("rejects unsupported sample rates and malformed impulse-response PCM", () => {
  const reference = new Float32Array(8192).fill(0.1);
  const recorded = new Float32Array(16384).fill(0.05);
  assert.equal(analyzeImpulseResponse(reference, recorded, 0), null);
  assert.equal(analyzeImpulseResponse(reference, recorded, Number.NaN), null);
  const corrupt = new Float32Array(recorded);
  corrupt[100] = Number.NaN;
  assert.equal(analyzeImpulseResponse(reference, corrupt, 48000), null);
  assert.equal(analyzeImpulseResponse(reference, recorded, 48000), null);
});

test("rejects short or non-Float32 capture buffers", () => {
  assert.equal(analyzeImpulseResponse(new Float32Array(100), new Float32Array(1000), 48000), null);
  assert.equal(analyzeImpulseResponse([], new Float32Array(2048), 48000), null);
});
