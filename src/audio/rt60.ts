export type Rt60BandResult = {
  centerHz: number;
  rt20Seconds: number | null;
  rt30Seconds: number | null;
  rt60Seconds: number | null;
  fitR2: number | null;
  fitRangeDb: number;
};
export type ImpulseResponseResult = {
  sampleRate: number;
  peakIndex: number;
  peakToNoiseDb: number;
  bands: Rt60BandResult[];
  recommendedRt60: number | null;
  quality: "good" | "limited" | "invalid";
};

export function createLogSweep(sampleRate: number, durationSeconds = 6, startHz = 30, endHz = 18000, amplitude = 0.12): Float32Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new Error("Sample rate phải nằm trong khoảng 8–192 kHz.");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.5 || durationSeconds > 30) {
    throw new Error("Thời lượng sweep phải nằm trong khoảng 0,5–30 giây.");
  }
  if (!Number.isFinite(startHz) || !Number.isFinite(endHz) || startHz < 20 || endHz <= startHz) {
    throw new Error("Dải tần sweep không hợp lệ.");
  }
  if (!Number.isFinite(amplitude) || amplitude <= 0 || amplitude > 1) {
    throw new Error("Biên độ sweep phải lớn hơn 0 và không vượt quá 1.");
  }
  const count = Math.floor(sampleRate * durationSeconds);
  const sweep = new Float32Array(count);
  const high = Math.min(endHz, sampleRate * 0.42);
  const low = startHz;
  if (high <= low) throw new Error("Sample rate không đủ cao cho dải tần sweep đã chọn.");
  const logRatio = Math.log(high / low);
  const timeConstant = durationSeconds / logRatio;
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.025), Math.floor(count / 10));
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * low * timeConstant * (Math.exp(t / timeConstant) - 1);
    const fadeIn = fadeSamples ? Math.min(1, i / fadeSamples) : 1;
    const fadeOut = fadeSamples ? Math.min(1, (count - 1 - i) / fadeSamples) : 1;
    sweep[i] = amplitude * Math.sin(phase) * Math.max(0, Math.min(fadeIn, fadeOut));
  }
  return sweep;
}

function nextPowerOfTwo(value: number): number {
  let n = 1;
  while (n < value) n *= 2;
  return n;
}

