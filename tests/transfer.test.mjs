import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTransfer,
  makeReferenceNoise,
  measurePcmCaptureQuality,
} from "../src/audio/transfer.ts";

test("PCM capture quality reports RMS, peak and clipping safely", () => {
  const samples = new Float32Array([0.5, -0.5, 1, -1]);
  const quality = measurePcmCaptureQuality(samples);
  assert.ok(quality);
  assert.equal(quality.clippedSamplePercent, 50);
  assert.ok(Math.abs(quality.peakDbfs) < 1e-9);
  assert.ok(quality.rmsDbfs < 0);
});

test("PCM capture quality rejects empty data and accounts for invalid samples", () => {
  assert.equal(measurePcmCaptureQuality(new Float32Array()), null);
  const samples = new Float32Array([Number.NaN, 0.5, -0.5, 0.25]);
  const quality = measurePcmCaptureQuality(samples);
  assert.ok(quality);
  assert.equal(quality.invalidSamplePercent, 25);
  assert.ok(Number.isFinite(quality.rmsDbfs));
});

test("transfer delay subtracts the known playback pre-roll", () => {
  const sampleRate = 8000;
  const reference = makeReferenceNoise(sampleRate, 2.5);
  // Neither offset is aligned to the old 16/32-sample coarse search grid.
  const preRollSamples = 1603;
  const pathDelaySamples = 83;
  const recorded = new Float32Array(preRollSamples + pathDelaySamples + reference.length);
  recorded.set(reference, preRollSamples + pathDelaySamples);

  const result = analyzeTransfer(
    reference,
    recorded,
    sampleRate,
    [],
    preRollSamples / sampleRate,
  );
  assert.ok(result);
  assert.ok(Math.abs(result.estimatedDelayMs - (pathDelaySamples / sampleRate * 1000)) < 1.5);
});

test("transfer analysis rejects an invalid pre-roll value", () => {
  const reference = makeReferenceNoise(8000, 2.5);
  const recorded = new Float32Array(reference.length + 500);
  recorded.set(reference, 100);
  assert.equal(analyzeTransfer(reference, recorded, 8000, [], Number.NaN), null);
});
