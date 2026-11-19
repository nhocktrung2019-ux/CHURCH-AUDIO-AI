import test from "node:test";
import assert from "node:assert/strict";
import {
  assessSurveyQuality,
  detectSurveyOutliers,
  buildZoneAdvisoryPlan,
  compareSurveySessions,
  estimateAxialRoomModes,
  createDspAdvisoryProposal,
  annotateSurveyRecords,
} from "../src/audio/acousticAdvisoryEngine.ts";

const record = (id, zone, position, levelDb, extra = {}) => ({
  id, zone, position, levelDb, rawDbfs: levelDb, unit: "dBFS",
  durationSeconds: 10, sampleCount: 100, inputLabel: "USB measurement mic",
  timestamp: id * 1000, ...extra,
});

test("quality gate accepts consistent measured records with enough positions", () => {
  const result = assessSurveyQuality([
    record(1, "Front", "Seat A", 78, { xM: 2, yM: 2 }),
    record(2, "Front", "Seat B", 79, { xM: 3, yM: 2 }),
  ], { lengthM: 20, widthM: 12 });
  assert.equal(result.status, "ready");
  assert.equal(result.recordCount, 2);
  assert.equal(result.zoneCount, 1);
});

test("quality gate blocks mixed units, mismatched calibration and invalid coordinates", () => {
  const mixed = assessSurveyQuality([
    record(1, "Front", "Seat A", 78),
    record(2, "Front", "Seat B", 79, { unit: "dB SPL", calibrationOffsetDb: 90, rawDbfs: -11 }),
  ]);
  assert.equal(mixed.status, "blocked");
  assert.equal(mixed.checks.find((check) => check.id === "unit-consistency").status, "fail");

  const wrongCalibration = assessSurveyQuality([
    record(3, "Front", "Seat A", 78, { unit: "dB SPL", rawDbfs: -10, calibrationOffsetDb: 90 }),
    record(4, "Front", "Seat B", 79, { unit: "dB SPL", rawDbfs: -11, calibrationOffsetDb: 90 }),
  ]);
  assert.equal(wrongCalibration.status, "blocked");
  assert.equal(wrongCalibration.checks.find((check) => check.id === "spl-calibration").status, "fail");

  const badCoordinates = assessSurveyQuality([
    record(5, "Front", "Seat A", 78, { xM: 25, yM: 2 }),
    record(6, "Front", "Seat B", 79),
  ], { lengthM: 20, widthM: 12 });
  assert.equal(badCoordinates.status, "blocked");
});

test("quality gate warns when a zone has fewer than two independent positions", () => {
  const result = assessSurveyQuality([record(1, "Front", "Seat A", 80)]);
  assert.equal(result.status, "review");
  assert.equal(result.checks.find((check) => check.id === "spatial-coverage").status, "warning");
});

test("outlier detector flags a repeat capture but does not mutate the survey", () => {
  const source = [
    record(1, "Front", "Seat A", 80),
    record(2, "Front", "Seat A", 80.2),
    record(3, "Front", "Seat A", 79.9),
    record(4, "Front", "Seat A", 91),
  ];
  const before = JSON.stringify(source);
  const result = detectSurveyOutliers(source, 6);
  assert.equal(result.length, 1);
  assert.equal(result[0].recordIds[0], 4);
  assert.equal(JSON.stringify(source), before);
});

test("zone advisory plan explains low/high zones and stays advisory-only", () => {
  const result = buildZoneAdvisoryPlan([
    record(1, "Front", "Seat A", 70), record(2, "Front", "Seat B", 71),
    record(3, "Rear", "Seat A", 80), record(4, "Rear", "Seat B", 81),
  ], 2);
  assert.equal(result.status, "available");
  assert.equal(result.zones.find((zone) => zone.zone === "Front").status, "low");
  assert.equal(result.zones.find((zone) => zone.zone === "Rear").status, "high");
  assert.ok(result.safeguards.some((item) => item.includes("Không tự thay")));
});

test("before/after comparison uses only matched positions and same input chain", () => {
  const before = [
    record(1, "Front", "Seat A", 70), record(2, "Front", "Seat B", 72),
    record(3, "Front", "Seat C", 74),
  ];
  const after = [
    record(4, "Front", "Seat A", 74), record(5, "Front", "Seat B", 76),
    record(6, "Front", "Seat C", 78), record(7, "Front", "Seat D", 90),
  ];
  const result = compareSurveySessions(before, after);
  assert.equal(result.rows[0].matchedPositions, 3);
  assert.ok(Math.abs(result.rows[0].deltaAfterMinusBeforeDb - 4) < 1e-9);
  assert.equal(compareSurveySessions(before, after.map((item) => ({ ...item, inputLabel: "Phone mic" }))), null);
});

test("before/after comparison refuses insufficient position matching", () => {
  assert.equal(compareSurveySessions(
    [record(1, "Front", "Seat A", 70), record(2, "Front", "Seat B", 72)],
    [record(3, "Front", "Seat C", 73), record(4, "Front", "Seat D", 75)],
  ), null);
});

test("axial room mode outputs are marked theoretical and validate room dimensions", () => {
  const modes = estimateAxialRoomModes({ lengthM: 10, widthM: 8, heightM: 4 }, 343, 3);
  assert.equal(modes.length, 9);
  assert.equal(modes[0].axis, "length");
  assert.equal(modes[0].classification, "theoretical-estimate");
  assert.equal(estimateAxialRoomModes({ lengthM: 0, widthM: 8, heightM: 4 }).length, 0);
});

test("DSP proposal is explicitly non-executable and refuses invalid evidence", () => {
  const proposal = createDspAdvisoryProposal({
    parameter: "delay", target: "Rear zone", proposedValue: 3.2, basisMeasurementIds: [1, 2, 3],
  });
  assert.equal(proposal.writeEnabled, false);
  assert.equal(proposal.execution, "advisory-only");
  assert.ok(proposal.requiredHumanChecks.length >= 4);
  assert.equal(createDspAdvisoryProposal({
    parameter: "eq", target: "", proposedValue: 2, basisMeasurementIds: [1],
  }), null);
});


test("export annotations preserve every record and assess each unit/input chain separately", () => {
  const records = [
    record(1, "Front", "Seat A", 80),
    record(2, "Front", "Seat A", 80.1),
    record(3, "Front", "Seat A", 79.9),
    record(4, "Front", "Seat A", 91),
    record(5, "Front", "Seat B", 81),
    record(6, "Front", "Seat B", 82, {
      unit: "dB SPL", rawDbfs: -8, levelDb: 82, calibrationOffsetDb: 90,
    }),
  ];
  const result = annotateSurveyRecords(records, { lengthM: 20, widthM: 12 });
  assert.equal(result.length, records.length);
  assert.equal(result.find((item) => item.recordId === 4).outlierFlag, true);
  assert.equal(result.find((item) => item.recordId === 1).outlierFlag, false);
  assert.equal(result.find((item) => item.recordId === 6).qualityStatus, "review");
});