function fft(real: Float64Array, imag: Float64Array, inverse = false): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / length;
    const wr0 = Math.cos(angle), wi0 = Math.sin(angle);
    for (let offset = 0; offset < n; offset += length) {
      let wr = 1, wi = 0;
      for (let j = 0; j < length / 2; j++) {
        const u = offset + j, v = u + length / 2;
        const tr = wr * real[v] - wi * imag[v];
        const ti = wr * imag[v] + wi * real[v];
        real[v] = real[u] - tr; imag[v] = imag[u] - ti;
        real[u] += tr; imag[u] += ti;
        const nextWr = wr * wr0 - wi * wi0;
        wi = wr * wi0 + wi * wr0; wr = nextWr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { real[i] /= n; imag[i] /= n; }
}

function deconvolve(reference: Float32Array, recorded: Float32Array): Float32Array | null {
  if (reference.length < 1024 || recorded.length < reference.length * 0.7) return null;
  const n = nextPowerOfTwo(reference.length + recorded.length);
  const xr = new Float64Array(n), xi = new Float64Array(n);
  const yr = new Float64Array(n), yi = new Float64Array(n);
  for (let i = 0; i < reference.length; i++) xr[i] = reference[i];
  for (let i = 0; i < recorded.length; i++) yr[i] = recorded[i];
  fft(xr, xi); fft(yr, yi);
  let maxPower = 0;
  for (let k = 0; k < n; k++) maxPower = Math.max(maxPower, xr[k] * xr[k] + xi[k] * xi[k]);
  if (!(maxPower > 0)) return null;
  const regularization = maxPower * 1e-8;
  for (let k = 0; k < n; k++) {
    const power = xr[k] * xr[k] + xi[k] * xi[k] + regularization;
    const re = (yr[k] * xr[k] + yi[k] * xi[k]) / power;
    const im = (yi[k] * xr[k] - yr[k] * xi[k]) / power;
    yr[k] = re; yi[k] = im;
  }
  fft(yr, yi, true);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = yr[i];
  return out;
}

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };
function makeBiquad(kind: "highpass" | "lowpass", cutoff: number, sampleRate: number): Biquad {
  const f = Math.min(sampleRate * 0.45, Math.max(10, cutoff));
  const w = 2 * Math.PI * f / sampleRate;
  const cos = Math.cos(w), sin = Math.sin(w), alpha = sin / (2 * Math.SQRT1_2);
  let b0: number, b1: number, b2: number;
  if (kind === "lowpass") {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
  } else {
    b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
  }
  const a0 = 1 + alpha, a1 = -2 * cos / a0, a2 = (1 - alpha) / a0;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1, a2 };
}
function runBiquad(input: Float32Array, coefficients: Biquad): Float32Array {
  const output = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = coefficients.b0 * x + coefficients.b1 * x1 + coefficients.b2 * x2 - coefficients.a1 * y1 - coefficients.a2 * y2;
    output[i] = Number.isFinite(y) ? y : 0;
    x2 = x1; x1 = x; y2 = y1; y1 = output[i];
  }
  return output;
}
function octaveBand(input: Float32Array, centerHz: number, sampleRate: number): Float32Array {
  const root2 = Math.SQRT2;
  const low = centerHz / root2, high = centerHz * root2;
  let filtered = input;
  const hp = makeBiquad("highpass", low, sampleRate);
  const lp = makeBiquad("lowpass", high, sampleRate);
  filtered = runBiquad(filtered, hp);
  filtered = runBiquad(filtered, hp);
  filtered = runBiquad(filtered, lp);
  filtered = runBiquad(filtered, lp);
  return filtered;
}
function fitDecay(curve: Float32Array, sampleRate: number, startDb: number, endDb: number): { seconds: number; r2: number } | null {
  let start = -1, end = -1;
  for (let i = 0; i < curve.length; i++) {
    if (start < 0 && curve[i] <= startDb) start = i;
    if (start >= 0 && curve[i] <= endDb) { end = i; break; }
  }
  if (start < 0 || end <= start + sampleRate * 0.04) return null;
  const stride = Math.max(1, Math.floor((end - start) / 5000));
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = start; i <= end; i += stride) {
    const x = i / sampleRate, y = curve[i];
    n++; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
  }
  const denominator = n * sxx - sx * sx;
  const slope = denominator ? (n * sxy - sx * sy) / denominator : 0;
  const intercept = (sy - slope * sx) / n;
  const residual = (() => {
    let sum = 0;
    for (let i = start; i <= end; i += stride) {
      const error = curve[i] - (intercept + slope * (i / sampleRate));
      sum += error * error;
    }
    return sum;
  })();
  const total = syy - (sy * sy) / n;
  const r2 = total > 1e-12 ? Math.max(0, Math.min(1, 1 - residual / total)) : 0;
  if (!(slope < -1) || !Number.isFinite(slope)) return null;
  return { seconds: (end - start) / sampleRate, r2 };
}
function schroederDecay(samples: Float32Array): Float32Array | null {
  if (!samples.length) return null;
  // Estimate the stationary noise floor from the last 10% of the impulse response.
  const tailStart = Math.floor(samples.length * 0.9);
  let noisePower = 0;
  for (let i = tailStart; i < samples.length; i++) noisePower += samples[i] * samples[i];
  noisePower /= Math.max(1, samples.length - tailStart);
  // Noise-compensated backward integration: subtract the expected remaining noise energy.
  const curve = new Float32Array(samples.length);
  let integrated = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    integrated += samples[i] * samples[i];
    curve[i] = Math.max(0, integrated - noisePower * (samples.length - i));
  }
  const reference = curve[0];
  if (!(reference > 1e-15)) return null;
  for (let i = 0; i < curve.length; i++) curve[i] = 10 * Math.log10(Math.max(curve[i] / reference, 1e-12));
  return curve;
}

