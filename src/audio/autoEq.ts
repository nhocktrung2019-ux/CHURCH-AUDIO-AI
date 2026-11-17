export type AutoEqMeasurementPoint = {
  frequencyHz: number;
  magnitudeDb: number;
  coherence: number;
};

export type AutoEqTargetProfile = "flat" | "spoken-word" | "worship-music";

export const AUTO_EQ_TARGETS: Record<AutoEqTargetProfile, {
  label: string;
  description: string;
  /** Mild operator-selected contour; not an industry or room standard. */
  curve: readonly (readonly [number, number])[];
}> = {
  flat: {
    label: "Phẳng / trung tính",
    description: "Mốc 0 dB trên toàn dải; dùng khi chưa chọn contour riêng.",
    curve: [[20, 0], [20000, 0]],
  },
  "spoken-word": {
    label: "Lời nói / giảng lễ",
    description: "Contour nhẹ giảm trầm thấp, giữ vùng trung âm và nhấn hiện diện rất nhẹ; chỉ là điểm bắt đầu để nghe kiểm tra.",
    curve: [[20, -3], [80, -3], [125, -2], [250, -0.7], [500, 0], [1000, 0], [2000, 0.3], [3150, 0.8], [4000, 0.6], [6300, 0], [10000, -1.2], [20000, -1.2]],
  },
  "worship-music": {
    label: "Nhạc thờ phượng / ban nhạc",
    description: "Contour nhẹ, không thay thế cân chỉnh theo loa, vị trí nghe và chương trình thực tế.",
    curve: [[20, -0.5], [80, -0.5], [125, 0.2], [250, 0.4], [500, 0], [1000, 0], [2000, 0], [4000, -0.4], [6300, -0.8], [10000, -1.2], [20000, -1.2]],
  },
};

export function autoEqTargetOffsetDb(
  frequencyHz: number,
  profile: AutoEqTargetProfile = "flat",
): number {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return 0;
  const curve = AUTO_EQ_TARGETS[profile]?.curve ?? AUTO_EQ_TARGETS.flat.curve;
  const frequency = Math.max(curve[0]?.[0] ?? 20, Math.min(curve[curve.length - 1]?.[0] ?? 20000, frequencyHz));
  for (let index = 1; index < curve.length; index++) {
    const right = curve[index];
    const left = curve[index - 1];
    if (!right || !left || frequency > right[0]) continue;
    const span = Math.log2(right[0] / left[0]);
    if (span <= 0) return right[1];
    const position = Math.log2(frequency / left[0]) / span;
    return left[1] + (right[1] - left[1]) * position;
  }
  return curve[curve.length - 1]?.[1] ?? 0;
}

export type ParametricEqFilter = {
  frequencyHz: number;
  gainDb: number;
  q: number;
  coherence: number;
  excessDb: number;
};

export type AutoEqReadiness = {
  ready: boolean;
  totalBins: number;
  coherentBins: number;
  coherentPercent: number;
  averageCoherence: number;
  reason: string;
};

function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : ((sorted[middle - 1] ?? Number.NaN) + (sorted[middle] ?? Number.NaN)) / 2;
}

function isValidPoint(point: AutoEqMeasurementPoint): boolean {
  return Number.isFinite(point.frequencyHz)
    && point.frequencyHz >= 80
    && point.frequencyHz <= 10000
    && Number.isFinite(point.magnitudeDb)
    && Number.isFinite(point.coherence)
    && point.coherence >= 0
    && point.coherence <= 1;
}

/**
 * Auto EQ is enabled only when a useful number and proportion of in-band bins
 * have strong coherence. Capture clipping and PCM discontinuities are checked
 * separately by the measurement workspace before suggestions are displayed.
 */
