import type { PcmCaptureIntegritySnapshot } from "./pcmCaptureIntegrity";
import { micCorrectionAt, type MicCalibrationPoint } from "./micCalibration.ts";
import { estimateSynchronousRelativeDelay } from "./dualChannel.ts";

export type TransferPoint = { frequencyHz: number; magnitudeDb: number; phaseDeg: number; coherence: number };
export type PcmCaptureQuality = {
  peakDbfs: number;
  rmsDbfs: number;
  clippedSamplePercent: number;
  invalidSamplePercent: number;
  sampleCount: number;
};

export type TransferCaptureMetadata = {
  captureEngine: "AudioWorklet" | "ScriptProcessor fallback";
  inputChannelCount: number | null;
  pcmChannelCount: number;
  channelMix: "interleaved-preserved-then-arithmetic-mean" | "interleaved-preserved-synchronous-pair" | "arithmetic-mean" | "direct-mono";
  trackChannelCount: number | null;
  trackSampleRate: number | null;
  analysisMode?: "mono-acoustic" | "synchronous-dual-channel";
  referenceChannel?: number;
  measurementChannel?: number;
  clockBasis?: "same-mediastream-audioworklet-frame-clock";
  hardwareClockStatus?: "not-verified";
  pcmIntegrity?: PcmCaptureIntegritySnapshot | null;
  referenceCaptureQuality?: PcmCaptureQuality;
};

export type TransferResult = {
  points: TransferPoint[];
  estimatedDelayMs: number;
  confidence: number;
  averageCoherence: number;
  reliableBandPercent: number;
  sampleRate: number;
  framesAveraged: number;
  captureQuality?: PcmCaptureQuality;
  captureMetadata?: TransferCaptureMetadata;
  analysisMode?: "mono-acoustic" | "synchronous-dual-channel";
};

export function makeReferenceNoise(sampleRate: number, durationSeconds = 6): Float32Array {
  const count = Math.floor(sampleRate * durationSeconds);
  const output = new Float32Array(count);
  let seed = 0x13579bdf;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  let pink = 0, brown = 0;
  for (let i = 0; i < count; i++) {
    const white = random();
    pink = 0.985 * pink + 0.015 * white;
    brown = 0.999 * brown + 0.001 * white;
    output[i] = (0.58 * white + 0.32 * pink + 0.1 * brown) * 0.075;
  }
  return output;
}

function normalizedCorrelation(reference: Float32Array, recorded: Float32Array, lag: number, step: number, length: number): number {
  let xy = 0, xx = 0, yy = 0, count = 0;
  for (let i = 0; i < length; i += step) {
    const j = i + lag;
    if (j < 0 || j >= recorded.length) continue;
    const x = reference[i], y = recorded[j];
    xy += x * y; xx += x * x; yy += y * y; count++;
  }
  return count && xx > 1e-15 && yy > 1e-15 ? xy / Math.sqrt(xx * yy) : 0;
}
function decimateForLag(samples: Float32Array, factor: number): Float32Array {
  const count = Math.floor(samples.length / factor);
  const output = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    let sum = 0;
    const offset = index * factor;
    for (let sample = 0; sample < factor; sample++) sum += samples[offset + sample];
    output[index] = sum / factor;
  }
  return output;
}

