import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAcousticSnapshot } from "../src/audio/acousticDiagnostics.ts";

function spectrum(levels = [-20, -20, -20, -20, -20]) {
  const ranges = [[25, 40, 63, 90, 110], [150, 200, 300, 400, 480], [600, 800, 1000, 1400, 1800],
    [2200, 3000, 4000, 5000, 5800], [6500, 8000, 10000, 14000, 18000]];
  return ranges.flatMap((frequencies, band) => frequencies.map((frequencyHz, index) => ({
    frequencyHz, levelDb: levels[band] ?? -20, evidence: "measured",
  })));
}

test("summarizes measured spectrum by band and keeps SPL status separate", () => {
  const report = analyzeAcousticSnapshot({
    spectrum: spectrum(),
    capture: { sampleRate: 48000, rmsDbfs: -20, peakDbfs: -3, clippedSamplePercent: 0, invalidSamplePercent: 0, calibratedSpl: false },
  });
  assert.equal(report.status, "ready");
  assert.equal(report.measuredBinCount, 25);
  assert.equal(report.splStatus, "uncalibrated");
  assert.equal(report.spectrumBands.length, 5);
  assert.ok(report.spectrumBands.every((band) => band.binCount === 5 && band.energyAverageDb !== null));
  assert.ok(report.findings.some((item) => item.code === "spl-not-calibrated"));
});

test("excludes simulated, manual, invalid and out-of-range spectrum bins", () => {
  const report = analyzeAcousticSnapshot({ spectrum: [
    ...spectrum(),
    { frequencyHz: 1000, levelDb: 90, evidence: "simulated" },
    { frequencyHz: 2000, levelDb: 90, evidence: "manual" },
    { frequencyHz: 3000, levelDb: Number.NaN, evidence: "measured" },
    { frequencyHz: 50000, levelDb: 90, evidence: "measured" },
  ] });
  assert.equal(report.measuredBinCount, 25);
  assert.equal(report.excludedBinCount, 4);
  assert.ok(report.findings.some((item) => item.code === "spectrum-excluded"));
});

test("flags low-frequency build-up and high-frequency rolloff without prescribing EQ", () => {
  const report = analyzeAcousticSnapshot({ spectrum: spectrum([-5, -7, -17, -17, -29]) });
  assert.ok(report.findings.some((item) => item.code === "low-frequency-build-up"));
  assert.ok(report.findings.some((item) => item.code === "high-frequency-rolloff"));
  assert.ok(report.findings.every((item) => !item.action.toLowerCase().includes("auto apply")));
});

test("summarizes only RT60 bands with valid decay fit and reports frequency variation", () => {
  const report = analyzeAcousticSnapshot({
    spectrum: spectrum(),
    rt60Bands: [
      { centerHz: 125, rt20Seconds: 1.8, rt30Seconds: 1.7, rt60Seconds: 1.7, fitR2: 0.92 },
      { centerHz: 250, rt20Seconds: 1.5, rt30Seconds: 1.4, rt60Seconds: 1.4, fitR2: 0.9 },
      { centerHz: 500, rt20Seconds: 0.9, rt30Seconds: 0.8, rt60Seconds: 0.8, fitR2: 0.88 },
      { centerHz: 1000, rt20Seconds: 0.7, rt30Seconds: 0.6, rt60Seconds: 0.6, fitR2: 0.8 },
      { centerHz: 2000, rt20Seconds: 0.5, rt30Seconds: null, rt60Seconds: 0.5, fitR2: 0.7 },
    ],
  });
  assert.equal(report.rt60.validBandCount, 4);
  assert.equal(report.rt60.minimumSeconds, 0.6);
  assert.equal(report.rt60.maximumSeconds, 1.7);
  assert.ok(report.findings.some((item) => item.code === "rt60-frequency-variation"));
});

test("flags low coherence and unsafe PCM capture quality", () => {
  const report = analyzeAcousticSnapshot({
    spectrum: spectrum(),
    transferPoints: Array.from({ length: 10 }, (_, index) => ({
      frequencyHz: 100 + index * 100, magnitudeDb: -3, coherence: 0.45,
    })),
    capture: { sampleRate: 48000, rmsDbfs: -20, peakDbfs: 0.2, clippedSamplePercent: 1, invalidSamplePercent: 0, calibratedSpl: true, calibrationId: "cal-1" },
  });
  assert.ok(report.findings.some((item) => item.code === "transfer-low-coherence"));
  assert.ok(report.findings.some((item) => item.code === "capture-quality-fail" && item.severity === "critical"));
  assert.equal(report.status, "limited");
});

test("returns insufficient-data when all available evidence is missing or simulated", () => {
  const report = analyzeAcousticSnapshot({
    spectrum: [{ frequencyHz: 1000, levelDb: 85, evidence: "simulated" }],
  });
  assert.equal(report.status, "insufficient-data");
  assert.equal(report.measuredBinCount, 0);
  assert.equal(report.splStatus, "unavailable");
  assert.ok(report.findings.some((item) => item.code === "rt60-unavailable"));
});
