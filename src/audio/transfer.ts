import { micCorrectionAt, type MicCalibrationPoint } from "./micCalibration";

export type TransferPoint = { frequencyHz: number; magnitudeDb: number; phaseDeg: number; coherence: number };
export type PcmCaptureQuality = {
  peakDbfs: number;
  rmsDbfs: number;
  clippedSamplePercent: number;
  invalidSamplePercent: number;
  sampleCount: number;
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
function bestLag(reference: Float32Array, recorded: Float32Array, sampleRate: number): { lag: number; score: number } {
  const coarseStep = 32;
  const limit = Math.min(Math.floor(sampleRate * 1.2), Math.floor(recorded.length * 0.3));
  const length = Math.min(reference.length, Math.floor(sampleRate * 2.5));
  let best = 0, score = 0;
  for (let lag = -limit; lag <= limit; lag += coarseStep) {
    const value = Math.abs(normalizedCorrelation(reference, recorded, lag, 16, length));
    if (value > score) { score = value; best = lag; }
  }
  const coarse = best;
  for (let lag = Math.max(-limit, coarse - coarseStep); lag <= Math.min(limit, coarse + coarseStep); lag++) {
    const value = Math.abs(normalizedCorrelation(reference, recorded, lag, 8, length));
    if (value > score) { score = value; best = lag; }
  }
  const ym = Math.abs(normalizedCorrelation(reference, recorded, best - 1, 4, length));
  const y0 = Math.abs(normalizedCorrelation(reference, recorded, best, 4, length));
  const yp = Math.abs(normalizedCorrelation(reference, recorded, best + 1, 4, length));
  const denominator = ym - 2 * y0 + yp;
  const fraction = Math.abs(denominator) > 1e-12 ? Math.max(-0.5, Math.min(0.5, 0.5 * (ym - yp) / denominator)) : 0;
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