function bestLag(reference: Float32Array, recorded: Float32Array, sampleRate: number): { lag: number; score: number } {
  // Low-pass/decimate for a bounded coarse search. The fine search below still
  // checks every full-rate sample, so offsets need not align to the decimation grid.
  const factor = 16;
  const coarseReference = decimateForLag(reference, factor);
  const coarseRecorded = decimateForLag(recorded, factor);
  const limitSamples = Math.min(Math.floor(sampleRate * 0.75), Math.floor(recorded.length * 0.25));
  const limit = Math.floor(limitSamples / factor);
  const coarseLength = Math.min(coarseReference.length, Math.floor(sampleRate * 0.25 / factor));

  let coarseBest = 0;
  let coarseScore = 0;
  for (let lag = -limit; lag <= limit; lag++) {
    const value = Math.abs(normalizedCorrelation(coarseReference, coarseRecorded, lag, 1, coarseLength));
    if (value > coarseScore) {
      coarseScore = value;
      coarseBest = lag;
    }
  }

  // Refine around the nearest coarse delay using un-decimated samples.
  const fineLength = Math.min(reference.length, Math.floor(sampleRate * 1.5));
  const center = coarseBest * factor;
  let best = center;
  let score = 0;
  for (let lag = Math.max(-limitSamples, center - factor); lag <= Math.min(limitSamples, center + factor); lag++) {
    const value = Math.abs(normalizedCorrelation(reference, recorded, lag, 1, fineLength));
    if (value > score) {
      score = value;
      best = lag;
    }
  }

  const ym = Math.abs(normalizedCorrelation(reference, recorded, best - 1, 1, fineLength));
  const y0 = Math.abs(normalizedCorrelation(reference, recorded, best, 1, fineLength));
  const yp = Math.abs(normalizedCorrelation(reference, recorded, best + 1, 1, fineLength));
  const denominator = ym - 2 * y0 + yp;
  const fraction = Math.abs(denominator) > 1e-12
    ? Math.max(-0.5, Math.min(0.5, 0.5 * (ym - yp) / denominator))
    : 0;
  return { lag: best + fraction, score };
}
function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [real[i], real[j]] = [real[j], real[i]]; [imag[i], imag[j]] = [imag[j], imag[i]]; }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = -2 * Math.PI / length, wr0 = Math.cos(angle), wi0 = Math.sin(angle);
    for (let offset = 0; offset < n; offset += length) {
      let wr = 1, wi = 0;
      for (let j = 0; j < length / 2; j++) {
        const u = offset + j, v = u + length / 2;
        const tr = wr * real[v] - wi * imag[v], ti = wr * imag[v] + wi * real[v];
        real[v] = real[u] - tr; imag[v] = imag[u] - ti;
        real[u] += tr; imag[u] += ti;
        const next = wr * wr0 - wi * wi0; wi = wr * wi0 + wi * wr0; wr = next;
      }
    }
  }
}
function unwrapPhase(points: TransferPoint[]): void {
  let previous: number | null = null;
  for (const point of points) {
    let phase = point.phaseDeg;
    if (previous !== null) {
      while (phase - previous > 180) phase -= 360;
      while (phase - previous < -180) phase += 360;
    }
    point.phaseDeg = phase;
    previous = phase;
  }
}

/** Measures raw PCM level and clipping before using a capture for Auto EQ. */
export function measurePcmCaptureQuality(samples: Float32Array): PcmCaptureQuality | null {
  if (!samples.length) return null;
  let peak = 0;
  let energy = 0;
  let finiteCount = 0;
  let clippedCount = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) continue;
    finiteCount++;
    const absolute = Math.abs(sample);
    peak = Math.max(peak, absolute);
    energy += sample * sample;
    if (absolute >= 0.999) clippedCount++;
  }
  if (!finiteCount) return null;
  const rms = Math.sqrt(energy / finiteCount);
  const toDbfs = (value: number) => value > 0 ? 20 * Math.log10(value) : -120;
  return {
    peakDbfs: toDbfs(peak),
    rmsDbfs: toDbfs(rms),
    clippedSamplePercent: 100 * clippedCount / finiteCount,
    invalidSamplePercent: 100 * (samples.length - finiteCount) / samples.length,
    sampleCount: samples.length,
  };
}

