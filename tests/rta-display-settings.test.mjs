import test from "node:test";
import assert from "node:assert/strict";
import { getRtaBandColor, getRtaBarHeight, getRtaDisplayFloor, getRtaSmoothing } from "../src/audio/rtaDisplaySettings.ts";

test("RTA sensitivity changes display floor without altering input gain", () => {
  assert.equal(getRtaDisplayFloor("high"), -90);
  assert.equal(getRtaDisplayFloor("medium"), -75);
  assert.equal(getRtaDisplayFloor("low"), -60);
  assert.equal(getRtaBarHeight(-45, "high"), 50);
  assert.equal(getRtaBarHeight(-45, "low"), 25);
});

test("RTA response presets use faster analyser smoothing for fast mode", () => {
  assert.ok(getRtaSmoothing("fast") < getRtaSmoothing("medium"));
  assert.ok(getRtaSmoothing("medium") < getRtaSmoothing("slow"));
});

test("RTA frequency colors span a rainbow palette and clamp bar heights", () => {
  assert.match(getRtaBandColor(0, 64), /^hsl\(240,/);
  assert.match(getRtaBandColor(63, 64), /^hsl\(3\.75,/);
  assert.equal(getRtaBarHeight(12, "medium"), 100);
  assert.equal(getRtaBarHeight(-120, "medium"), 2);
});
