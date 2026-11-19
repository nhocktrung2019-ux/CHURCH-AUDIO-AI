import test from "node:test";
import assert from "node:assert/strict";
import { buildMeasuredSurface } from "../src/audio/measuredSurfaceModel.ts";

const room = { length: 20, width: 12, height: 6 };
const point = (id, x, y, splDb, overrides = {}) => ({
  id, label: id, x, y, z: 1.2, splDb, calibration: "calibrated",
  weighting: "A", inputLabel: "calibrated mic", note: "", capturedAt: "2026-11-19T10:00:00Z",
  ...overrides,
});

test("requires four calibrated readings with matching weighting", () => {
  assert.equal(buildMeasuredSurface([
    point("a", 2, 2, 80), point("b", 18, 2, 82), point("c", 18, 10, 84),
  ], room, "A"), null);
  assert.equal(buildMeasuredSurface([
    point("a", 2, 2, 80), point("b", 18, 2, 82), point("c", 18, 10, 84),
    point("d", 2, 10, 86, { weighting: "C" }),
  ], room, "A"), null);
});

test("builds a surface only inside the measured convex hull", () => {
  const result = buildMeasuredSurface([
    point("a", 2, 2, 80), point("b", 18, 2, 82),
    point("c", 18, 10, 84), point("d", 2, 10, 86),
  ], room, "A");
  assert.ok(result);
  assert.ok(result.cellCount > 0);
  assert.equal(result.sampleCount, 4);
  assert.ok(result.minDb >= 80);
  assert.ok(result.maxDb <= 86);
  assert.ok(result.positions.length > 0);
  assert.equal(result.indices.length, result.cellCount * 6);
});

test("ignores uncalibrated, out-of-room, invalid and differently weighted readings", () => {
  const result = buildMeasuredSurface([
    point("a", 2, 2, 80), point("b", 18, 2, 82),
    point("c", 18, 10, 84), point("d", 2, 10, 86),
    point("uncalibrated", 10, 6, 90, { calibration: "uncalibrated" }),
    point("outside", 22, 6, 90),
    point("bad", 10, 6, 180),
    point("other-weight", 10, 6, 70, { weighting: "C" }),
  ], room, "A");
  assert.equal(result?.sampleCount, 4);
});

test("rejects collinear readings and returns null for sparse geometry", () => {
  assert.equal(buildMeasuredSurface([
    point("a", 1, 1, 80), point("b", 5, 1, 81),
    point("c", 10, 1, 82), point("d", 15, 1, 83),
  ], room, "A"), null);
});
