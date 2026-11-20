export type LiveSplWeighting = "A" | "C" | "Z";
export type LiveSplCaptureInput = {
  running: boolean;
  weightedDbfs: number;
  calibrationOffsetDb: number;
  peakDbfs: number;
};
export type LiveSplCaptureResult = {
  status: "stopped" | "uncalibrated" | "clipped" | "invalid" | "valid";
  splDb: number | null;
};

/** Converts a live weighted dBFS reading only when the capture chain is active,
 * calibrated, finite and below the near-clipping guard.
 */
export function analyzeLiveSplCapture(input: LiveSplCaptureInput): LiveSplCaptureResult {
  if (!input.running) return { status: "stopped", splDb: null };
  if (!Number.isFinite(input.calibrationOffsetDb) || Math.abs(input.calibrationOffsetDb) <= 0.001) {
    return { status: "uncalibrated", splDb: null };
  }
  if (!Number.isFinite(input.peakDbfs) || input.peakDbfs >= -0.1) {
    return { status: "clipped", splDb: null };
  }
  if (!Number.isFinite(input.weightedDbfs) || input.weightedDbfs <= -99 || input.weightedDbfs > 0) {
    return { status: "invalid", splDb: null };
  }
  const splDb = input.weightedDbfs + input.calibrationOffsetDb;
  if (!Number.isFinite(splDb) || splDb < 0 || splDb > 160) {
    return { status: "invalid", splDb: null };
  }
  return { status: "valid", splDb };
}
