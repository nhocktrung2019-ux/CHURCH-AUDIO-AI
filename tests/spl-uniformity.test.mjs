import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSplUniformity } from "../src/audio/splUniformity.ts";

const reading = (splDb, calibration = "calibrated", weighting = "A") => ({
  splDb,
  calibration,
  weighting,
});

test("uses only calibrated physical SPL readings", () => {
  const result = analyzeSplUniformity(
    [reading(80), reading(86), reading(120, "uncalibrated"), reading(null)],
    85,
  );
  assert.equal(result.count, 2);
  assert.equal(result.minimumDb, 80);
  assert.equal(result.maximumDb, 86);
  assert.equal(result.spreadDb, 6);
});

test("computes energy average and dB uniformity metrics", () => {
  const result = analyzeSplUniformity([reading(80), reading(80)], 80);
  assert.equal(result.energyAverageDb, 80);
  assert.equal(result.standardDeviationDb, 0);
  assert.equal(result.within3Db, 2);
  assert.equal(result.within6Db, 2);
  assert.equal(result.targetOffsetDb, 0);
});

test("refuses to pool different weighting curves", () => {
  const result = analyzeSplUniformity([reading(80, "calibrated", "A"), reading(82, "calibrated", "C")], 80);
  assert.equal(result.comparable, false);
  assert.equal(result.energyAverageDb, null);
  assert.equal(result.weighting, null);
});

test("returns empty metrics when no calibrated readings exist", () => {
  const result = analyzeSplUniformity([reading(82, "uncalibrated")], 85);
  assert.equal(result.count, 0);
  assert.equal(result.energyAverageDb, null);
  assert.equal(result.comparable, true);
});