export function analyzeImpulseResponse(reference: Float32Array, recorded: Float32Array, sampleRate: number): { impulse: Float32Array; result: ImpulseResponseResult } | null {
  if (!(reference instanceof Float32Array) || !(recorded instanceof Float32Array)
    || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000
    || reference.length < 1024 || recorded.length < reference.length * 0.7
    || reference.length > 10_000_000 || recorded.length > 10_000_000) return null;
  // Reject corrupt PCM before FFT; silently converting NaN/Infinity into a
  // plausible-looking decay curve would make an invalid room measurement unsafe.
  for (let i = 0; i < reference.length; i++) if (!Number.isFinite(reference[i])) return null;
  for (let i = 0; i < recorded.length; i++) if (!Number.isFinite(recorded[i])) return null;
  const deconvolved = deconvolve(reference, recorded);
  if (!deconvolved) return null;
  const searchEnd = Math.min(deconvolved.length, Math.floor(sampleRate * 1.5));
  let peakIndex = 0, peak = 0;
  for (let i = 0; i < searchEnd; i++) {
    const value = Math.abs(deconvolved[i]);
    if (value > peak) { peak = value; peakIndex = i; }
  }
  if (!(peak > 1e-6)) return null;
  const start = Math.max(0, peakIndex - Math.floor(sampleRate * 0.003));
  const estimatedLinearIrLength = Math.max(0, recorded.length - reference.length + 1);
  const usableLength = Math.min(Math.floor(sampleRate * 4), deconvolved.length - start, estimatedLinearIrLength - start);
  if (usableLength < sampleRate * 0.5) return null;
  const impulse = deconvolved.slice(start, start + usableLength);
  for (let i = 0; i < impulse.length; i++) impulse[i] /= peak;
  const tail = impulse.slice(Math.floor(impulse.length * 0.85));
  const tailRms = Math.sqrt(tail.reduce((sum, value) => sum + value * value, 0) / Math.max(1, tail.length));
  const peakToNoiseDb = 20 * Math.log10(1 / Math.max(tailRms, 1e-12));
  const bands: Rt60BandResult[] = [];
  for (const centerHz of [125, 250, 500, 1000, 2000, 4000]) {
    if (centerHz * Math.SQRT2 >= sampleRate * 0.45) continue;
    const filtered = octaveBand(impulse, centerHz, sampleRate);
    const decay = schroederDecay(filtered);
    if (!decay) {
      bands.push({ centerHz, rt20Seconds: null, rt30Seconds: null, rt60Seconds: null, fitR2: null, fitRangeDb: 0 });
      continue;
    }
    const t20 = fitDecay(decay, sampleRate, -5, -25);
    const t30 = fitDecay(decay, sampleRate, -5, -35);
    const chosen = t30 && t30.r2 >= 0.85 ? { ...t30, rt: t30.seconds * 2, range: 30 } : t20 && t20.r2 >= 0.75 ? { ...t20, rt: t20.seconds * 3, range: 20 } : null;
    bands.push({
      centerHz,
      rt20Seconds: t20 ? Math.round(t20.seconds * 3 * 100) / 100 : null,
      rt30Seconds: t30 ? Math.round(t30.seconds * 2 * 100) / 100 : null,
      rt60Seconds: chosen && chosen.rt >= 0.1 && chosen.rt <= 10 ? Math.round(chosen.rt * 100) / 100 : null,
      fitR2: chosen ? Math.round(chosen.r2 * 1000) / 1000 : null,
      fitRangeDb: chosen?.range ?? 0,
    });
  }
  const mid = bands.filter(b => [500, 1000, 2000].includes(b.centerHz) && b.rt60Seconds !== null);
  const recommendedRt60 = mid.length ? [...mid].sort((a, b) => (a.rt60Seconds as number) - (b.rt60Seconds as number))[Math.floor(mid.length / 2)].rt60Seconds : null;
  const quality = peakToNoiseDb > 35 && mid.length >= 2 && mid.every(b => (b.fitR2 ?? 0) >= 0.85) ? "good" : mid.length ? "limited" : "invalid";
  return {
    impulse,
    result: { sampleRate, peakIndex, peakToNoiseDb: Math.round(peakToNoiseDb * 10) / 10, bands, recommendedRt60, quality },
  };
}
