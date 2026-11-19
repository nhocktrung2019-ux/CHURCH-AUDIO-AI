export type ImpulseResponseCapture = {
  id: string;
  zone: string;
  position: string;
  sampleRateHz: number;
  inputLabel: string;
  capturedAt: number;
  /** Linear PCM samples in normalized full-scale units [-1, 1]. */
  samples: number[];
  /** Optional independently measured input-chain noise floor in dBFS. */
  noiseFloorDbfs?: number;
};

export type DecayFit = {
  method: "EDT" | "T20" | "T30";
  startDb: number;
  endDb: number;
  slopeDbPerSecond: number;
  rt60Seconds: number;
  rSquared: number;
  sampleCount: number;
};

export type ImpulseResponseCheck = {
  id: string;
  status: "pass" | "warning" | "fail";
  detail: string;
};

export type ImpulseResponseAnalysis = {
  captureId: string;
  status: "ready" | "review" | "blocked";
  unit: "seconds";
  metrics: { edtSeconds: number | null; t20Seconds: number | null; t30Seconds: number | null };
  fits: DecayFit[];
  checks: ImpulseResponseCheck[];
  peakIndex: number | null;
  peakDbfs: number | null;
  noiseFloorDbfs: number | null;
  availableDynamicRangeDb: number | null;
  decayCurve: Array<{ timeSeconds: number; levelDb: number }>;
  note: string;
};

const MIN_SAMPLE_RATE = 8000;
const MAX_SAMPLE_RATE = 192000;
const MIN_SAMPLES = 256;
const MAX_SAMPLES = 192000 * 60;
const finite = (v: number) => Number.isFinite(v);
const db = (power: number) => 10 * Math.log10(Math.max(power, 1e-30));

function regression(points: Array<{ x: number; y: number }>) {
  const n = points.length;
  if (n < 3) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let xx = 0, xy = 0, yy = 0;
  for (const p of points) {
    const dx = p.x - meanX, dy = p.y - meanY;
    xx += dx * dx; xy += dx * dy; yy += dy * dy;
  }
  if (xx <= 0) return null;
  const slope = xy / xx;
  const rSquared = yy <= 1e-12 ? 0 : Math.max(0, Math.min(1, (xy * xy) / (xx * yy)));
  return { slope, rSquared };
}

/**
 * Analyze a captured, calibrated-path impulse response. This function never
 * synthesizes a response and never converts dBFS to dB SPL.
 */
