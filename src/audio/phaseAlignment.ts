export type PhaseTransferPoint = {
  frequencyHz: number;
  magnitudeDb: number;
  phaseDeg: number;
  coherence: number;
};

export type PhaseBandComparison = {
  count: number;
  meanPhaseDeg: number | null;
  phaseConcentration: number;
  magnitudeDeltaDb: number | null;
  averageCoherence: number;
  interpretation: string;
};

export type DelayEvidence = {
  simultaneousCapture: boolean;
  sharedHardwareClock: boolean;
  perChannelCalibration: boolean;
  latencyCharacterized: boolean;
};

export type RelativeDelayEstimate = {
  ready: boolean;
  delayMs: number | null;
  slopeDegPerHz: number | null;
  rSquared: number;
  averageCoherence: number;
  samplesUsed: number;
  reason: string;
};

export function wrapPhaseDegrees(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN;
  let result = value;
  while (result > 180) result -= 360;
  while (result < -180) result += 360;
  return result;
}

/**
 * Compares independently captured A/B phase shapes within one crossover band.
 * It reports circular phase/polarity similarity, not an arrival-time difference.
 */
export function comparePhaseInBand(
  referenceA: PhaseTransferPoint[],
  referenceB: PhaseTransferPoint[],
  crossoverHz: number,
  minimumCoherence = 0.8,
): PhaseBandComparison {
  const insufficient = (count: number): PhaseBandComparison => ({
    count,
    meanPhaseDeg: null,
    phaseConcentration: 0,
    magnitudeDeltaDb: null,
    averageCoherence: 0,
    interpretation: "Không đủ điểm có coherence cao trong dải crossover để so sánh.",
  });

  if (!Number.isFinite(crossoverHz) || crossoverHz <= 0) return insufficient(0);
  const low = crossoverHz / Math.SQRT2;
  const high = crossoverHz * Math.SQRT2;
  const aPoints = referenceA
    .filter((point) => Number.isFinite(point.frequencyHz)
      && point.frequencyHz >= low && point.frequencyHz <= high
      && Number.isFinite(point.phaseDeg) && Number.isFinite(point.magnitudeDb)
      && Number.isFinite(point.coherence) && point.coherence >= minimumCoherence)
    .sort((a, b) => a.frequencyHz - b.frequencyHz);
  const bPoints = referenceB
    .filter((point) => Number.isFinite(point.frequencyHz)
      && Number.isFinite(point.phaseDeg) && Number.isFinite(point.magnitudeDb)
      && Number.isFinite(point.coherence) && point.coherence >= minimumCoherence)
    .sort((a, b) => a.frequencyHz - b.frequencyHz);

  const pairs: Array<{ phase: number; magnitude: number; weight: number; coherence: number }> = [];
  let cursor = 0;
  let previousBIndex = -1;
  for (const a of aPoints) {
    while (cursor + 1 < bPoints.length
      && Math.abs(bPoints[cursor + 1].frequencyHz - a.frequencyHz)
        < Math.abs(bPoints[cursor].frequencyHz - a.frequencyHz)) {
      cursor++;
    }
    const b = bPoints[cursor];
    if (!b || cursor === previousBIndex) continue;
    const toleranceHz = Math.max(2, a.frequencyHz * 0.005);
    if (Math.abs(b.frequencyHz - a.frequencyHz) > toleranceHz) continue;

    previousBIndex = cursor;
    const coherence = Math.min(a.coherence, b.coherence);
    pairs.push({
      phase: wrapPhaseDegrees(b.phaseDeg - a.phaseDeg) * Math.PI / 180,
      magnitude: b.magnitudeDb - a.magnitudeDb,
      weight: coherence * coherence,
      coherence,
    });
  }

  if (pairs.length < 5) return insufficient(pairs.length);
  const totalWeight = pairs.reduce((sum, pair) => sum + pair.weight, 0);
  if (!(totalWeight > 0)) return insufficient(pairs.length);

  const sin = pairs.reduce((sum, pair) => sum + Math.sin(pair.phase) * pair.weight, 0) / totalWeight;
  const cos = pairs.reduce((sum, pair) => sum + Math.cos(pair.phase) * pair.weight, 0) / totalWeight;
  const meanPhaseDeg = Math.atan2(sin, cos) * 180 / Math.PI;
  const phaseConcentration = Math.min(1, Math.hypot(sin, cos));
  const magnitudeDeltaDb = pairs.reduce((sum, pair) => sum + pair.magnitude * pair.weight, 0) / totalWeight;
  const averageCoherence = pairs.reduce((sum, pair) => sum + pair.coherence * pair.weight, 0) / totalWeight;
  const absolute = Math.abs(meanPhaseDeg);

  const interpretation = phaseConcentration < 0.7
    ? "Pha thay đổi nhiều trong dải crossover; kiểm tra vị trí đo, phản xạ, crossover và thực hiện phép đo đồng thời."
    : absolute >= 135
      ? "Có dấu hiệu polarity gần đối nhau trong dải kiểm tra. Xác minh polarity bằng phép thử và đo lại trước khi đổi dây/DSP."
      : absolute <= 45
        ? "Pha trung bình gần trùng trong dải kiểm tra. Vẫn cần xác minh tại nhiều vị trí nghe."
        : "Có chênh lệch pha đáng kể trong dải crossover; kiểm tra delay, crossover và vị trí đặt loa.";

  return {
    count: pairs.length,
    meanPhaseDeg,
    phaseConcentration,
    magnitudeDeltaDb,
    averageCoherence,
    interpretation,
  };
}

