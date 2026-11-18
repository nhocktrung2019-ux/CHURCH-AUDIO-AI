import type { TransferPoint } from "./transfer";

export type ZoneResponseCapture = {
  id: string;
  capturedAt: string;
  points: TransferPoint[];
};

export type ZoneResponseSet = {
  zone: string;
  inputChainId: string;
  sampleRate: number;
  captures: ZoneResponseCapture[];
};

export type ZoneFrequencyBin = {
  frequencyHz: number;
  coverageCount: number;
  spatialSpreadDb: number | null;
  zones: Array<{ zone: string; magnitudeDb: number; repeatSpreadDb: number; coherence: number }>;
  status: "comparable" | "spatial-variance" | "insufficient-coverage";
};

export type ZoneFrequencyResponseAnalysis = {
  ready: boolean;
  reason: string;
  zoneCount: number;
  frequencyBins: ZoneFrequencyBin[];
  medianSpatialSpreadDb: number | null;
  maximumSpatialSpreadDb: number | null;
  excludedRepeatBins: number;
  excludedCoverageBins: number;
};

const MIN_REPEATS = 3;
const MAX_REPEAT_SPREAD_DB = 3;
const MAX_SPATIAL_SPREAD_DB = 8;
const MIN_COHERENCE = 0.8;
const MAX_GAP_OCTAVES = 0.25;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function clean(points: TransferPoint[]): TransferPoint[] {
  return points.filter((p) => Number.isFinite(p.frequencyHz) && p.frequencyHz >= 20
    && p.frequencyHz <= 20000 && Number.isFinite(p.magnitudeDb)
    && Number.isFinite(p.coherence) && p.coherence >= MIN_COHERENCE && p.coherence <= 1)
    .sort((a, b) => a.frequencyHz - b.frequencyHz);
}

function interpolate(points: TransferPoint[], frequencyHz: number): TransferPoint | null {
  let lo = 0, hi = points.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const point = points[mid];
    if (!point) return null;
    if (Math.abs(point.frequencyHz - frequencyHz) < 1e-6) return point;
    if (point.frequencyHz < frequencyHz) lo = mid + 1;
    else hi = mid - 1;
  }
  const a = points[hi], b = points[lo];
  if (!a || !b) return null;
  const gap = Math.log2(b.frequencyHz / a.frequencyHz);
  if (!Number.isFinite(gap) || gap <= 0 || gap > MAX_GAP_OCTAVES) return null;
  const t = Math.log2(frequencyHz / a.frequencyHz) / gap;
  return { frequencyHz, magnitudeDb: a.magnitudeDb + (b.magnitudeDb - a.magnitudeDb) * t,
    phaseDeg: a.phaseDeg + (b.phaseDeg - a.phaseDeg) * t, coherence: Math.min(a.coherence, b.coherence) };
}

/** Compare repeatable, same-chain acoustic transfer curves across labelled zones. */
export function analyzeZoneFrequencyResponse(sets: ZoneResponseSet[]): ZoneFrequencyResponseAnalysis {
  const issues: string[] = [];
  if (sets.length < 2) issues.push("Cần ít nhất hai vùng để so sánh đáp tuyến.");
  const names = sets.map((set) => set.zone.trim().toLocaleLowerCase());
  if (names.some((name) => !name) || new Set(names).size !== names.length) issues.push("Tên vùng phải có giá trị và không được trùng.");
  const chains = new Set(sets.map((set) => set.inputChainId.trim()));
  if (chains.size !== 1 || chains.has("")) issues.push("Các vùng phải dùng cùng chuỗi đo đã xác định; không trộn microphone, gain hoặc đường tín hiệu khác nhau.");
  const rates = sets.map((set) => set.sampleRate);
  if (rates.some((rate) => !Number.isFinite(rate) || rate <= 0) || (rates.length && Math.max(...rates) - Math.min(...rates) > 1))
    issues.push("Sample rate giữa các vùng không hợp lệ hoặc không đồng nhất.");

  const prepared = sets.map((set) => {
    const repeatCurves = set.captures.map((capture) => clean(capture.points));
    if (repeatCurves.length < MIN_REPEATS) issues.push(`${set.zone}: cần ít nhất ${MIN_REPEATS} lần đo lặp.`);
    return { zone: set.zone, curves: repeatCurves };
  });

  let excludedRepeatBins = 0, excludedCoverageBins = 0;
  const bins: ZoneFrequencyBin[] = [];
  const anchor = prepared[0]?.curves[0] ?? [];
  for (const anchorPoint of anchor) {
    const zoneValues: ZoneFrequencyBin["zones"] = [];
    for (const item of prepared) {
      const repeated = item.curves.map((curve) => interpolate(curve, anchorPoint.frequencyHz))
        .filter((point): point is TransferPoint => Boolean(point));
      if (repeated.length < MIN_REPEATS) continue;
      const levels = repeated.map((point) => point.magnitudeDb);
      const repeatSpreadDb = Math.max(...levels) - Math.min(...levels);
      if (repeatSpreadDb > MAX_REPEAT_SPREAD_DB) { excludedRepeatBins++; continue; }
      zoneValues.push({ zone: item.zone, magnitudeDb: median(levels), repeatSpreadDb,
        coherence: median(repeated.map((point) => point.coherence)) });
    }
    if (zoneValues.length < sets.length) {
      excludedCoverageBins++;
      bins.push({ frequencyHz: anchorPoint.frequencyHz, coverageCount: zoneValues.length,
        spatialSpreadDb: null, zones: zoneValues, status: "insufficient-coverage" });
      continue;
    }
    const levels = zoneValues.map((item) => item.magnitudeDb);
    const spread = Math.max(...levels) - Math.min(...levels);
    bins.push({ frequencyHz: anchorPoint.frequencyHz, coverageCount: zoneValues.length,
      spatialSpreadDb: spread, zones: zoneValues,
      status: spread > MAX_SPATIAL_SPREAD_DB ? "spatial-variance" : "comparable" });
  }
  const validSpreads = bins.flatMap((bin) => bin.spatialSpreadDb === null ? [] : [bin.spatialSpreadDb]);
  if (!bins.length) issues.push("Không tìm thấy dải tần chung đủ dữ liệu để so sánh.");
  return {
    ready: issues.length === 0 && bins.some((bin) => bin.status === "comparable"),
    reason: issues[0] ?? (bins.some((bin) => bin.status === "comparable")
      ? "Đã phân tích đáp tuyến theo vùng; chỉ các bin đạt độ lặp lại và coherence mới được so sánh."
      : "Không có bin đạt điều kiện so sánh; kiểm tra độ lặp lại và độ phủ tần số."),
    zoneCount: sets.length, frequencyBins: bins,
    medianSpatialSpreadDb: validSpreads.length ? median(validSpreads) : null,
    maximumSpatialSpreadDb: validSpreads.length ? Math.max(...validSpreads) : null,
    excludedRepeatBins, excludedCoverageBins,
  };
}