export function assessAutoEqReadiness(
  points: AutoEqMeasurementPoint[],
): AutoEqReadiness {
  const usable = points.filter(isValidPoint);
  const coherent = usable.filter((point) => point.coherence >= 0.8);
  const averageCoherence = usable.length
    ? usable.reduce((sum, point) => sum + point.coherence, 0) / usable.length
    : 0;
  const coherentPercent = usable.length ? 100 * coherent.length / usable.length : 0;

  let reason = "Đủ số điểm và coherence để tạo PEQ tư vấn.";
  if (usable.length < 24) {
    reason = "Cần ít nhất 24 điểm hợp lệ trong dải 80 Hz–10 kHz.";
  } else if (coherent.length < 24 || coherentPercent < 60 || averageCoherence < 0.8) {
    reason = "Coherence chưa đủ ổn định: cần ít nhất 24 bin coherence ≥ 0.80, tỷ lệ ≥ 60% và trung bình ≥ 0.80.";
  }

  return {
    ready: usable.length >= 24
      && coherent.length >= 24
      && coherentPercent >= 60
      && averageCoherence >= 0.8,
    totalBins: usable.length,
    coherentBins: coherent.length,
    coherentPercent,
    averageCoherence,
    reason,
  };
}

/**
 * Conservative cut-only PEQ advisor. It never suggests boosts and caps each
 * starting cut at 4 dB. The result is an operator worksheet, not DSP control.
 */
export function suggestParametricEq(
  points: AutoEqMeasurementPoint[],
  targetProfile: AutoEqTargetProfile = "flat",
): ParametricEqFilter[] {
  if (!assessAutoEqReadiness(points).ready) return [];

  const usable = points
    .filter((point) => isValidPoint(point) && point.coherence >= 0.8)
    .map((point) => ({
      ...point,
      magnitudeDb: point.magnitudeDb - autoEqTargetOffsetDb(point.frequencyHz, targetProfile),
    }))
    .sort((a, b) => a.frequencyHz - b.frequencyHz);

  const octaveWindow = Math.pow(2, 1 / 12);
  const smooth = usable.map((point) => {
    const values = usable
      .filter((candidate) =>
        candidate.frequencyHz >= point.frequencyHz / octaveWindow
        && candidate.frequencyHz <= point.frequencyHz * octaveWindow)
      .map((candidate) => candidate.magnitudeDb);
    return median(values);
  });

  const candidates: ParametricEqFilter[] = [];
  for (let i = 1; i < usable.length - 1; i++) {
    const center = usable[i];
    if (!center || !Number.isFinite(smooth[i])) continue;

    // A strict right-hand comparison retains a single bin for a flat-topped peak.
    if (!(smooth[i] >= smooth[i - 1] && smooth[i] > smooth[i + 1])) continue;

    const low = center.frequencyHz / Math.SQRT2;
    const high = center.frequencyHz * Math.SQRT2;
    const context = usable
      .map((point, index) => ({ point, index }))
      .filter(({ point, index }) =>
        point.frequencyHz >= low
        && point.frequencyHz <= high
        && Math.abs(index - i) > 3)
      .map(({ index }) => smooth[index])
      .filter(Number.isFinite);

    if (context.length < 8) continue;
    const baseline = median(context);
    const excess = smooth[i] - baseline;
    if (!Number.isFinite(excess) || excess < 3) continue;

    const halfPeak = baseline + excess * 0.5;
    let left = i;
    let right = i;
    while (left > 0 && smooth[left - 1] > halfPeak) left--;
    while (right < usable.length - 1 && smooth[right + 1] > halfPeak) right++;

    const leftFrequency = usable[left]?.frequencyHz ?? center.frequencyHz;
    const rightFrequency = usable[right]?.frequencyHz ?? center.frequencyHz;
    const bandwidth = Math.max(center.frequencyHz * 0.06, rightFrequency - leftFrequency);
    const q = Math.max(0.7, Math.min(10, center.frequencyHz / bandwidth));

    candidates.push({
      frequencyHz: Math.round(center.frequencyHz),
      gainDb: -Math.min(4, Math.max(1.5, Math.round(excess * 0.5 * 10) / 10)),
      q: Math.round(q * 10) / 10,
      coherence: center.coherence,
      excessDb: Math.round(excess * 10) / 10,
    });
  }

  const ranked = candidates.sort((a, b) => b.excessDb - a.excessDb);
  const selected: ParametricEqFilter[] = [];
  for (const candidate of ranked) {
    if (selected.every((filter) =>
      Math.abs(Math.log2(candidate.frequencyHz / filter.frequencyHz)) > 1 / 3)) {
      selected.push(candidate);
    }
    if (selected.length >= 6) break;
  }

  return selected.sort((a, b) => a.frequencyHz - b.frequencyHz);
}
