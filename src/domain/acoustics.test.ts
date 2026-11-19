import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCalibratedSpl, validateAcousticMeasurement, type AcousticMeasurement } from "./acoustics.ts";

function record(id: string, value: number, kind: AcousticMeasurement["kind"] = "calibrated-spl"): AcousticMeasurement {
  return {
    id,
    projectId: "project-1",
    zoneId: "zone-1",
    kind,
    value,
    unit: kind === "relative-dbfs" ? "dBFS" : "dB_SPL",
    quality: "valid",
    provenance: {
      sessionId: "session-1",
      capturedAt: "2026-11-19T00:00:00.000Z",
      sourceLabel: "Reference measurement microphone",
      calibration: { calibrationMethod: "reference-meter", referenceLevelDbSpl: 94 },
    },
  };
}

test("energy average uses acoustic power, not arithmetic mean", () => {
  const summary = summarizeCalibratedSpl([record("a", 80), record("b", 80)]);
  assert.equal(summary.count, 2);
  assert.ok(Math.abs((summary.energyAverageDbSpl ?? 0) - 80) < 1e-10);
});

test("uncalibrated and simulated values are excluded from measured SPL summary", () => {
  const uncalibrated = { ...record("b", 90), kind: "simulated-spl" as const, quality: "uncalibrated" as const };
  const summary = summarizeCalibratedSpl([record("a", 80), uncalibrated]);
  assert.equal(summary.count, 1);
  assert.equal(summary.excludedCount, 1);
  assert.equal(summary.energyAverageDbSpl, 80);
});

test("calibrated SPL cannot be marked valid without calibration provenance", () => {
  const item = record("a", 80);
  item.provenance.calibration = undefined;
  assert.ok(validateAcousticMeasurement(item).some((error) => error.includes("calibration reference")));
});

test("relative dBFS cannot be mislabeled as physical SPL", () => {
  const item = record("a", -18, "relative-dbfs");
  item.unit = "dB_SPL";
  assert.ok(validateAcousticMeasurement(item).some((error) => error.includes("dBFS")));
});
