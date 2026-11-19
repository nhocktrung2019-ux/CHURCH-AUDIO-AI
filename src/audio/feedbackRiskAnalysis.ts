export type FeedbackSpectrumFrame = {
  id: string;
  zone: string;
  position: string;
  capturedAtMs: number;
  /** Monotonic frequency bins in Hz. */
  frequencyBinsHz: number[];
  /** Linear analyzer levels in dBFS. Never dB SPL. */
  magnitudeDbfs: number[];
  /** Measured or conservatively estimated input-chain noise floor, dBFS. */
  noiseFloorDbfs: number;
};

export type FeedbackCandidate = {
  frequencyHz: number;
  persistence: number;
  medianProminenceDb: number;
  medianLevelDbfs: number;
  medianMarginAboveNoiseDb: number;
  frequencySpreadPercent: number;
  risk: "elevated" | "high";
  score: number;
  framesPresent: number;
  totalFrames: number;
};

export type FeedbackRiskAnalysis = {
  id: string;
  zone: string;
  position: string;
  capturedAtMs: number | null;
  status: "clear" | "watch" | "alert" | "blocked";
  unit: "dBFS";
  candidates: FeedbackCandidate[];
  checks: Array<{ id: string; status: "pass" | "warning" | "fail"; detail: string }>;
  note: string;
};

export type FeedbackAlertEvent = {
  zone: string;
  position: string;
  frequencyHz: number;
  event: "raised" | "sustained" | "cleared";
  capturedAtMs: number;
  risk: "elevated" | "high" | "none";
};

const finite = (n: number) => Number.isFinite(n);
const median = (values: number[]) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const frequencyDistance = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b);

