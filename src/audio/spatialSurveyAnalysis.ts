import type { ZoneSplRecord } from "./zoneSplUniformity.ts";

export type ZonePairPoint = { position: string; zoneADb: number; zoneBDb: number; deltaDb: number };
export type ZonePairComparison = {
  status: "ready" | "insufficient" | "blocked";
  zoneA: string; zoneB: string; inputLabel: string;
  matchedPositionCount: number; zoneAMeanDb: number | null; zoneBMeanDb: number | null;
  deltaDb: number | null; points: ZonePairPoint[]; reason: string;
};
export type SeatRowSummary = {
  zone: string; row: string; positionCount: number; captureCount: number;
  meanDb: number; minDb: number; maxDb: number; spreadDb: number; standardDeviationDb: number;
};
export type DistanceAttenuationPoint = {
  position: string; distanceM: number; measuredDb: number; fittedDb: number;
};
export type DistanceAttenuationResult = {
  status: "ready" | "insufficient" | "blocked";
  speakerName: string; zone: string; pointCount: number;
  slopeDbPerDecade: number | null; rSquared: number | null;
  points: DistanceAttenuationPoint[]; reason: string;
};
export type ZoneTrimAdvisory = {
  status: "review-only" | "blocked";
  referenceZone: string; adjustmentZone: string;
  rawDifferenceDb: number | null; suggestedTrimDb: number | null;
  matchedPositionCount: number; writeEnabled: false; reason: string;
};
export type SpeakerReference = { id: number; name: string; zone: string; x: number; y: number; z: number };

const finite = (value: number) => Number.isFinite(value);
const positionKey = (value: string) => value.trim().toLocaleLowerCase("vi");

function eligibleCalibratedRecords(records: ZoneSplRecord[]): { records: ZoneSplRecord[]; inputLabel: string } | null {
  if (!records.length || records.some(record =>
    record.unit !== "dB SPL" || !record.zone.trim() || !record.position.trim() ||
    !record.inputLabel.trim() || !finite(record.levelDb) || record.levelDb <= -99 || record.levelDb > 200 ||
    !finite(record.durationSeconds) || record.durationSeconds <= 0 ||
    !finite(record.timestamp) || !finite(record.calibrationOffsetDb as number)
  )) return null;
  const inputs = new Set(records.map(record => record.inputLabel.trim()));
  const offsets = records.map(record => record.calibrationOffsetDb as number);
  if (inputs.size !== 1 || Math.max(...offsets) - Math.min(...offsets) > 0.01) return null;
  return { records, inputLabel: [...inputs][0] };
}

