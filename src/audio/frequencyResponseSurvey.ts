import { analyzeMeasurementRepeatability } from "./measurementRepeatability.ts";
import type { TransferResult, TransferPoint } from "./transfer.ts";

export type FrequencyPositionSession = {
  zone: string;
  position: string;
  repeats: TransferResult[];
};

export type FrequencyPositionStatus = "ready" | "review" | "blocked";
export type FrequencyPositionAssessment = {
  zone: string;
  position: string;
  status: FrequencyPositionStatus;
  repeatCount: number;
  reason: string;
  acceptedPointCount: number;
};

export type ZoneFrequencyBand = {
  frequencyHz: number;
  positionCount: number;
  meanMagnitudeDb: number | null;
  spatialSpreadDb: number | null;
  meanCoherence: number | null;
  status: "supported" | "spatial-variance" | "insufficient-coverage";
};

export type ZoneFrequencySurvey = {
  zone: string;
  acceptedPositionCount: number;
  bands: ZoneFrequencyBand[];
};

export type FrequencyResponseSurvey = {
  status: "ready" | "review" | "blocked";
  sampleRate: number | null;
  analysisMode: "mono-acoustic" | "synchronous-dual-channel" | null;
  positionAssessments: FrequencyPositionAssessment[];
  zones: ZoneFrequencySurvey[];
  notes: string[];
};

const MIN_POSITIONS = 3;
const MIN_POSITION_COVERAGE = 0.8;
const MAX_INTERPOLATION_GAP_OCTAVES = 0.25;
const MIN_COHERENCE = 0.8;
const MAX_SPATIAL_SPREAD_DB = 8;

function interpolate(points: TransferPoint[], frequencyHz: number): TransferPoint | null {
  const usable = points.filter((point) =>
    Number.isFinite(point.frequencyHz) && point.frequencyHz > 0 &&
    Number.isFinite(point.magnitudeDb) && Number.isFinite(point.phaseDeg) &&
    Number.isFinite(point.coherence) && point.coherence >= MIN_COHERENCE && point.coherence <= 1
  ).sort((a, b) => a.frequencyHz - b.frequencyHz);
  let low = 0;
  let high = usable.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const point = usable[middle];
    if (!point) return null;
    if (Math.abs(point.frequencyHz - frequencyHz) < 1e-6) return point;
    if (point.frequencyHz < frequencyHz) low = middle + 1;
    else high = middle - 1;
  }
  const left = usable[high];
  const right = usable[low];
  if (!left || !right) return null;
  const span = Math.log2(right.frequencyHz / left.frequencyHz);
  if (!Number.isFinite(span) || span <= 0 || span > MAX_INTERPOLATION_GAP_OCTAVES) return null;
  const fraction = Math.log2(frequencyHz / left.frequencyHz) / span;
  if (fraction < 0 || fraction > 1) return null;
  const phaseDelta = ((right.phaseDeg - left.phaseDeg + 540) % 360) - 180;
  return {
    frequencyHz,
    magnitudeDb: left.magnitudeDb + (right.magnitudeDb - left.magnitudeDb) * fraction,
    phaseDeg: ((left.phaseDeg + phaseDelta * fraction + 540) % 360) - 180,
    coherence: Math.min(left.coherence, right.coherence),
  };
}

function chainSignature(capture: TransferResult): string | null {
  const metadata = capture.captureMetadata;
  if (!metadata || metadata.analysisMode !== "mono-acoustic" || metadata.captureEngine !== "AudioWorklet") return null;
  return JSON.stringify({
    sampleRate: capture.sampleRate,
    captureEngine: metadata.captureEngine,
    inputChannelCount: metadata.inputChannelCount,
    pcmChannelCount: metadata.pcmChannelCount,
    channelMix: metadata.channelMix,
    trackChannelCount: metadata.trackChannelCount,
    trackSampleRate: metadata.trackSampleRate,
    analysisMode: metadata.analysisMode,
  });
}

