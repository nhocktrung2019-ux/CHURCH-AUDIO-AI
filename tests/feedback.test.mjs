import test from "node:test";
import assert from "node:assert/strict";
import { detectNarrowPeaks } from "../src/audio/feedback.ts";

function frameWithPeak(index = 24, base = -82, peak = -56) {
  const values = Array(64).fill(base);
  values[index] = peak;
  return values;
}

test("stable narrow peak is reported with high persistence and confidence", () => {
  const history = Array.from({ length: 10 }, () => frameWithPeak());
  const candidates = detectNarrowPeaks(history);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].index, 24);
  assert.equal(candidates[0].persistence, 100);
  assert.equal(candidates[0].confidence, "high");
  assert.ok(candidates[0].recommendedCutDb <= 0);
  assert.ok(candidates[0].recommendedCutDb >= -4);
});

test("a single transient spectral spike is not classified as persistent feedback", () => {
  const history = Array.from({ length: 10 }, () => Array(64).fill(-82));
  history[4][24] = -45;
  assert.deepEqual(detectNarrowPeaks(history), []);
});

test("a flat-topped resonance produces one candidate instead of duplicate adjacent warnings", () => {
  const history = Array.from({ length: 10 }, () => {
    const values = Array(64).fill(-82);
    values[24] = -56;
    values[25] = -56;
    return values;
  });
  const candidates = detectNarrowPeaks(history);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].index, 24);
});

test("persistence follows each frame's local floor when ambient level changes", () => {
  const history = Array.from({ length: 10 }, (_, index) => {
    const floor = -84 + index * 1.1;
    return frameWithPeak(24, floor, floor + 15);
  });
  const candidates = detectNarrowPeaks(history);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].persistence, 100);
});

test("short, too-small and mostly invalid histories fail safely", () => {
  assert.deepEqual(detectNarrowPeaks([]), []);
  assert.deepEqual(detectNarrowPeaks(Array.from({ length: 5 }, () => frameWithPeak())), []);
  assert.deepEqual(detectNarrowPeaks(Array.from({ length: 10 }, () => Array(8).fill(-80))), []);
  const invalid = Array.from({ length: 10 }, () => Array(64).fill(Number.NaN));
  assert.deepEqual(detectNarrowPeaks(invalid), []);
});
