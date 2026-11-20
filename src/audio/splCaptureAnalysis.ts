export type CaptureWeighting = "A" | "C" | "Z";
export type CaptureAnalysisStatus = "valid" | "uncalibrated" | "clipped" | "invalid";

export type SplCaptureMetadata = {
  sampleRateHz: number;
  weighting: CaptureWeighting;
  /** True only when the supplied PCM has already passed through the named weighting filter. */
  weightingApplied: boolean;
  /** Calibrated dB SPL minus measured dBFS for this exact mic/interface/gain chain. */
  calibrationOffsetDb: number | null;
  inputLabel: string;
  capturedAt?: string;
};

export type SplCaptureAnalysis = {
  status: CaptureAnalysisStatus;
  sampleCount: number;
  sampleRateHz: number;
  weighting: CaptureWeighting;
  weightingApplied: boolean;
  inputLabel: string;
  capturedAt: string | null;
  rmsDbfs: number | null;
  peakDbfs: number | null;
  splDb: number | null;
  calibrationOffsetDb: number | null;
  clippingRatio: number;
  warnings: string[];
};

const MIN_SAMPLE_RATE = 8_000;
const MAX_SAMPLE_RATE = 384_000;
const MIN_SAMPLE_COUNT = 128;
const CLIP_THRESHOLD = 0.999;
const MAX_CLIPPING_RATIO = 0.001;

function invalid(
  metadata: SplCaptureMetadata,
  sampleCount: number,
  warning: string,
): SplCaptureAnalysis {
  return {
    status: "invalid",
    sampleCount,
    sampleRateHz: metadata.sampleRateHz,
    weighting: metadata.weighting,
    weightingApplied: metadata.weightingApplied,
    inputLabel: metadata.inputLabel,
    capturedAt: metadata.capturedAt ?? null,
    rmsDbfs: null,
    peakDbfs: null,
    splDb: null,
    calibrationOffsetDb: metadata.calibrationOffsetDb,
    clippingRatio: 0,
    warnings: [warning],
  };
}

/**
 * Analyze a mono, normalized Float32 PCM buffer that has already been captured.
 *
 * This function does not access a microphone and does not implement A/C filters.
 * A/C input must therefore be pre-weighted by the capture pipeline. Z weighting
 * may use the unweighted PCM stream. An SPL value is emitted only when a valid
 * calibration offset is supplied and the capture is not clipped.
 */
export function analyzeSplCapture(
  samples: ArrayLike<number>,
  metadata: SplCaptureMetadata,
): SplCaptureAnalysis {
  const count = samples?.length ?? 0;
  if (!Number.isInteger(metadata.sampleRateHz)
    || metadata.sampleRateHz < MIN_SAMPLE_RATE
    || metadata.sampleRateHz > MAX_SAMPLE_RATE) {
    return invalid(metadata, count, "Sample rate must be between 8 kHz and 384 kHz.");
  }
  if (!(metadata.weighting === "A" || metadata.weighting === "C" || metadata.weighting === "Z")) {
    return invalid(metadata, count, "Unsupported frequency weighting.");
  }
  if (metadata.weighting !== "Z" && metadata.weightingApplied !== true) {
    return invalid(metadata, count, "A/C-weighted SPL requires PCM already processed by the matching weighting filter.");
  }
  if (count < MIN_SAMPLE_COUNT) {
    return invalid(metadata, count, "At least 128 PCM samples are required.");
  }
  const offset = metadata.calibrationOffsetDb;
  if (offset !== null && (!Number.isFinite(offset) || offset < -100 || offset > 200)) {
    return invalid(metadata, count, "Calibration offset is outside the supported range.");
  }

  let sum = 0;
  let peak = 0;
  let clipped = 0;
  for (let index = 0; index < count; index++) {
    const sample = samples[index];
    if (!Number.isFinite(sample) || Math.abs(sample) > 1.000001) {
      return invalid(metadata, count, "PCM contains non-finite or out-of-range samples.");
    }
    sum += sample;
    peak = Math.max(peak, Math.abs(sample));
    if (Math.abs(sample) >= CLIP_THRESHOLD) clipped++;
  }

  const dc = sum / count;
  let squareSum = 0;
  for (let index = 0; index < count; index++) {
    const centered = samples[index] - dc;
    squareSum += centered * centered;
  }
  const rms = Math.sqrt(squareSum / count);
  if (!Number.isFinite(rms) || rms <= 0) {
    return invalid(metadata, count, "Capture is silent or has no measurable AC energy.");
  }

  const rmsDbfs = 20 * Math.log10(rms);
  const peakDbfs = peak > 0 ? 20 * Math.log10(peak) : null;
  const clippingRatio = clipped / count;
  const warnings: string[] = [];
  if (metadata.weighting === "Z" && !metadata.weightingApplied) {
    warnings.push("Z result uses the unweighted PCM stream; verify the input chain has no unintended filtering.");
  }
  if (clippingRatio > MAX_CLIPPING_RATIO) {
    warnings.push("Capture clipping exceeds 0.1%; SPL result is withheld.");
  }
  if (offset === null) {
    warnings.push("No calibration offset supplied; result remains dBFS and is not reported as dB SPL.");
  }

  const status: CaptureAnalysisStatus = clippingRatio > MAX_CLIPPING_RATIO
    ? "clipped"
    : offset === null ? "uncalibrated" : "valid";

  return {
    status,
    sampleCount: count,
    sampleRateHz: metadata.sampleRateHz,
    weighting: metadata.weighting,
    weightingApplied: metadata.weightingApplied,
    inputLabel: metadata.inputLabel,
    capturedAt: metadata.capturedAt ?? null,
    rmsDbfs,
    peakDbfs,
    splDb: status === "valid" ? rmsDbfs + (offset as number) : null,
    calibrationOffsetDb: offset,
    clippingRatio,
    warnings,
  };
}
