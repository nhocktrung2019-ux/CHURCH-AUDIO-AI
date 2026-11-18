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


test("zone comparison equal-weights listening positions and energy-averages repeats", async () => {
  const { compareZoneLevels } = await import("../src/audio/zoneSplUniformity.ts");
  const rows = compareZoneLevels([
    {...record(1, 80), zone: "Khu 1", position: "Ghế A"},
    {...record(2, 80), zone: "Khu 1", position: "Ghế A"},
    {...record(3, 80), zone: "Khu 1", position: "Ghế B"},
    {...record(4, 86), zone: "Khu 2", position: "Ghế A"},
    {...record(5, 86), zone: "Khu 2", position: "Ghế B"},
  ], 2);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].zone, "Khu 1");
  assert.equal(rows[0].positionCount, 2);
  assert.equal(rows[0].status, "low");
  assert.equal(rows[1].status, "high");
  assert.ok(Math.abs(rows[0].deltaFromMeanDb + 3) < 0.001);
});

test("zone comparison refuses mixed input labels or units", async () => {
  const { compareZoneLevels } = await import("../src/audio/zoneSplUniformity.ts");
  assert.equal(compareZoneLevels([
    {...record(1, 80), zone: "Khu 1"},
    {...record(2, 82), zone: "Khu 2", inputLabel: "Other mic"},
  ]), null);
  assert.equal(compareZoneLevels([
    {...record(1, 80), zone: "Khu 1"},
    {...record(2, 82, "dB SPL"), zone: "Khu 2"},
  ]), null);
});

test("zone comparison marks a zone with fewer than two positions insufficient", async () => {
  const { compareZoneLevels } = await import("../src/audio/zoneSplUniformity.ts");
  const rows = compareZoneLevels([
    {...record(1, 80), zone: "Khu 1", position: "Only seat"},
    {...record(2, 82), zone: "Khu 2", position: "Seat A"},
    {...record(3, 82), zone: "Khu 2", position: "Seat B"},
  ]);
  assert.equal(rows.find((row) => row.zone === "Khu 1").status, "insufficient");
});


test("zone comparison duration-weights repeated LAeq captures at a seat", async () => {
  const { compareZoneLevels } = await import("../src/audio/zoneSplUniformity.ts");
  const rows = compareZoneLevels([
    {...record(1, 0), zone: "Khu 1", position: "Ghế A", durationSeconds: 10},
    {...record(2, 10), zone: "Khu 1", position: "Ghế A", durationSeconds: 30},
    {...record(3, 5), zone: "Khu 2", position: "Ghế A"},
    {...record(4, 5), zone: "Khu 2", position: "Ghế B"},
  ]);
  const expected = 10 * Math.log10((10 * 1 + 30 * 10) / 40);
  assert.ok(Math.abs(rows.find((row) => row.zone === "Khu 1").meanDb - expected) < 0.001);
});

test("dB SPL zone comparison requires a consistent recorded calibration offset", async () => {
  const { compareZoneLevels } = await import("../src/audio/zoneSplUniformity.ts");
  const base = [
    {...record(1, 80, "dB SPL"), zone: "Khu 1", position: "A", calibrationOffsetDb: 93},
    {...record(2, 82, "dB SPL"), zone: "Khu 2", position: "A", calibrationOffsetDb: 94},
  ];
  assert.equal(compareZoneLevels(base), null);
  assert.equal(compareZoneLevels(base.map((row) => ({...row, calibrationOffsetDb: 93}))).length, 2);
});
