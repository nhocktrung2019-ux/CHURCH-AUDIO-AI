import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMeasurementRepeatability, flagSpatialMeasurementOutliers, summarizeZoneMeasurementConfidence } from "../src/audio/spatialMeasurementConfidence.ts";
const points = [{ id: "p1", label: "Front", xM: 2, yM: 2, weight: 1 }, { id: "p2", label: "Rear", xM: 8, yM: 2, weight: 1 }];
const row = (id, pointId, levelDb, zone = "A", quality = "accepted") => ({
  id, zone, positionId: pointId, xM: pointId === "p1" ? 2 : 8, yM: 2, levelDb,
  unit: "dB SPL", inputLabel: "USB mic", calibrationId: "cal-01",
  calibrationOffsetDb: 112.5, source: "measured", quality, timestamp: 1
});
test("v0.76 reports repeatability spread per zone and listening point", () => {
  const result = analyzeMeasurementRepeatability([row("a", "p1", 80), row("b", "p1", 80.8), row("c", "p2", 82)], points);
  assert.equal(result.length, 2);
  assert.equal(result.find(x => x.pointId === "p1")?.status, "pass");
  assert.equal(result.find(x => x.pointId === "p2")?.status, "insufficient");
});
test("v0.76 refuses mixed calibration chains", () => {
  const result = analyzeMeasurementRepeatability([row("a", "p1", 80), { ...row("b", "p1", 81), calibrationId: "other" }], points);
  assert.deepEqual(result, []);
});
test("v0.77 flags an outlier for review without mutating source records", () => {
  const records = [row("a", "p1", 80), row("b", "p1", 80.1), row("c", "p1", 80.2), row("d", "p1", 88)];
  const before = JSON.stringify(records);
  const flags = flagSpatialMeasurementOutliers(records, points);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].recordId, "d");
  assert.equal(flags[0].action, "technician-review-only");
  assert.equal(JSON.stringify(records), before);
});
test("v0.78-v0.80 rates coverage and repeatability separately", () => {
  const result = summarizeZoneMeasurementConfidence([
    row("a", "p1", 80), row("b", "p1", 80.2), row("c", "p2", 81), row("d", "p2", 81.2)
  ], points);
  assert.equal(result[0].coverageRatio, 1);
  assert.equal(result[0].confidence, "high");
  assert.equal(result[0].repeatabilityPassRatio, 1);
});
test("confidence ignores simulated, rejected, and coordinate-mismatched records", () => {
  const result = summarizeZoneMeasurementConfidence([
    row("a", "p1", 80, "A", "rejected"),
    { ...row("b", "p2", 85), source: "simulated" },
    { ...row("c", "p2", 86), xM: 100 }
  ], points);
  assert.deepEqual(result, []);
});
test("invalid thresholds are rejected", () => {
  assert.throws(() => analyzeMeasurementRepeatability([], points, 0));
  assert.throws(() => flagSpatialMeasurementOutliers([], points, -1));
});
