import test from "node:test";
import assert from "node:assert/strict";
import { energyAverageDb, summarizeUniformity } from "../src/audio/zoneSplUniformity.ts";

const record = (id, levelDb, unit = "dBFS") => ({
  id, zone: "Khu 1", position: `P${id}`, levelDb, rawDbfs: levelDb,
  unit, durationSeconds: 10, sampleCount: 100, inputLabel: "USB mic", timestamp: id,
});

test("energy-average combines dB samples in the linear energy domain", () => {
  assert.equal(energyAverageDb([0, 0]), 0);
  assert.ok(Math.abs(energyAverageDb([0, 10]) - 7.4036) < 0.001);
});

test("energy-average ignores invalid and silence sentinel values", () => {
  assert.equal(energyAverageDb([-100, Number.NaN, 0]), 0);
  assert.equal(energyAverageDb([-100, Number.NaN]), null);
});

test("uniformity summary reports min, max, spread, mean and population deviation", () => {
  const result = summarizeUniformity([record(1, 80), record(2, 82), record(3, 86)]);
  assert.equal(result.count, 3);
  assert.equal(result.minDb, 80);
  assert.equal(result.maxDb, 86);
  assert.equal(result.spreadDb, 6);
  assert.ok(Math.abs(result.meanDb - 82.6666667) < 0.0001);
  assert.ok(Math.abs(result.standardDeviationDb - 2.4944383) < 0.0001);
});

test("uniformity refuses to mix dBFS and dB SPL records", () => {
  assert.equal(summarizeUniformity([record(1, 80), record(2, 82, "dB SPL")]), null);
});

test("empty point sets have no uniformity result", () => {
  assert.equal(summarizeUniformity([]), null);
});
