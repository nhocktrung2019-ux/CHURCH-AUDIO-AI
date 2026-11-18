import { estimateRelativeDelayFromPhase, type DelayEvidence, type RelativeDelayEstimate, type PhaseTransferPoint } from "./phaseAlignment";

export type AlignmentSpeakerRole = "main" | "fill" | "sub" | "delay" | "other";

export type AlignmentCapture = {
  id: string;
  zone: string;
  role: AlignmentSpeakerRole;
  sampleRate: number;
  points: PhaseTransferPoint[];
};

export type AlignmentPairResult = {
  referenceZone: string;
  targetZone: string;
  referenceRole: AlignmentSpeakerRole;
  targetRole: AlignmentSpeakerRole;
  estimate: RelativeDelayEstimate;
  recommendedZoneToDelay: string | null;
  recommendedDelayMs: number | null;
  status: "ready" | "blocked";
};

export type PhaseDelayAlignmentReport = {
  ready: boolean;
  pairs: AlignmentPairResult[];
  reason: string;
};

const MIN_COHERENCE = 0.8;
const MAX_PAIR_FREQUENCY_GAP_RATIO = 0.005;

function wrap(value: number): number {
  let phase = value;
  while (phase > 180) phase -= 360;
  while (phase < -180) phase += 360;
  return phase;
}

function phaseDifference(
  reference: PhaseTransferPoint[],
  target: PhaseTransferPoint[],
): Array<{ frequencyHz: number; phaseDeg: number; coherence: number }> {
  const a = reference
    .filter((p) => Number.isFinite(p.frequencyHz) && p.frequencyHz >= 80 && p.frequencyHz <= 10000
      && Number.isFinite(p.phaseDeg) && Number.isFinite(p.coherence) && p.coherence >= MIN_COHERENCE)
    .sort((x, y) => x.frequencyHz - y.frequencyHz);
  const b = target
    .filter((p) => Number.isFinite(p.frequencyHz) && p.frequencyHz >= 80 && p.frequencyHz <= 10000
      && Number.isFinite(p.phaseDeg) && Number.isFinite(p.coherence) && p.coherence >= MIN_COHERENCE)
    .sort((x, y) => x.frequencyHz - y.frequencyHz);

  const raw: Array<{ frequencyHz: number; phaseDeg: number; coherence: number }> = [];
  let cursor = 0;
  let lastTarget = -1;
  for (const point of a) {
    while (cursor + 1 < b.length
      && Math.abs(b[cursor + 1].frequencyHz - point.frequencyHz)
        < Math.abs(b[cursor].frequencyHz - point.frequencyHz)) cursor++;
    const other = b[cursor];
    if (!other || cursor === lastTarget) continue;
    const tolerance = Math.max(2, point.frequencyHz * MAX_PAIR_FREQUENCY_GAP_RATIO);
    if (Math.abs(other.frequencyHz - point.frequencyHz) > tolerance) continue;
    lastTarget = cursor;
    raw.push({
      frequencyHz: (point.frequencyHz + other.frequencyHz) / 2,
      phaseDeg: wrap(other.phaseDeg - point.phaseDeg),
      coherence: Math.min(point.coherence, other.coherence),
    });
  }

  // Unwrap the phase difference along ascending frequency before linear fitting.
  let previous: number | null = null;
  return raw.map((point) => {
    let phaseDeg = point.phaseDeg;
    if (previous !== null) {
      while (phaseDeg - previous > 180) phaseDeg -= 360;
      while (phaseDeg - previous < -180) phaseDeg += 360;
    }
    previous = phaseDeg;
    return { ...point, phaseDeg };
  });
}

/**
 * Builds conservative relative-delay recommendations from simultaneous,
 * phase-calibrated captures. It never writes DSP values.
 *
 * Positive estimate means target arrives later than reference; therefore the
 * reference is the earlier source and is the only side recommended for added delay.
 */
export function analyzePhaseDelayAlignment(
  captures: AlignmentCapture[],
  evidence: DelayEvidence,
): PhaseDelayAlignmentReport {
  const issues: string[] = [];
  const names = captures.map((capture) => capture.zone.trim().toLocaleLowerCase());
  if (captures.length < 2) issues.push("Cần ít nhất hai vùng loa để căn chỉnh tương đối.");
  if (names.some((name) => !name) || new Set(names).size !== names.length)
    issues.push("Tên vùng loa phải có giá trị và không được trùng.");
  if (captures.some((capture) => !Number.isFinite(capture.sampleRate) || capture.sampleRate < 8000))
    issues.push("Sample rate của phép đo không hợp lệ.");
  if (new Set(captures.map((capture) => capture.sampleRate)).size > 1)
    issues.push("Các vùng phải được thu ở cùng sample rate.");

  const pairs: AlignmentPairResult[] = [];
  if (!issues.length) {
    const reference = captures[0]!;
    for (const target of captures.slice(1)) {
      const curve = phaseDifference(reference.points, target.points);
      const estimate = estimateRelativeDelayFromPhase(curve, evidence);
      const positive = estimate.ready && estimate.delayMs !== null;
      pairs.push({
        referenceZone: reference.zone,
        targetZone: target.zone,
        referenceRole: reference.role,
        targetRole: target.role,
        estimate,
        recommendedZoneToDelay: positive
          ? (estimate.delayMs! >= 0 ? reference.zone : target.zone)
          : null,
        recommendedDelayMs: positive ? Math.abs(estimate.delayMs!) : null,
        status: estimate.ready ? "ready" : "blocked",
      });
    }
  }

  const readyPairs = pairs.filter((pair) => pair.status === "ready");
  return {
    ready: issues.length === 0 && readyPairs.length === pairs.length && pairs.length > 0,
    pairs,
    reason: issues[0] ?? (readyPairs.length === pairs.length && pairs.length
      ? "Đã có ước lượng tương đối từ pha unwrapped và dữ liệu đồng bộ; cần xác minh bằng phép đo lặp trước khi nhập DSP."
      : pairs.length
        ? "Một hoặc nhiều cặp chưa đủ bằng chứng đồng bộ/hiệu chuẩn hoặc độ tuyến tính pha; không tạo đề xuất delay cho cặp đó."
        : "Chưa có cặp đo hợp lệ."),
  };
}
