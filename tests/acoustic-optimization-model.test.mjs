import test from "node:test";
import assert from "node:assert/strict";
import { buildAimingRecommendations } from "../src/audio/acousticOptimizationModel.ts";

const speakers = [
  { id: 1, name: "Main left", zone: "Zone 1", x: 1, y: 2, z: 5, azimuth: 35, coverage: 90, verticalCoverage: 40, sensitivity: 95, powerW: 250 },
  { id: 2, name: "Main right", zone: "Zone 1", x: 1, y: 14, z: 5, azimuth: -35, coverage: 90, verticalCoverage: 40, sensitivity: 95, powerW: 250 },
  { id: 3, name: "Delay", zone: "Zone 2", x: 17, y: 8, z: 4, azimuth: 180, coverage: 100, verticalCoverage: 40, sensitivity: 94, powerW: 150 },
];

test("returns no recommendations when speaker output data is missing", () => {
  const missing = speakers.map((speaker) => ({ ...speaker, sensitivity: null, powerW: null }));
  assert.deepEqual(buildAimingRecommendations(missing, { length: 28, width: 16 }, 85), []);
});

test("returns bounded azimuth suggestions without mutating source speakers", () => {
  const before = JSON.stringify(speakers);
  const result = buildAimingRecommendations(speakers, { length: 28, width: 16 }, 85);
  assert.equal(result.length, speakers.length);
  assert.ok(result.every((item) => item.suggestedAzimuth >= -180 && item.suggestedAzimuth < 180));
  assert.ok(result.every((item) => item.analyzedPoints >= 4));
  assert.equal(JSON.stringify(speakers), before);
});

test("limits the search to configured adjustment range", () => {
  const result = buildAimingRecommendations(speakers, { length: 28, width: 16 }, 85, {
    maxAdjustmentDeg: 10, stepDeg: 5,
  });
  assert.ok(result.every((item) => Math.abs(((item.suggestedAzimuth - item.currentAzimuth + 540) % 360) - 180) <= 10));
});

test("rejects invalid room dimensions", () => {
  assert.deepEqual(buildAimingRecommendations(speakers, { length: 0, width: 16 }, 85), []);
});
