import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMeasuredDistanceAttenuation, analyzeSeatRowUniformity, buildZoneTrimAdvisory, compareMeasuredZonePair } from "../src/audio/spatialSurveyAnalysis.ts";

const row = (id, zone, position, levelDb, xM, yM, inputLabel = "USB measurement mic", offset = 112.5) => ({
  id, zone, position, xM, yM, levelDb, rawDbfs: levelDb - offset, unit: "dB SPL",
  durationSeconds: 10, sampleCount: 100, inputLabel, timestamp: 1000 + id, calibrationOffsetDb: offset,
});
test("v0.82 compares two zones only at matching listening positions", () => {
  const records = [
    row(1, "Main L", "Hàng ghế 1 · Giữa", 80, 3, 4), row(2, "Main L", "Hàng ghế 2 · Giữa", 78, 6, 4),
    row(3, "Main R", "Hàng ghế 1 · Giữa", 82, 3, 12), row(4, "Main R", "Hàng ghế 2 · Giữa", 80, 6, 12),
  ];
  const result = compareMeasuredZonePair(records, "Main L", "Main R");
  assert.equal(result.status, "ready");
  assert.equal(result.matchedPositionCount, 2);
  assert.ok(Math.abs((result.deltaDb ?? 0) + 2) < 0.01);
});
test("v0.82 blocks mixed input or calibration offsets", () => {
  const records = [
    row(1, "A", "Seat 1", 80, 1, 1), row(2, "B", "Seat 1", 82, 1, 2, "Built-in mic"),
  ];
  assert.equal(compareMeasuredZonePair(records, "A", "B").status, "blocked");
});
test("v0.83 groups repeated captures by row after energy averaging positions", () => {
  const records = [
    row(1, "A", "Hàng ghế 1 · Trái", 80, 1, 1), row(2, "A", "Hàng ghế 1 · Trái", 82, 1, 1),
    row(3, "A", "Hàng ghế 1 · Phải", 84, 1, 2), row(4, "A", "Hàng ghế 2 · Giữa", 78, 2, 2),
  ];
  const result = analyzeSeatRowUniformity(records);
  assert.equal(result.length, 2);
  const first = result.find(item => item.row === "Hàng ghế 1");
  assert.equal(first?.positionCount, 2);
  assert.equal(first?.captureCount, 3);
  assert.ok((first?.spreadDb ?? 0) > 3.5);
});
test("v0.84 estimates empirical distance slope from coordinate-matched samples", () => {
  const records = [
    row(1, "Delay", "Hàng ghế 1 · Giữa", 90, 2, 2),
    row(2, "Delay", "Hàng ghế 2 · Giữa", 84, 4, 2),
    row(3, "Delay", "Hàng ghế 3 · Giữa", 80, 8, 2),
    row(4, "Delay", "Hàng ghế 4 · Giữa", 76, 16, 2),
  ];
  const result = analyzeMeasuredDistanceAttenuation(records, { id: 1, name: "Delay", zone: "Delay", x: 0, y: 2, z: 3 }, 1.2);
  assert.equal(result.status, "ready");
  assert.equal(result.pointCount, 4);
  assert.ok((result.slopeDbPerDecade ?? 0) < 0);
  assert.ok((result.rSquared ?? 0) > 0.9);
});
test("v0.84 refuses samples without physical coordinates", () => {
  const records = [row(1, "A", "Seat 1", 80, 1, 1), row(2, "A", "Seat 2", 79, 2, 1), row(3, "A", "Seat 3", 78, 3, 1)].map(item => ({ ...item, xM: undefined, yM: undefined }));
  assert.equal(analyzeMeasuredDistanceAttenuation(records, { id: 1, name: "A", zone: "A", x: 0, y: 0, z: 3 }).status, "insufficient");
});
test("v0.85 returns a capped advisory and never enables DSP writes", () => {
  const records = [
    row(1, "Reference", "Seat 1", 90, 1, 1), row(2, "Reference", "Seat 2", 90, 2, 1), row(3, "Reference", "Seat 3", 90, 3, 1),
    row(4, "Target", "Seat 1", 84, 1, 1), row(5, "Target", "Seat 2", 84, 2, 1), row(6, "Target", "Seat 3", 84, 3, 1),
  ];
  const comparison = compareMeasuredZonePair(records, "Reference", "Target");
  const advisory = buildZoneTrimAdvisory(comparison, 3);
  assert.equal(advisory.status, "review-only");
  assert.equal(advisory.suggestedTrimDb, 3);
  assert.equal(advisory.writeEnabled, false);
});
test("v0.85 blocks gain trim when fewer than three matched positions exist", () => {
  const comparison = compareMeasuredZonePair([
    row(1, "A", "Seat 1", 90, 1, 1), row(2, "A", "Seat 2", 90, 2, 1),
    row(3, "B", "Seat 1", 84, 1, 1), row(4, "B", "Seat 2", 84, 2, 1),
  ], "A", "B");
  assert.equal(buildZoneTrimAdvisory(comparison).status, "blocked");
});

test("dBFS legacy records are excluded without blocking calibrated dB SPL analysis", () => {
  const records = [
    row(1, "A", "Hàng ghế 1 · Giữa", 80, 1, 1),
    row(2, "A", "Hàng ghế 2 · Giữa", 79, 2, 1),
    row(3, "B", "Hàng ghế 1 · Giữa", 81, 1, 2),
    row(4, "B", "Hàng ghế 2 · Giữa", 80, 2, 2),
    { ...row(5, "A", "Legacy relative capture", -20, 1, 1), unit: "dBFS", calibrationOffsetDb: undefined },
  ];
  assert.equal(compareMeasuredZonePair(records, "A", "B").status, "ready");
  assert.equal(analyzeSeatRowUniformity(records).length, 4);
});
