import test from "node:test";
import assert from "node:assert/strict";
import { analyzeZoneFrequencyResponse } from "../src/audio/zoneFrequencyResponse.ts";

const points = (offset = 0, spread = 0) => [100, 200, 400, 800].map((frequencyHz, i) => ({
  frequencyHz, magnitudeDb: offset + i + spread, phaseDeg: 0, coherence: 0.95,
}));
const set = (zone, offset = 0, chain = "mic-a|gain-fixed", repeatOffsets = [0, 0.2, -0.2]) => ({
  zone, inputChainId: chain, sampleRate: 48000,
  captures: repeatOffsets.map((value, index) => ({
    id: zone + index, capturedAt: "2026-11-18T00:00:00.000Z", points: points(offset, value),
  })),
});

test("compares zones only after three repeat captures on a matching chain", () => {
  const result = analyzeZoneFrequencyResponse([set("Main", 0), set("Balcony", 2)]);
  assert.equal(result.ready, true);
  assert.equal(result.zoneCount, 2);
  assert.equal(result.frequencyBins[0].spatialSpreadDb, 2);
  assert.equal(result.frequencyBins[0].status, "comparable");
});

test("rejects mixed input chains and duplicate zone names", () => {
  assert.match(analyzeZoneFrequencyResponse([set("Main"), set("Balcony", 1, "other-chain")]).reason, /cùng chuỗi đo/);
  assert.match(analyzeZoneFrequencyResponse([set("Main"), set("main")]).reason, /không được trùng/);
});

test("requires three repeats for every zone", () => {
  const result = analyzeZoneFrequencyResponse([set("Main"), set("Balcony", 1, "mic-a|gain-fixed", [0, 0.1])]);
  assert.equal(result.ready, false);
  assert.match(result.reason, /ít nhất 3 lần/);
});

test("excludes bins with unstable repeated measurements", () => {
  const result = analyzeZoneFrequencyResponse([
    set("Main", 0, "mic-a|gain-fixed", [0, 0.1, 5]),
    set("Balcony", 1),
  ]);
  assert.equal(result.excludedRepeatBins, 4);
  assert.equal(result.ready, false);
});

test("marks excessive spatial response variation rather than hiding it", () => {
  const result = analyzeZoneFrequencyResponse([set("Main"), set("Balcony", 10)]);
  assert.equal(result.frequencyBins[0].status, "spatial-variance");
  assert.equal(result.frequencyBins[0].spatialSpreadDb, 10);
});

test("rejects inconsistent sample rates", () => {
  const a = set("Main");
  const b = set("Balcony");
  b.sampleRate = 44100;
  assert.equal(analyzeZoneFrequencyResponse([a, b]).ready, false);
});
