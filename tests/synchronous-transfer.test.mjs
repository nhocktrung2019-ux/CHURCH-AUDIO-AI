import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSynchronousTransfer } from "../src/audio/transfer.ts";

function makeNoise(length, seed = 0x12345678) {
  const output = new Float32Array(length);
  let state = seed >>> 0;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    output[i] = ((state >>> 0) / 0xffffffff) * 2 - 1;
  }
  return output;
}

test("synchronous H1 keeps common-clock delay and recovers known gain", () => {
  const sampleRate = 16000;
  const reference = makeNoise(20000);
  const expectedDelaySamples = 37;
  const measurement = new Float32Array(reference.length);
  for (let i = expectedDelaySamples; i < measurement.length; i++) {
    measurement[i] = reference[i - expectedDelaySamples] * 0.5;
  }

  const result = analyzeSynchronousTransfer(reference, measurement, sampleRate);
  assert.ok(result);
  assert.equal(result.analysisMode, "synchronous-dual-channel");
  assert.ok(Math.abs(result.estimatedDelayMs - expectedDelaySamples / sampleRate * 1000) < 0.06);
  assert.ok(result.confidence > 0.9);
  assert.ok(result.framesAveraged >= 6);
  assert.ok(result.averageCoherence > 0.95);

  const inBand = result.points.filter(point => point.frequencyHz >= 500 && point.frequencyHz <= 4000);
  const meanMagnitudeDb = inBand.reduce((sum, point) => sum + point.magnitudeDb, 0) / inBand.length;
  assert.ok(Math.abs(meanMagnitudeDb - (-6.0206)) < 0.5);
});

test("synchronous H1 preserves the measured phase slope instead of time-aligning it away", () => {
  const sampleRate = 16000;
  const reference = makeNoise(20000, 0x3456789a);
  const delaySamples = 37;
  const measurement = new Float32Array(reference.length);
  for (let i = delaySamples; i < measurement.length; i++) {
    measurement[i] = reference[i - delaySamples];
  }
  const result = analyzeSynchronousTransfer(reference, measurement, sampleRate);
  assert.ok(result);
  const point = result.points.reduce((best, candidate) =>
    Math.abs(candidate.frequencyHz - 1000) < Math.abs(best.frequencyHz - 1000) ? candidate : best,
  );
  const expectedPhase = -360 * point.frequencyHz * delaySamples / sampleRate;
  const wrappedError = ((point.phaseDeg - expectedPhase + 180) % 360 + 360) % 360 - 180;
  assert.ok(Math.abs(wrappedError) < 3);
});

test("synchronous H1 rejects silence, unrelated channels and invalid frame pairs", () => {
  const silence = new Float32Array(20000);
  assert.equal(analyzeSynchronousTransfer(silence, silence, 16000), null);
  assert.equal(analyzeSynchronousTransfer(new Float32Array(10000), new Float32Array(12000), 16000), null);
  assert.equal(analyzeSynchronousTransfer(new Float32Array(10000), new Float32Array(10000), 16000), null);
  assert.equal(analyzeSynchronousTransfer(makeNoise(20000, 1), makeNoise(20000, 2), 16000), null);
});

test("synchronous H1 applies measurement microphone calibration only to magnitude", () => {
  const sampleRate = 16000;
  const reference = makeNoise(20000, 0x778899aa);
  const measurement = new Float32Array(reference.length);
  for (let i = 0; i < reference.length; i++) measurement[i] = reference[i] * 0.5;
  const result = analyzeSynchronousTransfer(reference, measurement, sampleRate, [
    { frequencyHz: 50, correctionDb: 0 },
    { frequencyHz: 1000, correctionDb: 3 },
    { frequencyHz: 12000, correctionDb: 0 },
  ]);
  assert.ok(result);
  const bin = result.points.reduce((best, point) =>
    Math.abs(point.frequencyHz - 1000) < Math.abs(best.frequencyHz - 1000) ? point : best,
  );
  assert.ok(Math.abs(bin.magnitudeDb - (-3.0206)) < 0.6);
});