export function analyzeFeedbackRisk(
  frames: FeedbackSpectrumFrame[],
  options: {
    minimumFrames?: number;
    minimumPersistence?: number;
    minimumPeakProminenceDb?: number;
    minimumAboveNoiseDb?: number;
    highRiskProminenceDb?: number;
    highRiskPersistence?: number;
    frequencyTolerancePercent?: number;
  } = {},
): FeedbackRiskAnalysis {
  const first = frames[0];
  const zone = first?.zone ?? "";
  const position = first?.position ?? "";
  const checks: FeedbackRiskAnalysis["checks"] = [];
  const add = (id: string, status: "pass" | "warning" | "fail", detail: string) =>
    checks.push({ id, status, detail });
  const blocked = (id: string, detail: string): FeedbackRiskAnalysis => {
    add(id, "fail", detail);
    return {
      id: first?.id ?? "invalid-capture", zone, position, capturedAtMs: null, status: "blocked",
      unit: "dBFS", candidates: [], checks,
      note: "Không đủ dữ liệu phổ hợp lệ để đánh giá nguy cơ hú rít.",
    };
  };

  const minimumFrames = options.minimumFrames ?? 5;
  const minimumPersistence = options.minimumPersistence ?? 0.7;
  const minProminence = options.minimumPeakProminenceDb ?? 8;
  const minAboveNoise = options.minimumAboveNoiseDb ?? 10;
  const tolerance = (options.frequencyTolerancePercent ?? 1.5) / 100;
  if (!Array.isArray(frames) || frames.length < minimumFrames) {
    return blocked("frame-count", "Cần tối thiểu " + minimumFrames + " khung phổ thực đo.");
  }
  if (!zone.trim() || !position.trim() || frames.some(f => f.zone !== zone || f.position !== position)) {
    return blocked("location-consistency", "Một lượt phân tích chỉ được chứa cùng một vùng và vị trí đo.");
  }
  const sorted = [...frames].sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  if (sorted.some((f, i) => !f.id?.trim() || !finite(f.capturedAtMs) ||
      (i > 0 && f.capturedAtMs <= sorted[i - 1].capturedAtMs))) {
    return blocked("timestamps", "ID và timestamp phải hợp lệ, tăng đơn điệu.");
  }
  const referenceBins = sorted[0].frequencyBinsHz;
  if (!Array.isArray(referenceBins) || referenceBins.length < 16 ||
      referenceBins.some((v, i) => !finite(v) || v <= 0 || (i > 0 && v <= referenceBins[i - 1]))) {
    return blocked("frequency-grid", "Lưới tần số phải hữu hạn, dương và tăng đơn điệu.");
  }
  for (const frame of sorted) {
    if (!Array.isArray(frame.magnitudeDbfs) || frame.magnitudeDbfs.length !== referenceBins.length ||
        frame.frequencyBinsHz.length !== referenceBins.length ||
        frame.frequencyBinsHz.some((v, i) => Math.abs(v - referenceBins[i]) > Math.max(0.01, referenceBins[i] * 1e-6)) ||
        frame.magnitudeDbfs.some(v => !finite(v) || v > 0 || v < -180) ||
        !finite(frame.noiseFloorDbfs) || frame.noiseFloorDbfs > 0 || frame.noiseFloorDbfs < -180) {
      return blocked("spectrum-integrity", "Khung phổ không đồng nhất hoặc có mức dBFS/noise floor không hợp lệ.");
    }
  }
  add("spectrum-integrity", "pass", "Các khung phổ có cùng lưới tần số và dữ liệu dBFS hợp lệ.");

  type Peak = { frequencyHz: number; prominenceDb: number; levelDbfs: number; marginDb: number };
  const peaksByFrame: Peak[][] = sorted.map(frame => {
    const peaks: Peak[] = [];
    for (let i = 2; i < referenceBins.length - 2; i++) {
      const value = frame.magnitudeDbfs[i];
      if (value < frame.magnitudeDbfs[i - 1] || value <= frame.magnitudeDbfs[i + 1]) continue;
      const localFloor = median([
        frame.magnitudeDbfs[i - 2], frame.magnitudeDbfs[i - 1],
        frame.magnitudeDbfs[i + 1], frame.magnitudeDbfs[i + 2],
      ]);
      const prominenceDb = value - localFloor;
      const marginDb = value - frame.noiseFloorDbfs;
      if (prominenceDb >= minProminence && marginDb >= minAboveNoise) {
        peaks.push({ frequencyHz: referenceBins[i], prominenceDb, levelDbfs: value, marginDb });
      }
    }
    return peaks;
  });

  const clusters: Peak[][] = [];
  for (const framePeaks of peaksByFrame) {
    for (const peak of framePeaks) {
      let cluster = clusters.find(c => frequencyDistance(median(c.map(p => p.frequencyHz)), peak.frequencyHz) <= tolerance);
      if (!cluster) { cluster = []; clusters.push(cluster); }
      cluster.push(peak);
    }
  }
  const candidates: FeedbackCandidate[] = [];
  for (const cluster of clusters) {
    const frequencies = cluster.map(p => p.frequencyHz);
    const frequencyHz = median(frequencies);
    const presentFrames = new Set<number>();
    for (let i = 0; i < peaksByFrame.length; i++) {
      if (peaksByFrame[i].some(p => frequencyDistance(p.frequencyHz, frequencyHz) <= tolerance)) presentFrames.add(i);
    }
    const persistence = presentFrames.size / sorted.length;
    const frequencySpreadPercent = ((Math.max(...frequencies) - Math.min(...frequencies)) / frequencyHz) * 100;
    if (presentFrames.size < minimumFrames || persistence < minimumPersistence || frequencySpreadPercent > (options.frequencyTolerancePercent ?? 1.5)) continue;
    const medianProminenceDb = median(cluster.map(p => p.prominenceDb));
    const medianLevelDbfs = median(cluster.map(p => p.levelDbfs));
    const medianMarginAboveNoiseDb = median(cluster.map(p => p.marginDb));
    const high = medianProminenceDb >= (options.highRiskProminenceDb ?? 12) &&
      persistence >= (options.highRiskPersistence ?? 0.85) && medianMarginAboveNoiseDb >= 15;
    const score = Math.max(0, Math.min(100,
      40 * persistence + 3 * medianProminenceDb + 0.5 * medianMarginAboveNoiseDb));
    candidates.push({
      frequencyHz, persistence, medianProminenceDb, medianLevelDbfs,
      medianMarginAboveNoiseDb, frequencySpreadPercent,
      risk: high ? "high" : "elevated", score,
      framesPresent: presentFrames.size, totalFrames: sorted.length,
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  add("persistence", candidates.length ? "warning" : "pass",
    candidates.length ? "Có đỉnh hẹp ổn định theo thời gian; cần xác minh bằng nghe và đo tại hiện trường." :
      "Chưa phát hiện ứng viên đạt ngưỡng persistence/prominence.");
  return {
    id: sorted[sorted.length - 1].id, zone, position, capturedAtMs: sorted[sorted.length - 1].capturedAtMs,
    status: candidates.some(c => c.risk === "high") ? "alert" : candidates.length ? "watch" : "clear",
    unit: "dBFS", candidates, checks,
    note: "Đây là cảnh báo nguy cơ hú rít, không phải kết luận chắc chắn. Âm sắc nhạc/feedback có thể giống nhau; xác minh bằng kỹ thuật viên. Không tự notch EQ, mute hoặc ghi DSP.",
  };
}

/** Build an auditable event history with a configurable number of clear windows. */
export function buildFeedbackAlertHistory(
  analyses: FeedbackRiskAnalysis[],
  clearAfterWindows = 3,
): FeedbackAlertEvent[] {
  const events: FeedbackAlertEvent[] = [];
  const active = new Map<string, { candidate: FeedbackCandidate; missing: number }>();
  const ordered = [...analyses].sort((a, b) =>
    (a.capturedAtMs ?? 0) - (b.capturedAtMs ?? 0));
  for (const analysis of ordered) {
    if (analysis.capturedAtMs === null) continue;
    const currentKeys = new Set<string>();

    for (const candidate of analysis.candidates) {
      const key = analysis.zone + "|" + analysis.position + "|" + Math.round(candidate.frequencyHz / 5);
      currentKeys.add(key);
      const existing = active.get(key);
      events.push({
        zone: analysis.zone, position: analysis.position, frequencyHz: candidate.frequencyHz,
        event: existing ? "sustained" : "raised", capturedAtMs: analysis.capturedAtMs,
        risk: candidate.risk,
      });
      active.set(key, { candidate, missing: 0 });
    }
    for (const [key, state] of active) {
      if (key.startsWith(analysis.zone + "|" + analysis.position + "|") && !currentKeys.has(key)) {
        state.missing++;
        if (state.missing >= clearAfterWindows) {
          events.push({
            zone: analysis.zone, position: analysis.position,
            frequencyHz: state.candidate.frequencyHz, event: "cleared",
            capturedAtMs: analysis.capturedAtMs, risk: "none",
          });
          active.delete(key);
        }
      }
    }
  }
  return events;
}
