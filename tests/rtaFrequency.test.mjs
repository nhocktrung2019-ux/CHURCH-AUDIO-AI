import test from "node:test";
import assert from "node:assert/strict";
import { bandForFrequency, frequencyForBand } from "../src/audio/rtaFrequency.ts";

test("RTA band center frequencies are logarithmic and strictly increasing", () => {
  const values = Array.from({ length: 64 }, (_, index) => frequencyForBand(index, 64));
  assert.ok(values[0] > 20);
  assert.ok(values[63] < 20000);
  for (let index = 1; index < values.length; index++) {
    assert.ok(values[index] > values[index - 1]);
  }
});

test("frequency-to-band mapping selects the original band center", () => {
  for (let index = 0; index < 64; index++) {
    assert.equal(bandForFrequency(frequencyForBand(index, 64), 64), index);
  }
});

test("frequency mapping clamps outside the RTA range", () => {
  assert.equal(bandForFrequency(1, 64), 0);
  assert.equal(bandForFrequency(100000, 64), 63);
  assert.equal(frequencyForBand(-20, 64), frequencyForBand(0, 64));
  assert.equal(frequencyForBand(1000, 64), frequencyForBand(63, 64));
});

test("invalid input returns a safe lower-band value", () => {
  assert.equal(bandForFrequency(Number.NaN, 64), 0);
  assert.equal(frequencyForBand(Number.NaN, 64), 20);
});
