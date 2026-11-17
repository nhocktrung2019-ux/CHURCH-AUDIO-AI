import test from "node:test";
import assert from "node:assert/strict";
import {
  comparePhaseInBand,
  estimateRelativeDelayFromPhase,
  wrapPhaseDegrees,
} from "../src/audio/phaseAlignment.ts";

function transferPoints(phaseDeg, coherence = 0.95, magnitudeDb = 0) {
  const points = [];
  for (let frequencyHz = 800; frequencyHz <= 1200; frequencyHz += 50) {
    points.push({ frequencyHz, phaseDeg, coherence, magnitudeDb });
  }
  return points;
}

test("phase wrapping keeps values around plus/minus 180 degrees together", () => {
  assert.equal(wrapPhaseDegrees(541), -179);
  const comparison = comparePhaseInBand(
    transferPoints(0),
    transferPoints(179),
    1000,
  );
  assert.ok(comparison.meanPhaseDeg !== null);
  assert.ok(Math.abs(Math.abs(comparison.meanPhaseDeg) - 179) < 0.01);
  assert.ok(comparison.phaseConcentration > 0.99);
});

test("a near-opposite phase is flagged as a polarity candidate, not auto-corrected", () => {
  const comparison = comparePhaseInBand(
    transferPoints(0),
    transferPoints(180),
    1000,
  );
  assert.match(comparison.interpretation, /polarity/i);
  assert.ok(Math.abs(Math.abs(comparison.meanPhaseDeg) - 180) < 0.01);
});

test("low-coherence points are excluded from A/B phase comparison", () => {
  const comparison = comparePhaseInBand(
    transferPoints(0),
    transferPoints(90, 0.4),
    1000,
  );
  assert.equal(comparison.count, 0);
  assert.equal(comparison.meanPhaseDeg, null);
});

test("absolute delay is blocked without every synchronous measurement requirement", () => {
  const phase = Array.from({ length: 20 }, (_, index) => ({
    frequencyHz: 500 + index * 50,
    phaseDeg: 20 - 360 * (500 + index * 50) * 0.002,
    coherence: 0.96,
  }));
  const estimate = estimateRelativeDelayFromPhase(phase, {
    simultaneousCapture: true,
    sharedHardwareClock: true,
    perChannelCalibration: true,
    latencyCharacterized: false,
  });
  assert.equal(estimate.ready, false);
  assert.equal(estimate.delayMs, null);
  assert.match(estimate.reason, /latency/i);
});

test("a linear unwrapped phase difference estimates delay only with full sync evidence", () => {
  const phase = Array.from({ length: 30 }, (_, index) => ({
    frequencyHz: 400 + index * 50,
    phaseDeg: 37 - 360 * (400 + index * 50) * 0.0025,
    coherence: 0.96,
  }));
  const estimate = estimateRelativeDelayFromPhase(phase, {
    simultaneousCapture: true,
    sharedHardwareClock: true,
    perChannelCalibration: true,
    latencyCharacterized: true,
  });
  assert.equal(estimate.ready, true);
  assert.ok(Math.abs(estimate.delayMs - 2.5) < 1e-9);
  assert.ok(estimate.rSquared > 0.999);
});

test("non-linear phase data cannot produce a confident delay estimate", () => {
  const phase = Array.from({ length: 30 }, (_, index) => ({
    frequencyHz: 400 + index * 50,
    phaseDeg: 20 + Math.sin(index * 1.7) * 90,
    coherence: 0.96,
  }));
  const estimate = estimateRelativeDelayFromPhase(phase, {
    simultaneousCapture: true,
    sharedHardwareClock: true,
    perChannelCalibration: true,
    latencyCharacterized: true,
  });
  assert.equal(estimate.ready, false);
  assert.equal(estimate.delayMs, null);
});
