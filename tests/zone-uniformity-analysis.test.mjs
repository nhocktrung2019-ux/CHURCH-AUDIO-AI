import test from "node:test";
import assert from "node:assert/strict";
import { analyzeZoneUniformity } from "../src/audio/zoneUniformityAnalysis.ts";

const reading = (overrides = {}) => ({
  id: "r1", zoneId: "zone-a", pointId: "seat-1", sessionId: "session-1",
  value: 80, unit: "dB_SPL", evidence: "measured", calibrationStatus: "valid",
  calibrationId: "cal-1", weighting: "A", timeWeighting: "Slow", ...overrides,
});

test("summarizes two calibrated zones and preserves measurement context", () => {
  const result = analyzeZoneUniformity([
    reading(),
    reading({ id: "r2", zoneId: "zone-b", pointId: "seat-2", value: 86 }),
  ]);
  assert.equal(result.status, "ready");
  assert.equal(result.zoneCount, 2);
  assert.equal(result.acceptedReadingCount, 2);
  assert.equal(result.spreadDb, 6);
  assert.equal(result.sessionId, "session-1");
  assert.equal(result.calibrationId, "cal-1");
});

test("energy-averages repeat captures at each point before comparing zones", () => {
  const result = analyzeZoneUniformity([
    reading({ id: "a1", value: 80 }),
    reading({ id: "a2", value: 80, zoneId: "zone-a", pointId: "seat-1" }),
    reading({ id: "b1", value: 86, zoneId: "zone-b", pointId: "seat-2" }),
    reading({ id: "b2", value: 86, zoneId: "zone-b", pointId: "seat-2" }),
  ]);
  assert.equal(result.status, "ready");
  assert.equal(result.zones[0].repeatCount, 2);
  assert.equal(result.zones[1].pointCount, 1);
  assert.ok(Math.abs((result.spreadDb ?? 0) - 6) < 1e-9);
});

test("excludes dBFS, manual, simulated and uncalibrated readings", () => {
  const result = analyzeZoneUniformity([
    reading(),
    reading({ id: "b", zoneId: "zone-b", pointId: "seat-2", value: 85 }),
    reading({ id: "c", unit: "dBFS", zoneId: "zone-c", pointId: "seat-3" }),
    reading({ id: "d", evidence: "manual", zoneId: "zone-d", pointId: "seat-4" }),
    reading({ id: "e", evidence: "simulated", zoneId: "zone-e", pointId: "seat-5" }),
    reading({ id: "f", calibrationStatus: "missing", calibrationId: null, zoneId: "zone-f", pointId: "seat-6" }),
  ]);
  assert.equal(result.status, "ready");
  assert.equal(result.acceptedReadingCount, 2);
  assert.equal(result.rejectedReadingCount, 4);
  assert.equal(result.zoneCount, 2);
});

test("rejects mixing sessions, weighting, time weighting or calibration chains", () => {
  for (const change of [
    { sessionId: "session-2" },
    { weighting: "C" },
    { timeWeighting: "Fast" },
    { calibrationId: "cal-2" },
  ]) {
    const result = analyzeZoneUniformity([
      reading(),
      reading({ id: "b", zoneId: "zone-b", pointId: "seat-2", ...change }),
    ]);
    assert.equal(result.status, "incompatible-measurements");
    assert.equal(result.acceptedReadingCount, 0);
  }
});

test("requires two distinct zones and rejects out-of-range values", () => {
  const oneZone = analyzeZoneUniformity([
    reading(), reading({ id: "r2", value: 82, pointId: "seat-2" }),
  ]);
  assert.equal(oneZone.status, "insufficient-data");
  assert.equal(oneZone.zoneCount, 0);

  const invalid = analyzeZoneUniformity([
    reading({ value: 10 }),
    reading({ id: "r2", zoneId: "zone-b", pointId: "seat-2", value: 150 }),
  ]);
  assert.equal(invalid.status, "insufficient-data");
  assert.equal(invalid.acceptedReadingCount, 0);
});
