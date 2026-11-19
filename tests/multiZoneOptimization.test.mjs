import test from "node:test";
import assert from "node:assert/strict";
import { buildMultiZoneOptimizationReview, buildWeightedZoneSummaries, reviewSpeakerPlacement, separateEvidenceRecords, validateListeningPoints } from "../src/audio/multiZoneOptimization.ts";
const points = [{ id: "front", label: "Front", xM: 2, yM: 2, weight: 1 }, { id: "middle", label: "Middle", xM: 5, yM: 2, weight: 2 }];
const row = (id, zone, positionId, levelDb, source = "measured") => ({ id, zone, positionId, xM: positionId === "front" ? 2 : 5, yM: 2, levelDb, unit: "dB SPL", inputLabel: "USB measurement mic", calibrationId: "cal-01", calibrationOffsetDb: 113.2, source, quality: "accepted", timestamp: 1 });
test("v0.71 validates weighted listening points and room bounds", () => {
  assert.deepEqual(validateListeningPoints(points, { lengthM: 10, widthM: 8 }), []);
  assert.ok(validateListeningPoints([{ ...points[0], weight: 0 }], { lengthM: 10, widthM: 8 }).some(issue => issue.code === "invalid-point-weight"));
  assert.ok(validateListeningPoints([{ ...points[0], xM: 11 }], { lengthM: 10, widthM: 8 }).some(issue => issue.code === "point-outside-room"));
});
test("v0.72 computes weighted zone summaries only from compatible measured SPL", () => {
  const result = buildWeightedZoneSummaries([row("a", "A", "front", 80), row("b", "A", "middle", 86), row("sim", "A", "front", 99, "simulated")], points);
  assert.equal(result.length, 1); assert.ok((result[0].weightedMeanDb ?? 0) > 83); assert.equal(result[0].measuredPointCount, 2);
});
test("v0.72 rejects mixed input chains and calibration IDs", () => {
  assert.deepEqual(buildWeightedZoneSummaries([row("a", "A", "front", 80), { ...row("b", "A", "middle", 86), inputLabel: "Built-in mic" }], points), []);
});
test("v0.73 keeps measured, simulated and theoretical evidence separate", () => {
  const result = separateEvidenceRecords([row("m", "A", "front", 80), row("s", "A", "front", 85, "simulated"), row("t", "A", "front", 90, "theoretical")]);
  assert.equal(result.measured.length, 1); assert.equal(result.simulated.length, 1); assert.equal(result.theoretical.length, 1);
});
test("v0.74 reports geometry references without changing saved placement", () => {
  const result = reviewSpeakerPlacement([{ id: "sp1", name: "Main", zone: "A", x: 1, y: 1, z: 4 }], points, { lengthM: 10, widthM: 8, heightM: 7 });
  assert.equal(result.pointReviews[0].nearestSpeakerId, "sp1"); assert.equal(result.changesSaved, false); assert.equal(result.pointReviews[0].status, "geometry-reference-only");
});
test("v0.75 returns a technician review queue and never enables writes", () => {
  const records = [row("a", "A", "front", 80), row("b", "A", "middle", 80), row("c", "B", "front", 90), row("d", "B", "middle", 90)];
  const review = buildMultiZoneOptimizationReview(records, points, 2);
  assert.equal(review.status, "ready-for-technician-review"); assert.equal(review.writeEnabled, false);
  assert.ok(review.priorities.some(item => item.zone === "B" && item.action === "review-level-balance"));
});
test("v0.75 asks for missing points before comparing zones", () => {
  const review = buildMultiZoneOptimizationReview([row("a", "A", "front", 80)], points);
  assert.equal(review.status, "insufficient-measurements"); assert.equal(review.priorities[0].action, "capture-missing-points");
});