/**
 * Estimates equivalent delay only from an unwrapped phase-difference curve
 * measured simultaneously with a common sample clock and characterized latency.
 * Sequential A/B captures must never be passed as a substitute.
 */
export function estimateRelativeDelayFromPhase(
  unwrappedPhaseDifference: Array<{ frequencyHz: number; phaseDeg: number; coherence: number }>,
  evidence: DelayEvidence,
): RelativeDelayEstimate {
  const missing = [
    !evidence.simultaneousCapture && "cần thu đồng thời hai kênh",
    !evidence.sharedHardwareClock && "cần chung hardware clock",
    !evidence.perChannelCalibration && "cần hiệu chuẩn riêng từng kênh",
    !evidence.latencyCharacterized && "cần đo/hiệu chỉnh latency",
  ].filter(Boolean);

  if (missing.length) {
    return {
      ready: false, delayMs: null, slopeDegPerHz: null, rSquared: 0,
      averageCoherence: 0, samplesUsed: 0,
      reason: "Chưa đủ điều kiện đo delay tuyệt đối: " + missing.join("; ") + ".",
    };
  }

  const usable = unwrappedPhaseDifference
    .filter((point) => Number.isFinite(point.frequencyHz)
      && point.frequencyHz >= 80 && point.frequencyHz <= 10000
      && Number.isFinite(point.phaseDeg)
      && Number.isFinite(point.coherence) && point.coherence >= 0.8)
    .sort((a, b) => a.frequencyHz - b.frequencyHz);

  const span = usable.length
    ? usable[usable.length - 1].frequencyHz - usable[0].frequencyHz
    : 0;
  if (usable.length < 12 || span < 500) {
    return {
      ready: false, delayMs: null, slopeDegPerHz: null, rSquared: 0,
      averageCoherence: 0, samplesUsed: usable.length,
      reason: "Cần ít nhất 12 điểm coherence ≥ 0.80 trải trên tối thiểu 500 Hz.",
    };
  }

  const weights = usable.map((point) => point.coherence * point.coherence);
  const sumWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const meanX = usable.reduce((sum, point, index) => sum + point.frequencyHz * weights[index], 0) / sumWeight;
  const meanY = usable.reduce((sum, point, index) => sum + point.phaseDeg * weights[index], 0) / sumWeight;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < usable.length; i++) {
    const dx = usable[i].frequencyHz - meanX;
    const dy = usable[i].phaseDeg - meanY;
    covariance += weights[i] * dx * dy;
    varianceX += weights[i] * dx * dx;
    varianceY += weights[i] * dy * dy;
  }
  const slope = varianceX > 0 ? covariance / varianceX : Number.NaN;
  const intercept = meanY - slope * meanX;
  let residualEnergy = 0;
  for (let i = 0; i < usable.length; i++) {
    const residual = usable[i].phaseDeg - (intercept + slope * usable[i].frequencyHz);
    residualEnergy += weights[i] * residual * residual;
  }
  const rSquared = varianceY > 0 ? Math.max(0, Math.min(1, 1 - residualEnergy / varianceY)) : 0;
  const averageCoherence = usable.reduce((sum, point, index) => sum + point.coherence * weights[index], 0) / sumWeight;
  const delayMs = -slope / 360 * 1000;

  if (!Number.isFinite(delayMs) || Math.abs(delayMs) > 100 || rSquared < 0.8) {
    return {
      ready: false, delayMs: null, slopeDegPerHz: slope, rSquared, averageCoherence,
      samplesUsed: usable.length,
      reason: "Đường pha chưa đủ tuyến tính hoặc delay ước lượng nằm ngoài ±100 ms; không đưa ra giá trị căn chỉnh.",
    };
  }

  return {
    ready: true,
    delayMs,
    slopeDegPerHz: slope,
    rSquared,
    averageCoherence,
    samplesUsed: usable.length,
    reason: "Ước lượng delay tương đối từ pha unwrapped và hai kênh đồng bộ; vẫn phải xác minh bằng phép đo lặp.",
  };
}
