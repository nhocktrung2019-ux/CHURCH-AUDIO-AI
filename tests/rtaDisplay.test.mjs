import test from "node:test";
import assert from "node:assert/strict";
import {
  rtaBarVisual,
  rtaDisplayFloorDb,
  rtaFrameInterval,
  rtaSmoothingConstant,
} from "../src/audio/rtaDisplay.ts";

test("RTA sensitivity changes only the display floor in the expected order", () => {
  assert.equal(rtaDisplayFloorDb("high"), -100);
  assert.equal(rtaDisplayFloorDb("medium"), -85);
  assert.equal(rtaDisplayFloorDb("low"), -70);
  assert.ok(rtaDisplayFloorDb("high") < rtaDisplayFloorDb("medium"));
  assert.ok(rtaDisplayFloorDb("medium") < rtaDisplayFloorDb("low"));
});

test("RTA speed selects bounded update intervals and increasing smoothing", () => {
  assert.equal(rtaFrameInterval("fast"), 2);
  assert.equal(rtaFrameInterval("medium"), 3);
  assert.equal(rtaFrameInterval("slow"), 6);
  assert.ok(rtaSmoothingConstant("fast") < rtaSmoothingConstant("medium"));
  assert.ok(rtaSmoothingConstant("medium") < rtaSmoothingConstant("slow"));
});

test("RTA multicolour bar maps low and high levels into the visible range", () => {
  const quiet = rtaBarVisual(-100, "high");
  const loud = rtaBarVisual(0, "high");
  assert.equal(quiet.heightPercent, 2);
  assert.equal(quiet.intensity, 0);
  assert.equal(loud.heightPercent, 100);
  assert.equal(loud.intensity, 1);
  assert.equal(loud.hueDegrees, 0);
});

test("RTA bar clamps out-of-range and non-finite values safely", () => {
  assert.equal(rtaBarVisual(-140, "medium").intensity, 0);
  assert.equal(rtaBarVisual(12, "medium").intensity, 1);
  assert.equal(rtaBarVisual(Number.NaN, "medium").heightPercent, 2);
});
