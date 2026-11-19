import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFeedbackRisk, buildFeedbackAlertHistory } from "../src/audio/feedbackRiskAnalysis.ts";

function makeFrames({ frequencyHz = 1000, peakDbfs = -25, noiseFloorDbfs = -75, frames = 8, zone = "Main", position = "Seat 1", drift = 0 } = {}) {
  const bins = Array.from({ length: 64 }, (_, i) => 100 + i * 50);
  return Array.from({ length: frames }, (_, frame) => {
    const target = frequencyHz * (1 + (frame % 2 ? drift : -drift));
    const index = bins.reduce((best, f, i) => Math.abs(f - target) < Math.abs(bins[best] - target) ? i : best, 0);
    const magnitude = bins.map((_, i) => -55 - Math.abs(i - index) * 2);
    magnitude[index] = peakDbfs;
    return {
      id: "frame-" + frame, zone, position, capturedAtMs: frame * 50 + 100,
      frequencyBinsHz: bins, magnitudeDbfs: magnitude, noiseFloorDbfs,
    };
  });
}

test("flags a narrow persistent stable spectral peak as high feedback risk", () => {
  const result = analyzeFeedbackRisk(makeFrames());
  assert.equal(result.status, "alert");
  assert.ok(result.candidates[0].frequencyHz > 0);
  assert.equal(result.candidates[0].risk, "high");
  assert.equal(result.unit, "dBFS");
});

test("does not alert on a transient narrow peak", () => {
  const frames = makeFrames();
  frames[0].magnitudeDbfs[18] = -10;
  const result = analyzeFeedbackRisk(frames);
  assert.equal(result.status, "clear");
});

test("rejects mixed zones and inconsistent frequency grids", () => {
  const mixed = makeFrames();
  mixed[3] = { ...mixed[3], zone: "Balcony" };
  assert.equal(analyzeFeedbackRisk(mixed).status, "blocked");
  const mismatched = makeFrames();
  mismatched[2] = { ...mismatched[2], frequencyBinsHz: mismatched[2].frequencyBinsHz.map((f, i) => i === 10 ? f + 2 : f) };
  assert.equal(analyzeFeedbackRisk(mismatched).status, "blocked");
});

test("returns clear when no narrow peak exceeds the prominence threshold", () => {
  const frames = makeFrames();
  for (const frame of frames) frame.magnitudeDbfs = frame.magnitudeDbfs.map((_, i) => -40 - (i % 3));
  assert.equal(analyzeFeedbackRisk(frames).status, "clear");
});

test("creates raised, sustained and cleared alert events after clear-window hysteresis", () => {
  const raised = analyzeFeedbackRisk(makeFrames());
  const clearFrames = makeFrames();
  for (const frame of clearFrames) frame.magnitudeDbfs = frame.magnitudeDbfs.map((_, i) => -40 - (i % 3));
  const clear = analyzeFeedbackRisk(clearFrames);
  const history = buildFeedbackAlertHistory([raised, raised, clear, clear, clear], 3);
  assert.equal(history[0].event, "raised");
  assert.ok(history.some(event => event.event === "sustained"));
  assert.ok(history.some(event => event.event === "cleared"));
});
