import { logBandFrequency } from "./acoustics";

export type FeedbackCandidate = {
  index: number;
  frequencyHz: number;
  prominenceDb: number;
  levelDb: number;
  recommendedCutDb: number;
  q: number;
  persistence: number;
  confidence: "medium" | "high";
};

/**
 * Finds narrow peaks that persist across recent RTA frames.
 * A single-microphone spectrum cannot prove an acoustic feedback loop;
 * this deliberately returns conservative advisory candidates only.
 */
export function detectNarrowPeaks(history: number[][]): FeedbackCandidate[] {
  if (history.length < 6) return [];
  const frames = history.slice(-10);
  const count = Math.min(...frames.map(frame => frame.length));
  if (count < 16) return [];

  const profiles = Array.from({ length: count }, (_, index) => {
    const values = frames.map(frame => frame[index]).filter(Number.isFinite).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : ((values[middle - 1] ?? -100) + (values[middle] ?? -100)) / 2;
  });

  const found: FeedbackCandidate[] = [];
  for (let i = 2; i < count - 2; i++) {
    const localFloor = (profiles[i - 2] + profiles[i - 1] + profiles[i + 1] + profiles[i + 2]) / 4;
    const prominence = profiles[i] - localFloor;
    const persistence = frames.filter(frame => Number.isFinite(frame[i]) && frame[i] >= localFloor + 4).length / frames.length;
    if (prominence < 5.5 || persistence < 0.65 || profiles[i] < -68) continue;

    let left = i, right = i;
    const halfProminence = profiles[i] - Math.max(2, prominence * 0.5);
    while (left > 1 && profiles[left - 1] >= halfProminence) left--;
    while (right < count - 2 && profiles[right + 1] >= halfProminence) right++;
    const bandwidthOctaves = Math.max(1 / count, (right - left + 1) / count * Math.log2(1000));
    const q = Math.max(2, Math.min(12, 1 / (Math.pow(2, bandwidthOctaves / 2) - Math.pow(2, -bandwidthOctaves / 2))));
    const confidence = persistence >= 0.85 && prominence >= 8 ? "high" : "medium";

    found.push({
      index: i,
      frequencyHz: Math.round(logBandFrequency(i, count)),
      prominenceDb: Math.round(prominence * 10) / 10,
      levelDb: Math.round(profiles[i] * 10) / 10,
      // Conservative starting point: confirm by listening and channel isolation first.
      recommendedCutDb: -Math.min(4, Math.max(1.5, Math.round(prominence * 0.35 * 10) / 10)),
      q: Math.round(q * 10) / 10,
      persistence: Math.round(persistence * 100),
      confidence,
    });
  }
  return found.sort((a, b) => b.prominenceDb - a.prominenceDb).slice(0, 6);
}
