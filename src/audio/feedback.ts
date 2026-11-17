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

function median(values: number[]): number {
  if (!values.length) return -100;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : ((sorted[middle - 1] ?? -100) + (sorted[middle] ?? -100)) / 2;
}

/**
 * Finds narrow peaks that persist across recent RTA frames.
 * Persistence is measured against each frame's own neighboring-band floor,
 * so slow changes in room noise do not masquerade as feedback instability.
 *
 * A single-microphone spectrum cannot prove an acoustic feedback loop;
 * results are conservative advisory candidates and never auto-applied.
 */
export function detectNarrowPeaks(history: number[][]): FeedbackCandidate[] {
  if (!Array.isArray(history)) return [];
  const frames = history.slice(-10).filter((frame) => Array.isArray(frame));
  if (frames.length < 6) return [];

  const count = Math.min(...frames.map((frame) => frame.length));
  if (!Number.isFinite(count) || count < 16) return [];

  const profiles = Array.from({ length: count }, (_, index) => (
    median(frames.map((frame) => frame[index]).filter(Number.isFinite))
  ));

  const found: FeedbackCandidate[] = [];
  for (let i = 2; i < count - 2; i++) {
    const peakLevel = profiles[i];
    const neighbors = [profiles[i - 2], profiles[i - 1], profiles[i + 1], profiles[i + 2]];
    if (!Number.isFinite(peakLevel) || neighbors.some((value) => !Number.isFinite(value))) continue;

    // Keep one representative for a flat-topped peak and reject non-maxima.
    if (!(peakLevel > profiles[i - 1] && peakLevel >= profiles[i + 1])) continue;

    const localFloor = median(neighbors);
    const prominence = peakLevel - localFloor;
    if (prominence < 5.5 || peakLevel < -68) continue;

    let validFrames = 0;
    let persistentFrames = 0;
    for (const frame of frames) {
      const center = frame[i];
      const frameNeighbors = [frame[i - 2], frame[i - 1], frame[i + 1], frame[i + 2]]
        .filter(Number.isFinite);
      if (!Number.isFinite(center) || frameNeighbors.length < 3) continue;
      validFrames++;
      if (center >= median(frameNeighbors) + 4) persistentFrames++;
    }

    // Do not report high confidence from a mostly missing/corrupt history.
    if (validFrames < Math.max(6, Math.ceil(frames.length * 0.6))) continue;
    const persistence = persistentFrames / validFrames;
    if (persistence < 0.65) continue;

    let left = i;
    let right = i;
    const halfProminence = peakLevel - Math.max(2, prominence * 0.5);
    while (left > 1 && profiles[left - 1] >= halfProminence) left--;
    while (right < count - 2 && profiles[right + 1] >= halfProminence) right++;

    const bandwidthOctaves = Math.max(
      1 / count,
      ((right - left + 1) / count) * Math.log2(1000),
    );
    const qDenominator = Math.pow(2, bandwidthOctaves / 2) - Math.pow(2, -bandwidthOctaves / 2);
    const q = Math.max(2, Math.min(12, qDenominator > 0 ? 1 / qDenominator : 12));
    const confidence = persistence >= 0.85 && prominence >= 8 ? "high" : "medium";

    found.push({
      index: i,
      frequencyHz: Math.round(logBandFrequency(i, count)),
      prominenceDb: Math.round(prominence * 10) / 10,
      levelDb: Math.round(peakLevel * 10) / 10,
      // Conservative starting point: confirm by listening and channel isolation first.
      recommendedCutDb: -Math.min(4, Math.max(1.5, Math.round(prominence * 0.35 * 10) / 10)),
      q: Math.round(q * 10) / 10,
      persistence: Math.round(persistence * 100),
      confidence,
    });
  }

  // Rank the strongest candidates first; nearby bins are retained only when
  // they are distinct local maxima, rather than duplicate bins on one plateau.
  return found.sort((a, b) => b.prominenceDb - a.prominenceDb).slice(0, 6);
}
