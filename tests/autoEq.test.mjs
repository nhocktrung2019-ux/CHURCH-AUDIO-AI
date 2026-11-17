import test from "node:test";
import assert from "node:assert/strict";
import { assessAutoEqReadiness, suggestParametricEq } from "../src/audio/autoEq.ts";

function smoothResponse() {
  const points = [];
  for (let frequencyHz = 100; frequencyHz <= 8000; frequencyHz += 25) {
    const octaves = Math.log2(frequencyHz / 1000);
    const peak = 8 * Math.exp(-0.5 * (octaves / 0.11) ** 2);
    points.push({ frequencyHz, magnitudeDb: peak, coherence: 0.96 });
  }
  return points;
}

test("Auto EQ readiness rejects too few bins", () => {
  const points = smoothResponse().slice(0, 12);
  assert.equal(assessAutoEqReadiness(points).ready, false);
  assert.deepEqual(suggestParametricEq(points), []);
});

test("Auto EQ readiness rejects weak coherence coverage", () => {
  const points = smoothResponse().map((point, index) => ({
    ...point,
    coherence: index % 3 === 0 ? 0.92 : 0.45,
  }));
  const readiness = assessAutoEqReadiness(points);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.coherentPercent < 60);
  assert.deepEqual(suggestParametricEq(points), []);
});

test("a coherent narrow resonance produces a bounded cut-only PEQ suggestion", () => {
  const points = smoothResponse();
  const readiness = assessAutoEqReadiness(points);
  assert.equal(readiness.ready, true);
  const filters = suggestParametricEq(points);
  assert.ok(filters.length >= 1);
  const filter = filters.find((candidate) => Math.abs(candidate.frequencyHz - 1000) < 100);
  assert.ok(filter);
  assert.ok(filter.gainDb < 0);
  assert.ok(filter.gainDb >= -4);
  assert.ok(filter.q >= 0.7 && filter.q <= 10);
  assert.ok(filter.coherence >= 0.8);
});

test("Auto EQ never creates boosts and separates nearby duplicate peaks", () => {
  const filters = suggestParametricEq(smoothResponse());
  assert.ok(filters.every((filter) => filter.gainDb <= 0));
  assert.ok(filters.length <= 6);
  for (let i = 1; i < filters.length; i++) {
    assert.ok(Math.abs(Math.log2(filters[i].frequencyHz / filters[i - 1].frequencyHz)) > 1 / 3);
  }
});

test("invalid and out-of-band values cannot qualify as measurement bins", () => {
  const points = Array.from({ length: 40 }, (_, index) => ({
    frequencyHz: index < 20 ? 20 : Number.NaN,
    magnitudeDb: Number.POSITIVE_INFINITY,
    coherence: 1.2,
  }));
  assert.equal(assessAutoEqReadiness(points).ready, false);
});