/** Welch H1 transfer estimate. Coherence is meaningful only with multiple independent averages. */
export function analyzeTransfer(
  reference: Float32Array,
  recorded: Float32Array,
  sampleRate: number,
  calibrationPoints: MicCalibrationPoint[] = [],
  referencePlaybackOffsetSeconds = 0,
): TransferResult | null {
  if (sampleRate < 8000
    || reference.length < 8192
    || recorded.length < reference.length * 0.7
    || !Number.isFinite(referencePlaybackOffsetSeconds)
    || referencePlaybackOffsetSeconds < 0
    || referencePlaybackOffsetSeconds > 2) return null;
  const { lag, score } = bestLag(reference, recorded, sampleRate);
  if (score < 0.025) return null;
  const integerLag = Math.round(lag);
  const startReference = Math.max(0, -integerLag);
  const startRecorded = Math.max(0, integerLag);
  const usableLength = Math.min(reference.length - startReference, recorded.length - startRecorded);
  const frameSize = 4096, hopSize = 2048;
  if (usableLength < frameSize * 3) return null;
  const bins = frameSize / 2 + 1;
  const sxx = new Float64Array(bins), syy = new Float64Array(bins);
  const sxyRe = new Float64Array(bins), sxyIm = new Float64Array(bins);
  let frames = 0;
  for (let offset = 0; offset + frameSize <= usableLength; offset += hopSize) {
    const xr = new Float64Array(frameSize), xi = new Float64Array(frameSize);
    const yr = new Float64Array(frameSize), yi = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (frameSize - 1));
      xr[i] = reference[startReference + offset + i] * window;
      yr[i] = recorded[startRecorded + offset + i] * window;
    }
    fft(xr, xi); fft(yr, yi);
    for (let k = 1; k < bins - 1; k++) {
      const xPower = xr[k] * xr[k] + xi[k] * xi[k];
      const yPower = yr[k] * yr[k] + yi[k] * yi[k];
      sxx[k] += xPower; syy[k] += yPower;
      sxyRe[k] += yr[k] * xr[k] + yi[k] * xi[k];
      sxyIm[k] += yi[k] * xr[k] - yr[k] * xi[k];
    }
    frames++;
  }
  if (frames < 3) return null;
  const residualDelaySamples = lag - integerLag;
  const points: TransferPoint[] = [];
  for (let k = 2; k < bins - 1; k++) {
    if (sxx[k] < 1e-12 || syy[k] < 1e-12) continue;
    const re = sxyRe[k] / sxx[k], im = sxyIm[k] / sxx[k];
    const frequencyHz = k * sampleRate / frameSize;
    const magnitude = Math.hypot(re, im);
    const coherence = Math.max(0, Math.min(1, (sxyRe[k] ** 2 + sxyIm[k] ** 2) / (sxx[k] * syy[k] + 1e-20)));
    if (!Number.isFinite(magnitude) || magnitude < 1e-9) continue;
    // Remove only the fractional sample residual after integer time alignment.
    const angle = 2 * Math.PI * frequencyHz * residualDelaySamples / sampleRate;
    const correctedRe = re * Math.cos(angle) - im * Math.sin(angle);
    const correctedIm = re * Math.sin(angle) + im * Math.cos(angle);
    points.push({
      frequencyHz,
      magnitudeDb: 20 * Math.log10(magnitude) + micCorrectionAt(calibrationPoints, frequencyHz),
      phaseDeg: Math.atan2(correctedIm, correctedRe) * 180 / Math.PI,
      coherence,
    });
  }
  unwrapPhase(points);
  const useful = points.filter(p => p.frequencyHz >= 100 && p.frequencyHz <= Math.min(10000, sampleRate * 0.4));
  const averageCoherence = useful.length ? useful.reduce((sum, p) => sum + p.coherence, 0) / useful.length : 0;
  const reliableBandPercent = useful.length ? 100 * useful.filter(p => p.coherence >= 0.8).length / useful.length : 0;
  return {
    points,
    // Remove the known silence/pre-roll before playback; this is still the
    // total relative output-to-microphone path latency, not speaker-only delay.
    estimatedDelayMs: (lag / sampleRate - referencePlaybackOffsetSeconds) * 1000,
    confidence: score,
    averageCoherence,
    reliableBandPercent,
    sampleRate,
    framesAveraged: frames,
  };
}


/**
 * Welch H1 transfer analysis for two channels captured simultaneously from one
 * multichannel AudioWorklet stream. No independent lag alignment is performed:
 * phase remains tied to the common capture clock.
 *
 * Reference must be an electrical loopback of the output and Measurement the
 * microphone input. A common WebAudio frame clock does not replace per-channel
 * interface latency/phase calibration.
 */