/**
 * Builds a multi-zone response survey from repeatable fixed-position captures.
 * It never fabricates missing bins or applies EQ. Spatial variance is surfaced,
 * not hidden by averaging.
 */
export function buildFrequencyResponseSurvey(
  sessions: FrequencyPositionSession[],
  minimumPositions = MIN_POSITIONS,
): FrequencyResponseSurvey {
  const notes: string[] = [];
  if (!Number.isInteger(minimumPositions) || minimumPositions < MIN_POSITIONS || minimumPositions > 8) {
    return {
      status: "blocked", sampleRate: null, analysisMode: null, positionAssessments: [], zones: [],
      notes: ["Số vị trí tối thiểu phải từ 3 đến 8."],
    };
  }
  if (!sessions.length) {
    return {
      status: "blocked", sampleRate: null, analysisMode: null, positionAssessments: [], zones: [],
      notes: ["Chưa có phiên đo đáp tuyến."],
    };
  }

  const assessment: FrequencyPositionAssessment[] = [];
  const prepared: Array<{ zone: string; position: string; result: TransferResult }> = [];
  for (const session of sessions) {
    const zone = session.zone.trim();
    const position = session.position.trim();
    if (!zone || !position || !Array.isArray(session.repeats) || !session.repeats.length) {
      assessment.push({
        zone, position, status: "blocked", repeatCount: session.repeats?.length ?? 0,
        reason: "Thiếu tên vùng/vị trí hoặc dữ liệu đo lặp.", acceptedPointCount: 0,
      });
      continue;
    }
    const repeatability = analyzeMeasurementRepeatability(session.repeats);
    if (!repeatability.ready || !repeatability.result) {
      assessment.push({
        zone, position, status: "blocked", repeatCount: session.repeats.length,
        reason: repeatability.reason, acceptedPointCount: 0,
      });
      continue;
    }
    const metadataKeys = session.repeats.map(chainSignature);
    if (metadataKeys.some((key) => key === null) || new Set(metadataKeys).size !== 1) {
      assessment.push({
        zone, position, status: "blocked", repeatCount: session.repeats.length,
        reason: "Chuỗi thu PCM không đồng nhất hoặc không phải mono AudioWorklet.", acceptedPointCount: 0,
      });
      continue;
    }
    prepared.push({ zone, position, result: repeatability.result });
    assessment.push({
      zone, position, status: "ready", repeatCount: session.repeats.length,
      reason: "Đo lặp đạt kiểm tra độ ổn định tại vị trí cố định.", acceptedPointCount: repeatability.result.points.length,
    });
  }

  const accepted = assessment.filter((item) => item.status === "ready");
  const uniqueLocationKeys = accepted.map((item) => item.zone.toLocaleLowerCase("vi") + "|" + item.position.toLocaleLowerCase("vi"));
  if (new Set(uniqueLocationKeys).size !== uniqueLocationKeys.length) {
    return {
      status: "blocked", sampleRate: null, analysisMode: null, positionAssessments: assessment, zones: [],
      notes: ["Có vùng/vị trí bị trùng tên; mỗi điểm khảo sát cần một định danh riêng."],
    };
  }
  const acceptedSessions = prepared.filter((item) =>
    accepted.some((a) => a.zone === item.zone && a.position === item.position));
  const first = acceptedSessions[0]?.result;
  if (!first) {
    return {
      status: "blocked", sampleRate: null, analysisMode: null, positionAssessments: assessment, zones: [],
      notes: ["Không có vị trí nào đạt kiểm tra đo lặp."],
    };
  }
  const signatures = acceptedSessions.map((item) => chainSignature(item.result));
  if (signatures.some((signature) => signature === null) || new Set(signatures).size !== 1) {
    return {
      status: "blocked", sampleRate: null, analysisMode: null, positionAssessments: assessment, zones: [],
      notes: ["Các vị trí không dùng cùng cấu hình input, sample rate hoặc metadata thu PCM."],
    };
  }

  const zones = [...new Set(acceptedSessions.map((item) => item.zone))].sort((a, b) => a.localeCompare(b, "vi"));
  const zoneResults: ZoneFrequencySurvey[] = [];
  for (const zone of zones) {
    const locations = acceptedSessions.filter((item) => item.zone === zone);
    const statusForZone = assessment.filter((item) => item.zone === zone);
    if (locations.length < minimumPositions) {
      notes.push(zone + ": chỉ có " + locations.length + " vị trí đạt kiểm tra; cần tối thiểu " + minimumPositions + ".");
      for (const item of statusForZone) {
        if (item.status === "ready") {
          item.status = "review";
          item.reason += " Số vị trí toàn vùng chưa đủ để khảo sát không gian.";
        }
      }
      zoneResults.push({ zone, acceptedPositionCount: locations.length, bands: [] });
      continue;
    }

    const anchor = [...locations].sort((a, b) => b.result.points.length - a.result.points.length)[0];
    if (!anchor) {
      zoneResults.push({ zone, acceptedPositionCount: locations.length, bands: [] });
      continue;
    }
    const minimumCount = Math.max(minimumPositions, Math.ceil(locations.length * MIN_POSITION_COVERAGE));
    const bands: ZoneFrequencyBand[] = [];
    for (const referencePoint of anchor.result.points) {
      if (!Number.isFinite(referencePoint.frequencyHz) || referencePoint.frequencyHz < 80 || referencePoint.frequencyHz > 10000) continue;
      const samples = locations.flatMap((location) => {
        const point = interpolate(location.result.points, referencePoint.frequencyHz);
        return point ? [point] : [];
      });
      if (samples.length < minimumCount) {
        bands.push({
          frequencyHz: referencePoint.frequencyHz, positionCount: samples.length,
          meanMagnitudeDb: null, spatialSpreadDb: null, meanCoherence: null,
          status: "insufficient-coverage",
        });
        continue;
      }
      const magnitudes = samples.map((point) => point.magnitudeDb);
      const spread = Math.max(...magnitudes) - Math.min(...magnitudes);
      const mean = magnitudes.reduce((sum, value) => sum + value, 0) / magnitudes.length;
      const coherence = samples.reduce((sum, point) => sum + point.coherence, 0) / samples.length;
      bands.push({
        frequencyHz: referencePoint.frequencyHz, positionCount: samples.length,
        meanMagnitudeDb: spread > MAX_SPATIAL_SPREAD_DB ? null : mean,
        spatialSpreadDb: spread, meanCoherence: coherence,
        status: spread > MAX_SPATIAL_SPREAD_DB ? "spatial-variance" : "supported",
      });
    }
    zoneResults.push({ zone, acceptedPositionCount: locations.length, bands });
  }

  const anyBlocked = assessment.some((item) => item.status === "blocked");
  const anyReview = assessment.some((item) => item.status === "review") ||
    zoneResults.some((zone) => zone.bands.some((band) => band.status !== "supported"));
  if (anyBlocked) notes.push("Một số vị trí bị loại khỏi phép tổng hợp; hãy xem lý do và đo lại trước khi cân chỉnh.");
  if (anyReview) notes.push("Có dải tần thiếu độ phủ hoặc biến thiên không gian lớn; không dùng các bin đó để đề xuất PEQ.");
  if (zones.length === 0) notes.push("Không có vùng nào đạt đủ số vị trí khảo sát.");

  return {
    status: anyBlocked || zones.length === 0 ? "blocked" : anyReview ? "review" : "ready",
    sampleRate: first.sampleRate,
    analysisMode: first.analysisMode ?? first.captureMetadata?.analysisMode ?? null,
    positionAssessments: assessment,
    zones: zoneResults,
    notes,
  };
}
