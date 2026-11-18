import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSPLZones } from "../src/audio/splZones.ts";

const reading = (zone, levelDb) => ({
  id: zone, zone, levelDb, capturedAt: "2026-11-18T00:00:00.000Z", calibrated: true,
});

test("summarizes min, max, spread and median target for multiple zones", () => {
  const result = summarizeSPLZones([
    reading("Khu 1", 80), reading("Khu 2", 86), reading("Khu 3", 82),
  ]);
  assert.equal(result.count, 3);
  assert.equal(result.minimumDb, 80);
  assert.equal(result.maximumDb, 86);
  assert.equal(result.spreadDb, 6);
  assert.equal(result.targetDb, 82);
  assert.equal(result.recommendations[0].gainSuggestionDb, 2);
  assert.equal(result.recommendations[1].gainSuggestionDb, -4);
});

test("uses an energy average rather than arithmetic decibel average", () => {
  const result = summarizeSPLZones([reading("A", 80), reading("B", 80)]);
  assert.ok(Math.abs(result.energyAverageDb - 80) < 1e-10);
});

test("caps gain suggestions and ignores invalid readings", () => {
  const result = summarizeSPLZones([
    reading("Quiet", 60), reading("Loud", 90),
    { ...reading("Invalid", Number.NaN) },
  ]);
  assert.equal(result.count, 2);
  assert.equal(result.recommendations[0].gainSuggestionDb, 6);
  assert.equal(result.recommendations[1].gainSuggestionDb, -6);
});

test("returns null when there are no valid zone readings", () => {
  assert.equal(summarizeSPLZones([]), null);
  assert.equal(summarizeSPLZones([reading("bad", Number.NaN)]), null);
});