export function analyzeSynchronousTransfer(
  reference: Float32Array,
  measurement: Float32Array,
  sampleRate: number,
  calibrationPoints: MicCalibrationPoint[] = [],
): TransferResult | null {
  const frameSize = 4096;
  const hopSize = 2048;
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000
    || reference.length !== measurement.length || reference.length < frameSize * 3
    || reference.some(sample => !Number.isFinite(sample))
    || measurement.some(sample => !Number.isFinite(sample))) return null;

  // Reduce the coarse search size for mobile, then refine at native sample rate.
  const delayFactor = Math.max(1, Math.ceil(sampleRate / 12000));
  const coarseReference = decimateForLag(reference, delayFactor);
  const coarseMeasurement = decimateForLag(measurement, delayFactor);
  const coarseDelay = estimateSynchronousRelativeDelay(
    coarseReference, coarseMeasurement, sampleRate / delayFactor, 100,
  );
  if (!coarseDelay || coarseDelay.correlation < 0.1) return null;
  const coarseCenter = Math.round(coarseDelay.delaySamples * delayFactor);
  const maxLag = Math.min(Math.floor(sampleRate * 0.1), Math.floor(reference.length / 2));
  const fineLength = Math.min(reference.length, Math.floor(sampleRate * 1.5));
  let bestLag = Math.max(-maxLag, Math.min(maxLag, coarseCenter));
  let bestCorrelation = 0;
  for (let lag = Math.max(-maxLag, coarseCenter - delayFactor);
    lag <= Math.min(maxLag, coarseCenter + delayFactor); lag++) {
    const score = Math.abs(normalizedCorrelation(reference, measurement, lag, 1, fineLength));
    if (score > bestCorrelation) {
      bestCorrelation = score;
      bestLag = lag;
    }
  }
  if (bestCorrelation < 0.1) return null;
  const before = Math.abs(normalizedCorrelation(reference, measurement, bestLag - 1, 1, fineLength));
  const center = Math.abs(normalizedCorrelation(reference, measurement, bestLag, 1, fineLength));
  const after = Math.abs(normalizedCorrelation(reference, measurement, bestLag + 1, 1, fineLength));
  const curvature = before - 2 * center + after;
  const fraction = Math.abs(curvature) > 1e-12
    ? Math.max(-0.5, Math.min(0.5, 0.5 * (before - after) / curvature))
    : 0;
  const delaySamples = bestLag + fraction;
  const delayMs = delaySamples / sampleRate * 1000;

  const bins = frameSize / 2 + 1;
  const sxx = new Float64Array(bins);
  const syy = new Float64Array(bins);
  const sxyRe = new Float64Array(bins);
  const sxyIm = new Float64Array(bins);
  let frames = 0;
  const xr = new Float64Array(frameSize);
  const xi = new Float64Array(frameSize);
  const yr = new Float64Array(frameSize);
  const yi = new Float64Array(frameSize);
  const window = new Float64Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (frameSize - 1));
  }

  for (let offset = 0; offset + frameSize <= reference.length; offset += hopSize) {
    xr.fill(0);
    xi.fill(0);
    yr.fill(0);
    yi.fill(0);
    for (let i = 0; i < frameSize; i++) {
      xr[i] = reference[offset + i] * window[i];
      yr[i] = measurement[offset + i] * window[i];
    }
    fft(xr, xi);
    fft(yr, yi);
    for (let k = 1; k < bins - 1; k++) {
      const xRe = xr[k], xIm = xi[k], yRe = yr[k], yIm = yi[k];
      sxx[k] += xRe * xRe + xIm * xIm;
      syy[k] += yRe * yRe + yIm * yIm;
      // S_yx = Y * conjugate(X)
      sxyRe[k] += yRe * xRe + yIm * xIm;
      sxyIm[k] += yIm * xRe - yRe * xIm;
    }
    frames++;
  }
  if (frames < 3) return null;

  const points: TransferPoint[] = [];
  for (let k = 2; k < bins - 1; k++) {
    if (sxx[k] < 1e-12 || syy[k] < 1e-12) continue;
    const re = sxyRe[k] / sxx[k];
    const im = sxyIm[k] / sxx[k];
    const magnitude = Math.hypot(re, im);
    const frequencyHz = k * sampleRate / frameSize;
    const coherence = Math.max(0, Math.min(1,
      (sxyRe[k] * sxyRe[k] + sxyIm[k] * sxyIm[k]) / (sxx[k] * syy[k] + 1e-20),
    ));
    if (!Number.isFinite(magnitude) || magnitude < 1e-9) continue;
    points.push({
      frequencyHz,
      magnitudeDb: 20 * Math.log10(magnitude) + micCorrectionAt(calibrationPoints, frequencyHz),
      phaseDeg: Math.atan2(im, re) * 180 / Math.PI,
      coherence,
    });
  }
  unwrapPhase(points);
  const useful = points.filter(point =>
    point.frequencyHz >= 100 && point.frequencyHz <= Math.min(10000, sampleRate * 0.4),
  );
  if (useful.length < 8) return null;
  const averageCoherence = useful.reduce((sum, point) => sum + point.coherence, 0) / useful.length;
  const reliableBandPercent = 100 * useful.filter(point => point.coherence >= 0.8).length / useful.length;
  return {
    points,
    estimatedDelayMs: delayMs,
    confidence: bestCorrelation,
    averageCoherence,
    reliableBandPercent,
    sampleRate,
    framesAveraged: frames,
    analysisMode: "synchronous-dual-channel",
  };
}
