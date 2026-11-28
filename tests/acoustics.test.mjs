import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCalibratedSpl, validateAcousticMeasurement } from "../src/domain/acoustics.ts";

function record(id, value, kind = "calibrated-spl") {
  return {
    id, projectId: "project-1", zoneId: "zone-1", kind, value,
    unit: kind === "relative-dbfs" ? "dBFS" : "dB_SPL",
    quality: "valid",
    provenance: {
      sessionId: "session-1", capturedAt: "2026-11-19T00:00:00.000Z",
      sourceLabel: "Reference measurement microphone",
      calibration: { calibrationMethod: "reference-meter", referenceLevelDbSpl: 94 },
    },
  };
}

test("energy average uses acoustic power, not arithmetic mean", () => {
  const summary = summarizeCalibratedSpl([record("a", 80), record("b", 80)]);
  assert.equal(summary.count, 2);
  assert.ok(Math.abs(summary.energyAverageDbSpl - 80) < 1e-10);
});

test("simulated values are excluded from measured SPL summary", () => {
  const simulated = { ...record("b", 90, "simulated-spl"), quality: "uncalibrated" };
  const summary = summarizeCalibratedSpl([record("a", 80), simulated]);
  assert.equal(summary.count, 1);
  assert.equal(summary.excludedCount, 1);
  assert.equal(summary.energyAverageDbSpl, 80);
});

test("valid calibrated SPL requires calibration provenance", () => {
  const item = record("a", 80);
  item.provenance.calibration = undefined;
  assert.ok(validateAcousticMeasurement(item).some((error) => error.includes("calibration method")));
});

test("records marked valid but carrying no calibration are excluded from summaries", () => {
  const uncalibrated = record("b", 96);
  uncalibrated.provenance.calibration = { calibrationMethod: "none" };
  const summary = summarizeCalibratedSpl([record("a", 80), uncalibrated]);
  assert.equal(summary.count, 1);
  assert.equal(summary.excludedCount, 1);
  assert.equal(summary.energyAverageDbSpl, 80);
});

test("relative dBFS cannot be mislabeled as physical SPL", () => {
  const item = record("a", -18, "relative-dbfs");
  item.unit = "dB_SPL";
  assert.ok(validateAcousticMeasurement(item).some((error) => error.includes("dBFS")));
});

test("invalid capture metadata is rejected", () => {
  const item = record("a", 80);
  item.provenance.capturedAt = "not-a-date";
  item.provenance.sampleRateHz = 0;
  item.provenance.channelCount = 1.5;
  const errors = validateAcousticMeasurement(item);
  assert.ok(errors.some((error) => error.includes("timestamp")));
  assert.ok(errors.some((error) => error.includes("Sample rate")));
  assert.ok(errors.some((error) => error.includes("Channel count")));
});


test("zone analysis reports calibrated level, target deviation and sample sufficiency", async () => {
  const { analyzeZoneSpl } = await import("../src/domain/acoustics.ts");
  const zone = { id: "zone-1", name: "Main seating", targetSplDb: 85, speakerIds: [] };
  const results = analyzeZoneSpl(
    [zone],
    [record("a", 84), record("b", 85), record("c", 86)],
    { minimumSamples: 3, maximumSpreadDb: 4 },
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].sampleCount, 3);
  assert.ok(Math.abs(results[0].energyAverageDbSpl - 85.03) < 0.1);
  assert.ok(results[0].deviationFromTargetDb > 0);
  assert.equal(results[0].uniformity, "within-limit");
});

test("zone analysis never treats simulated or uncalibrated samples as measured SPL", async () => {
  const { analyzeZoneSpl } = await import("../src/domain/acoustics.ts");
  const zone = { id: "zone-1", name: "Choir", targetSplDb: 82, speakerIds: [] };
  const uncalibrated = record("b", 110);
  uncalibrated.provenance.calibration = { calibrationMethod: "none" };
  const results = analyzeZoneSpl(
    [zone],
    [record("a", 80), uncalibrated, { ...record("c", 95, "simulated-spl"), quality: "uncalibrated" }],
    { minimumSamples: 2 },
  );
  assert.equal(results[0].sampleCount, 1);
  assert.equal(results[0].excludedCount, 2);
  assert.equal(results[0].uniformity, "insufficient-data");
});

test("zone analysis validates thresholds and handles missing targets", async () => {
  const { analyzeZoneSpl } = await import("../src/domain/acoustics.ts");
  const zone = { id: "zone-2", name: "Balcony", speakerIds: [] };
  const result = analyzeZoneSpl([zone], [record("a", 80)])[0];
  assert.equal(result.targetSplDb, null);
  assert.equal(result.deviationFromTargetDb, null);
  assert.equal(result.uniformity, "insufficient-data");
  assert.throws(() => analyzeZoneSpl([zone], [], { minimumSamples: 0 }), RangeError);
  assert.throws(() => analyzeZoneSpl([zone], [], { maximumSpreadDb: -1 }), RangeError);
});
