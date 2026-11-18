import test from "node:test";
import assert from "node:assert/strict";
import { analyzePhaseDelayAlignment } from "../src/audio/phaseDelayAlignment.ts";

const evidence = {
  simultaneousCapture: true,
  sharedHardwareClock: true,
  perChannelCalibration: true,
  latencyCharacterized: true,
};
const makePoints = (delayMs = 0) => Array.from({ length: 30 }, (_, index) => {
  const frequencyHz = 400 + index * 50;
  return { frequencyHz, magnitudeDb: 0, phaseDeg: 25 - 360 * frequencyHz * delayMs / 1000, coherence: 0.96 };
});
const capture = (zone, delayMs = 0, sampleRate = 48000, role = "fill") => ({
  id: zone, zone, role, sampleRate, points: makePoints(delayMs),
});

test("recommends delaying the earlier reference zone when target arrives later", () => {
  const result = analyzePhaseDelayAlignment([capture("Main", 0, 48000, "main"), capture("Fill", 2.5)], evidence);
  assert.equal(result.ready, true);
  assert.equal(result.pairs[0].recommendedZoneToDelay, "Main");
  assert.ok(Math.abs(result.pairs[0].recommendedDelayMs - 2.5) < 1e-8);
});

test("recommends delaying target when target arrives earlier", () => {
  const result = analyzePhaseDelayAlignment([capture("Main", 2, 48000, "main"), capture("Fill", 0)], evidence);
  assert.equal(result.ready, true);
  assert.equal(result.pairs[0].recommendedZoneToDelay, "Fill");
  assert.ok(Math.abs(result.pairs[0].recommendedDelayMs - 2) < 1e-8);
});

test("blocks absolute alignment without hardware clock and calibration evidence", () => {
  const result = analyzePhaseDelayAlignment(
    [capture("Main", 0, 48000, "main"), capture("Fill", 2)],
    { ...evidence, sharedHardwareClock: false },
  );
  assert.equal(result.ready, false);
  assert.equal(result.pairs[0].recommendedDelayMs, null);
  assert.match(result.pairs[0].estimate.reason, /hardware clock/);
});

test("rejects mismatched sample rates and duplicate zone labels", () => {
  const mismatch = analyzePhaseDelayAlignment([capture("Main"), capture("Fill", 1, 44100)], evidence);
  assert.equal(mismatch.ready, false);
  assert.match(mismatch.reason, /sample rate/i);
  const duplicate = analyzePhaseDelayAlignment([capture("Main"), capture("main", 1)], evidence);
  assert.equal(duplicate.ready, false);
  assert.match(duplicate.reason, /không được trùng/);
});

test("does not recommend a delay when phase data is insufficient", () => {
  const short = { ...capture("Fill", 1), points: makePoints(1).slice(0, 5) };
  const result = analyzePhaseDelayAlignment([capture("Main"), short], evidence);
  assert.equal(result.ready, false);
  assert.equal(result.pairs[0].recommendedZoneToDelay, null);
});