export function analyzeImpulseResponse(
  capture: ImpulseResponseCapture,
  options: { minimumRSquared?: number; noiseMarginDb?: number; clippingThreshold?: number } = {},
): ImpulseResponseAnalysis {
  const checks: ImpulseResponseCheck[] = [];
  const add = (id: string, status: ImpulseResponseCheck["status"], detail: string) =>
    checks.push({ id, status, detail });
  const blocked = (detail: string): ImpulseResponseAnalysis => ({
    captureId: capture.id, status: "blocked", unit: "seconds",
    metrics: { edtSeconds: null, t20Seconds: null, t30Seconds: null },
    fits: [], checks, peakIndex: null, peakDbfs: null, noiseFloorDbfs: null,
    availableDynamicRangeDb: null, decayCurve: [],
    note: detail,
  });

  if (!capture.id.trim() || !capture.zone.trim() || !capture.position.trim()
    || !capture.inputLabel.trim() || !finite(capture.capturedAt)) {
    add("metadata", "fail", "Thiếu ID, vùng, vị trí, chuỗi đầu vào hoặc thời điểm đo.");
    return blocked("Không đủ metadata để truy xuất phép đo.");
  }
  add("metadata", "pass", "Metadata phép đo đầy đủ.");
  if (!Number.isInteger(capture.sampleRateHz) || capture.sampleRateHz < MIN_SAMPLE_RATE
    || capture.sampleRateHz > MAX_SAMPLE_RATE) {
    add("sample-rate", "fail", "Sample rate phải nằm trong 8–192 kHz.");
    return blocked("Sample rate không hợp lệ.");
  }
  if (!Array.isArray(capture.samples) || capture.samples.length < MIN_SAMPLES
    || capture.samples.length > MAX_SAMPLES || capture.samples.some(v => !finite(v) || Math.abs(v) > 1.000001)) {
    add("pcm-integrity", "fail", "PCM phải hữu hạn, chuẩn hóa trong [-1, 1] và có độ dài hợp lệ.");
    return blocked("Dữ liệu PCM không hợp lệ hoặc quá ngắn.");
  }
  const peak = Math.max(...capture.samples.map(Math.abs));
  const peakIndex = capture.samples.findIndex(v => Math.abs(v) === peak);
  const peakDbfs = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const clippingThreshold = options.clippingThreshold ?? 0.999;
  if (peak >= clippingThreshold) {
    add("clipping", "fail", "Tín hiệu chạm ngưỡng clipping; cần đo lại với gain thấp hơn.");
    return { ...blocked("Tín hiệu bị clipping; không tính RT."), peakIndex, peakDbfs };
  }
  if (peak < 1e-5) {
    add("signal-level", "fail", "Mức tín hiệu quá thấp để phân tích tin cậy.");
    return { ...blocked("Không phát hiện impulse response đủ mức."), peakIndex, peakDbfs };
  }
  add("clipping", "pass", "Không phát hiện clipping ở ngưỡng đã cấu hình.");
  add("signal-level", "pass", "Mức đỉnh PCM đủ để tiếp tục kiểm tra.");

  const tailStart = Math.max(peakIndex + 1, Math.floor(capture.samples.length * 0.9));
  const tail = capture.samples.slice(tailStart);
  if (tail.length < 32) {
    add("noise-floor", "fail", "Không đủ mẫu cuối để ước lượng noise floor.");
    return { ...blocked("Không đủ dữ liệu để xác định noise floor."), peakIndex, peakDbfs };
  }
  const tailMeanSquare = tail.reduce((s, v) => s + v * v, 0) / tail.length;
  const estimatedNoiseDbfs = tailMeanSquare > 0 ? 10 * Math.log10(tailMeanSquare) : -160;
  const noiseFloorDbfs = capture.noiseFloorDbfs ?? estimatedNoiseDbfs;
  if (!finite(noiseFloorDbfs) || noiseFloorDbfs > 0 || noiseFloorDbfs < -180) {
    add("noise-floor", "fail", "Noise floor dBFS không hợp lệ.");
    return { ...blocked("Noise floor không hợp lệ."), peakIndex, peakDbfs };
  }
  const dynamicRange = peakDbfs - noiseFloorDbfs;
  add("noise-floor", dynamicRange >= 35 ? "pass" : "warning",
    "Noise floor " + noiseFloorDbfs.toFixed(1) + " dBFS; dynamic range " + dynamicRange.toFixed(1) + " dB.");

  // Schroeder backward integration with an estimated noise-energy subtraction.
  const n = capture.samples.length;
  const noisePower = 10 ** (noiseFloorDbfs / 10);
  const integrated = new Array<number>(n);
  let energy = 0;
  for (let i = n - 1; i >= peakIndex; i--) {
    const sample = capture.samples[i];
    energy += sample * sample;
    const remaining = n - i;
    integrated[i] = Math.max(energy - noisePower * remaining, 1e-30);
  }
  const reference = integrated[peakIndex] ?? 0;
  if (!(reference > 0)) {
    add("decay", "fail", "Không xác định được năng lượng suy giảm sau impulse.");
    return { ...blocked("Đường suy giảm không hợp lệ."), peakIndex, peakDbfs, noiseFloorDbfs, availableDynamicRangeDb: dynamicRange };
  }
  const decayCurve: Array<{ timeSeconds: number; levelDb: number }> = [];
  for (let i = peakIndex; i < n; i++) {
    const levelDb = 10 * Math.log10(integrated[i] / reference);
    if (finite(levelDb)) decayCurve.push({ timeSeconds: (i - peakIndex) / capture.sampleRateHz, levelDb });
  }
  const minimumRSquared = options.minimumRSquared ?? 0.9;
  const noiseMarginDb = options.noiseMarginDb ?? 10;
  const fits: DecayFit[] = [];
  const specs = [
    { method: "EDT" as const, start: 0, end: -10, metric: "edtSeconds" as const },
    { method: "T20" as const, start: -5, end: -25, metric: "t20Seconds" as const },
    { method: "T30" as const, start: -5, end: -35, metric: "t30Seconds" as const },
  ];
  const metrics = { edtSeconds: null as number | null, t20Seconds: null as number | null, t30Seconds: null as number | null };
  for (const spec of specs) {
    const usableFloor = noiseFloorDbfs - peakDbfs <= spec.end - noiseMarginDb;
    const points = decayCurve.filter(p => p.levelDb <= spec.start && p.levelDb >= spec.end);
    if (!usableFloor || points.length < 12) continue;
    const fit = regression(points);
    if (!fit || fit.slope >= -0.01) continue;
    const rt60Seconds = -60 / fit.slope;
    if (!finite(rt60Seconds) || rt60Seconds <= 0 || rt60Seconds > 30 || fit.rSquared < minimumRSquared) continue;
    const result: DecayFit = { method: spec.method, startDb: spec.start, endDb: spec.end,
      slopeDbPerSecond: fit.slope, rt60Seconds, rSquared: fit.rSquared, sampleCount: points.length };
    fits.push(result);
    metrics[spec.metric] = rt60Seconds;
  }
  for (const spec of specs) {
    const found = fits.some(f => f.method === spec.method);
    add(spec.method.toLowerCase(), found ? "pass" : "warning",
      found ? spec.method + " fit hợp lệ, R² đạt ngưỡng." :
        spec.method + " bị bỏ qua: không đủ dynamic range, noise margin, điểm fit hoặc độ tuyến tính.");
  }
  const status = fits.length === 3 ? (checks.some(c => c.status === "warning") ? "review" : "ready")
    : fits.length > 0 ? "review" : "blocked";
  return {
    captureId: capture.id, status, unit: "seconds", metrics, fits, checks,
    peakIndex, peakDbfs, noiseFloorDbfs, availableDynamicRangeDb: dynamicRange,
    decayCurve,
    note: "RT là ước lượng từ impulse response thực; dBFS không phải dB SPL. Chỉ dùng các fit đạt quality gate; không thay thế nghiệm thu âm học tại hiện trường.",
  };
}
