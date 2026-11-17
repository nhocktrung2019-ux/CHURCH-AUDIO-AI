import test from "node:test";
import assert from "node:assert/strict";
import {
  RTA_DEFAULT_BAND_COUNT,
  RTA_MAX_FREQUENCY_HZ,
  RTA_MIN_FREQUENCY_HZ,
  rtaBandFrequency,
  rtaBandIndexForFrequency,
} from "../src/audio/rtaFrequency.ts";

test("RTA band centres are logarithmic, ordered and inside the analyser range", () => {
  const centres = Array.from({ length: RTA_DEFAULT_BAND_COUNT }, (_, i) => rtaBandFrequency(i));
  assert.equal(centres.length, 64);
  assert.ok(centres[0] > RTA_MIN_FREQUENCY_HZ);
  assert.ok(centres.at(-1) < RTA_MAX_FREQUENCY_HZ);
  for (let i = 1; i < centres.length; i++) assert.ok(centres[i] > centres[i - 1]);
});

test("frequency-to-band mapping returns the original band for every band centre", () => {
  for (let i = 0; i < RTA_DEFAULT_BAND_COUNT; i++) {
    assert.equal(rtaBandIndexForFrequency(rtaBandFrequency(i)), i);
  }
});

test("frequency selection clamps safely at the analyser limits", () => {
  assert.equal(rtaBandIndexForFrequency(1), 0);
  assert.equal(rtaBandIndexForFrequency(50000), RTA_DEFAULT_BAND_COUNT - 1);
});

test("invalid frequency and band configuration are rejected", () => {
  assert.throws(() => rtaBandIndexForFrequency(Number.NaN), RangeError);
  assert.throws(() => rtaBandFrequency(0, 0), RangeError);
});
