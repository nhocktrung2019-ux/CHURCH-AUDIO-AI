import { logBandFrequency } from "./acoustics";

export type FeedbackCandidate = {
  index: number;
  frequencyHz: number;
  prominenceDb: number;
  levelDb: number;
  recommendedCutDb: number;
  q: number;
  stabilityPercent: number;
  confirmations: number;
  confidence: "medium" | "high";
};

type DetectionOptions = {
  minimumProminenceDb?: number;
  minimumLevelDb?: number;
  minimumStableRatio?: number;
};

function median(values: number[]): number {
  if (!values.length) return -100;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Finds persistent narrow-band peaks in recent RTA frames.
 * This is a feedback-risk advisory, not proof of an acoustic feedback loop.
 */
export function detectNarrowPeaks(
  history: number[][],
  options: DetectionOptions = {},
): FeedbackCandidate[] {
  const minimumFrames = 6;
  if (history.length < minimumFrames) return [];

  const frames = history.slice(-10);
  const count = Math.min(...frames.map((frame) => frame.length));
  if (count < 12) return [];

  const minimumProminenceDb = options.minimumProminenceDb ?? 6;
  const minimumLevelDb = options.minimumLevelDb ?? -65;
  const minimumStableRatio = options.minimumStableRatio ?? 0.65;
  const found: FeedbackCandidate[] = [];

  for (let index = 2; index < count - 2; index++) {
    const samples = frames.flatMap((frame) => {
      const center = frame[index];
      const neighbors = [frame[index - 2], frame[index - 1], frame[index + 1], frame[index + 2]]
        .filter(Number.isFinite);
      if (!Number.isFinite(center) || neighbors.length < 3) return [];
      const local = neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length;
      return [{ level: center, prominence: center - local }];
    });

    if (samples.length < minimumFrames) continue;
    const levelDb = median(samples.map((sample) => sample.level));
    const prominenceDb = median(samples.map((sample) => sample.prominence));
    const confirmations = samples.filter((sample) => sample.prominence >= minimumProminenceDb * 0.55).length;
    const stability = confirmations / samples.length;

    if (
      prominenceDb < minimumProminenceDb ||
      levelDb < minimumLevelDb ||
      stability < minimumStableRatio
    ) continue;

    // Conservative PEQ starting point only; never written to a hardware DSP automatically.
    const recommendedCutDb = -Math.min(6, Math.max(3, Math.round((prominenceDb - 2) * 0.45)));
    found.push({
      index,
      frequencyHz: Math.round(logBandFrequency(index, count)),
      prominenceDb: Math.round(prominenceDb * 10) / 10,
      levelDb: Math.round(levelDb * 10) / 10,
      recommendedCutDb,
      q: 8,
      stabilityPercent: Math.round(stability * 100),
      confirmations,
      confidence: stability >= 0.85 && prominenceDb >= 9 ? "high" : "medium",
    });
  }

  return found.sort((a, b) => b.prominenceDb - a.prominenceDb).slice(0, 5);
}
