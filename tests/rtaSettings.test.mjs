import test from "node:test";
import assert from "node:assert/strict";
import {
  getRtaBarColor,
  getRtaDisplayHeight,
  getRtaSpeedConfig,
  RTA_SENSITIVITY_OPTIONS,
  RTA_SPEED_OPTIONS,
} from "../src/audio/rtaSettings.ts";

test("RTA sensitivity changes only the display floor", () => {
  assert.equal(RTA_SENSITIVITY_OPTIONS.high.floorDbfs, -100);
  assert.equal(RTA_SENSITIVITY_OPTIONS.medium.floorDbfs, -85);
  assert.equal(RTA_SENSITIVITY_OPTIONS.low.floorDbfs, -70);
  assert.ok(getRtaDisplayHeight(-80, "high") > 0);
  assert.ok(getRtaDisplayHeight(-80, "medium") > 0);
  assert.equal(getRtaDisplayHeight(-80, "low"), 0);
});
test("RTA display heights remain bounded and reject non-finite values", () => {
  assert.equal(getRtaDisplayHeight(-120, "high"), 0);
  assert.equal(getRtaDisplayHeight(12, "high"), 100);
  assert.equal(getRtaDisplayHeight(Number.NaN, "medium"), 0);
});
test("RTA spectrum colors vary by signal level and use a dark floor color", () => {
  assert.equal(getRtaBarColor(-110, "high"), "#263640");
  assert.notEqual(getRtaBarColor(-80, "high"), getRtaBarColor(-20, "high"));
});
test("RTA speed presets reduce update frequency and increase smoothing", () => {
  const fast = getRtaSpeedConfig("fast");
  const medium = getRtaSpeedConfig("medium");
  const slow = getRtaSpeedConfig("slow");
  assert.ok(fast.frameDivisor < medium.frameDivisor);
  assert.ok(medium.frameDivisor < slow.frameDivisor);
  assert.ok(fast.smoothingTimeConstant < medium.smoothingTimeConstant);
  assert.ok(medium.smoothingTimeConstant < slow.smoothingTimeConstant);
  assert.equal(RTA_SPEED_OPTIONS.fast.refreshLabel, "~30 lần/giây");
});
