import test from "node:test";
import assert from "node:assert/strict";
import {
  getVerifiedMeasuredPoints,
  isMeasuredPointInsideRoom,
  isValidMeasuredSpl,
} from "../src/audio/measuredPointModel.ts";

const room = { length: 28, width: 16, height: 7 };
const point = (overrides = {}) => ({
  id: "mp-1",
  label: "Hàng ghế giữa",
  x: 12,
  y: 8,
  z: 1.2,
  splDb: 85,
  calibration: "calibrated",
  weighting: "A",
  inputLabel: "USB measurement mic",
  note: "",
  capturedAt: "2026-11-19T10:00:00.000Z",
  ...overrides,
});

test("accepts measured coordinates on the room boundary", () => {
  assert.equal(isMeasuredPointInsideRoom(point({ x: 28, y: 16, z: 7 }), room), true);
});

test("rejects coordinates outside the room and non-finite values", () => {
  assert.equal(isMeasuredPointInsideRoom(point({ x: 28.1 }), room), false);
  assert.equal(isMeasuredPointInsideRoom(point({ y: Number.NaN }), room), false);
});

test("only calibrated in-room physical SPL points are verified", () => {
  const result = getVerifiedMeasuredPoints([
    point(),
    point({ id: "legacy", calibration: "uncalibrated" }),
    point({ id: "outside", x: 40 }),
    point({ id: "missing", splDb: null }),
  ], room);
  assert.deepEqual(result.map((item) => item.id), ["mp-1"]);
});

test("rejects invalid SPL values without converting dBFS", () => {
  assert.equal(isValidMeasuredSpl(85.2), true);
  assert.equal(isValidMeasuredSpl(null), false);
  assert.equal(isValidMeasuredSpl(Number.NaN), false);
  assert.equal(isValidMeasuredSpl(170), false);
});
