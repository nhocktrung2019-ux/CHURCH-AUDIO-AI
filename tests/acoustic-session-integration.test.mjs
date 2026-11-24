import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAcousticSnapshot } from "../src/audio/acousticDiagnostics.ts";

test("reports a complete diagnostic summary when independent module results are supplied", () => {
  const spectrum = Array.from({ length: 25 }, (_, index) => ({
    frequencyHz: 30 * 10 ** (index / 24 * 2.7),
    levelDb: -30 - (index % 4),
    evidence: "measured" as const,
  }));
  const rt60Bands = [125, 250, 500, 1000, 2000, 4000].map((centerHz) => ({
    centerHz, rt20Seconds: 0.8, rt30Seconds: 0.8, rt60Seconds: 0.8, fitR2: 0.9,
  }));
  const transferPoints = Array.from({ length: 20 }, (_, index) => ({
    frequencyHz: 100 + index * 200, magnitudeDb: -2, coherence: 0.9,
  }));
  const report = analyzeAcousticSnapshot({ spectrum, rt60Bands, transferPoints });
  assert.equal(report.measuredBinCount, 25);
  assert.equal(report.rt60.validBandCount, 6);
  assert.equal(report.rt60.medianSeconds, 0.8);
  assert.equal(report.transfer.validPointCount, 20);
  assert.equal(report.transfer.averageCoherence, 0.9);
  assert.equal(report.transfer.reliableBandPercent, 100);
});

test("does not mark calibrated SPL merely because frequency response and transfer data exist", () => {
  const report = analyzeAcousticSnapshot({
    spectrum: Array.from({ length: 20 }, (_, index) => ({
      frequencyHz: 100 + index * 500, levelDb: -24, evidence: "measured" as const,
    })),
    rt60Bands: [{ centerHz: 1000, rt20Seconds: 0.7, rt30Seconds: 0.7, rt60Seconds: 0.7, fitR2: 0.9 }],
    transferPoints: [{ frequencyHz: 1000, magnitudeDb: -2, coherence: 0.95 }],
  });
  assert.equal(report.splStatus, "unavailable");
});

test("rejects malformed RT60 and transfer values rather than propagating NaN", () => {
  const report = analyzeAcousticSnapshot({
    spectrum: [],
    rt60Bands: [
      { centerHz: 1000, rt20Seconds: null, rt30Seconds: null, rt60Seconds: Number.NaN, fitR2: 0.99 },
      { centerHz: 0, rt20Seconds: 0.4, rt30Seconds: 0.4, rt60Seconds: 0.4, fitR2: 0.99 },
    ],
    transferPoints: [
      { frequencyHz: 1000, magnitudeDb: Number.NaN, coherence: 0.9 },
      { frequencyHz: 1000, magnitudeDb: -2, coherence: 1.5 },
    ],
  });
  assert.equal(report.rt60.validBandCount, 0);
  assert.equal(report.transfer.validPointCount, 0);
  assert.equal(report.transfer.averageCoherence, null);
  assert.equal(report.status, "insufficient-data");
});