function aggregateByPosition(records: ZoneSplRecord[]) {
  const groups = new Map<string, ZoneSplRecord[]>();
  for (const record of records) {
    const key = positionKey(record.position);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const result = new Map<string, { label: string; levelDb: number; captureCount: number; xM: number | null; yM: number | null }>();
  for (const [key, captures] of groups) {
    const duration = captures.reduce((sum, item) => sum + item.durationSeconds, 0);
    const energy = captures.reduce((sum, item) => sum + 10 ** (item.levelDb / 10) * item.durationSeconds, 0) / duration;
    if (!(duration > 0) || !(energy > 0) || !finite(energy)) continue;
    const xs = captures.map(item => item.xM).filter((item): item is number => finite(item as number));
    const ys = captures.map(item => item.yM).filter((item): item is number => finite(item as number));
    result.set(key, {
      label: captures[0].position.trim(), levelDb: 10 * Math.log10(energy),
      captureCount: captures.length,
      xM: xs.length === captures.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null,
      yM: ys.length === captures.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null,
    });
  }
  return result;
}

/** v0.82: compare two measured zones only at matching position labels and a common calibrated input chain. */
export function compareMeasuredZonePair(records: ZoneSplRecord[], zoneA: string, zoneB: string): ZonePairComparison {
  const empty = (status: ZonePairComparison["status"], reason: string, inputLabel = ""): ZonePairComparison => ({
    status, zoneA, zoneB, inputLabel, matchedPositionCount: 0,
    zoneAMeanDb: null, zoneBMeanDb: null, deltaDb: null, points: [], reason,
  });
  if (!zoneA.trim() || !zoneB.trim() || zoneA === zoneB) return empty("blocked", "Choose two different named zones.");
  const selected = records.filter(record => record.zone === zoneA || record.zone === zoneB);
  const eligible = eligibleCalibratedRecords(selected);
  if (!eligible) return empty("blocked", "Selected zones need calibrated dB SPL records from the same input and calibration offset.");
  const a = aggregateByPosition(selected.filter(record => record.zone === zoneA));
  const b = aggregateByPosition(selected.filter(record => record.zone === zoneB));
  const keys = [...a.keys()].filter(key => b.has(key)).sort();
  const points = keys.map(key => {
    const left = a.get(key)!; const right = b.get(key)!;
    return { position: left.label, zoneADb: left.levelDb, zoneBDb: right.levelDb, deltaDb: left.levelDb - right.levelDb };
  });
  if (points.length < 2) return {
    ...empty("insufficient", "At least two matching listening-position labels are required.", eligible.inputLabel),
    matchedPositionCount: points.length, points,
  };
  const zoneAMeanDb = points.reduce((sum, point) => sum + point.zoneADb, 0) / points.length;
  const zoneBMeanDb = points.reduce((sum, point) => sum + point.zoneBDb, 0) / points.length;
  return {
    status: "ready", zoneA, zoneB, inputLabel: eligible.inputLabel, matchedPositionCount: points.length,
    zoneAMeanDb, zoneBMeanDb, deltaDb: zoneAMeanDb - zoneBMeanDb, points,
    reason: "Comparison is limited to matched position labels; verify that the labels describe equivalent listening locations.",
  };
}

function parseSeatRow(position: string): string | null {
  const match = position.match(/(?:hàng\s*ghế|row)\s*([0-9]+[a-z]?)/iu);
  return match ? "Hàng ghế " + match[1].toLocaleUpperCase("vi") : null;
}

/** v0.83: summarize rows using duration-weighted energy averages per distinct position first. */
export function analyzeSeatRowUniformity(records: ZoneSplRecord[]): SeatRowSummary[] {
  const eligible = eligibleCalibratedRecords(records);
  if (!eligible) return [];
  const zones = [...new Set(records.map(record => record.zone))].sort((a, b) => a.localeCompare(b, "vi"));
  const output: SeatRowSummary[] = [];
  for (const zone of zones) {
    const byPosition = aggregateByPosition(records.filter(record => record.zone === zone));
    const rows = new Map<string, Array<{ levelDb: number; captureCount: number }>>();
    for (const item of byPosition.values()) {
      const row = parseSeatRow(item.label);
      if (!row) continue;
      rows.set(row, [...(rows.get(row) ?? []), { levelDb: item.levelDb, captureCount: item.captureCount }]);
    }
    for (const [row, points] of rows) {
      const levels = points.map(point => point.levelDb);
      const meanDb = levels.reduce((sum, value) => sum + value, 0) / levels.length;
      const variance = levels.reduce((sum, value) => sum + (value - meanDb) ** 2, 0) / levels.length;
      output.push({
        zone, row, positionCount: levels.length,
        captureCount: points.reduce((sum, point) => sum + point.captureCount, 0),
        meanDb, minDb: Math.min(...levels), maxDb: Math.max(...levels),
        spreadDb: Math.max(...levels) - Math.min(...levels), standardDeviationDb: Math.sqrt(variance),
      });
    }
  }
  return output.sort((a, b) => a.zone.localeCompare(b.zone, "vi") || a.row.localeCompare(b.row, "vi"));
}

/** v0.84: empirical level-vs-log-distance regression; not a free-field or loudspeaker prediction model. */
export function analyzeMeasuredDistanceAttenuation(
  records: ZoneSplRecord[], speaker: SpeakerReference, earHeightM = 1.2,
): DistanceAttenuationResult {
  const blocked = (reason: string): DistanceAttenuationResult => ({
    status: "blocked", speakerName: speaker.name, zone: speaker.zone, pointCount: 0,
    slopeDbPerDecade: null, rSquared: null, points: [], reason,
  });
  if (![speaker.x, speaker.y, speaker.z, earHeightM].every(finite) || earHeightM < 0 || !speaker.zone.trim())
    return blocked("Speaker coordinates and listener ear height must be valid.");
  const selected = records.filter(record => record.zone === speaker.zone);
  const eligible = eligibleCalibratedRecords(selected);
  if (!eligible) return blocked("This zone needs one consistent calibrated dB SPL input chain.");
  const positions = aggregateByPosition(selected);
  const points = [...positions.values()].filter(point => point.xM !== null && point.yM !== null).map(point => ({
    position: point.label,
    distanceM: Math.hypot((point.xM as number) - speaker.x, (point.yM as number) - speaker.y, earHeightM - speaker.z),
    measuredDb: point.levelDb,
  })).filter(point => finite(point.distanceM) && point.distanceM > 0.05);
  if (points.length < 3 || new Set(points.map(point => point.distanceM.toFixed(2))).size < 3)
    return { ...blocked("At least three distinct coordinate-matched listening positions and distances are required."), pointCount: points.length };
  const xs = points.map(point => Math.log10(point.distanceM));
  const ys = points.map(point => point.measuredDb);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const varianceX = xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  if (!(varianceX > 1e-10)) return blocked("Listening positions do not provide enough distance variation.");
  const covariance = xs.reduce((sum, value, index) => sum + (value - meanX) * (ys[index] - meanY), 0);
  const slope = covariance / varianceX;
  const intercept = meanY - slope * meanX;
  const totalSquares = ys.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const residualSquares = ys.reduce((sum, value, index) => sum + (value - (intercept + slope * xs[index])) ** 2, 0);
  const rSquared = totalSquares > 1e-10 ? Math.max(0, Math.min(1, 1 - residualSquares / totalSquares)) : null;
  const fitted = points.map(point => ({ ...point, fittedDb: intercept + slope * Math.log10(point.distanceM) }))
    .sort((a, b) => a.distanceM - b.distanceM);
  return {
    status: "ready", speakerName: speaker.name, zone: speaker.zone, pointCount: points.length,
    slopeDbPerDecade: slope, rSquared, points: fitted,
    reason: "Empirical room measurement only. Reflections, directivity, multiple sources, occlusion and system processing affect the trend.",
  };
}

/** v0.85: capped gain-trim starting point for human review; never a DSP command. */
export function buildZoneTrimAdvisory(
  comparison: ZonePairComparison, maximumTrimDb = 3,
): ZoneTrimAdvisory {
  const blocked = (reason: string): ZoneTrimAdvisory => ({
    status: "blocked", referenceZone: comparison.zoneA, adjustmentZone: comparison.zoneB,
    rawDifferenceDb: comparison.deltaDb, suggestedTrimDb: null,
    matchedPositionCount: comparison.matchedPositionCount, writeEnabled: false, reason,
  });
  if (!finite(maximumTrimDb) || maximumTrimDb <= 0) return blocked("Maximum trim must be a positive finite number.");
  if (comparison.status !== "ready" || comparison.matchedPositionCount < 3 ||
      comparison.zoneAMeanDb === null || comparison.zoneBMeanDb === null || comparison.deltaDb === null)
    return blocked("At least three matched calibrated listening positions are required before producing a trim starting point.");
  const bounded = Math.max(-maximumTrimDb, Math.min(maximumTrimDb, comparison.deltaDb));
  return {
    status: "review-only", referenceZone: comparison.zoneA, adjustmentZone: comparison.zoneB,
    rawDifferenceDb: comparison.deltaDb, suggestedTrimDb: bounded,
    matchedPositionCount: comparison.matchedPositionCount, writeEnabled: false,
    reason: "Starting estimate only. Confirm source routing, amplifier gain, limiter headroom, phase and listening tests; no DSP value has been written.",
  };
}
