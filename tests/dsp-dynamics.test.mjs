import test from "node:test";
import assert from "node:assert/strict";
import { calculateDynamicsStartingPoint } from "../src/audio/dspStartingPoints.ts";

test("dynamic handheld and gooseneck microphones receive conservative distinct starting points", () => {
  const handheld = calculateDynamicsStartingPoint({ microphone: "dynamic-handheld", noiseFloorDbfs: -55, speechPeakDbfs: -18 });
  const gooseneck = calculateDynamicsStartingPoint({ microphone: "gooseneck", noiseFloorDbfs: -55, speechPeakDbfs: -18 });
  assert.equal(handheld.gate.thresholdDbfs, -49);
  assert.equal(gooseneck.gate.thresholdDbfs, -47);
  assert.equal(handheld.compressor.ratio, 2.5);
  assert.equal(gooseneck.compressor.ratio, 2);
  assert.equal(handheld.limiter.ceilingDbfs, -3);
});

test("dynamics calculator clamps invalid ranges and warns about poor signal-to-noise", () => {
  const result = calculateDynamicsStartingPoint({ microphone: "dynamic-handheld", noiseFloorDbfs: -120, speechPeakDbfs: -2 });
  assert.equal(result.gate.thresholdDbfs, -84);
  assert.equal(result.compressor.thresholdDbfs, -9);
  assert.ok(result.warnings.length >= 1);
});
