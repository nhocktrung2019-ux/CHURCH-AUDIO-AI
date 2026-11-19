import type { ListeningPoint, SpatialLevelRecord } from "./multiZoneOptimization.ts";

export type RepeatabilityResult = {
  zone: string; pointId: string; captureCount: number; minDb: number | null;
  maxDb: number | null; spreadDb: number | null; status: "pass" | "review" | "insufficient";
};
export type OutlierFlag = {
  recordId: string; zone: string; pointId: string; levelDb: number;
  medianDb: number; deviationDb: number; thresholdDb: number;
  action: "technician-review-only";
};
export type ZoneConfidence = {
  zone: string; expectedPoints: number; capturedPoints: number;
  coverageRatio: number; repeatedPoints: number; repeatabilityPassRatio: number | null;
  confidence: "high" | "medium" | "low"; reasons: string[];
};
const finite = (v: number) => Number.isFinite(v);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};
function validMeasured(records: SpatialLevelRecord[], points: ListeningPoint[]) {
  const validPoints = new Map(points.map(point => [point.id, point]));
  return records.filter(record => {
    const point = validPoints.get(record.positionId);
    return record.source === "measured" && record.quality === "accepted" &&
      record.unit === "dB SPL" && !!record.zone.trim() && !!record.inputLabel.trim() &&
      !!record.calibrationId?.trim() && finite(record.levelDb) &&
      finite(record.calibrationOffsetDb as number) && finite(record.xM) && finite(record.yM) &&
      !!point && Math.hypot(point.xM - record.xM, point.yM - record.yM) <= 0.5;
  });
}
function hasOneCalibrationChain(records: SpatialLevelRecord[]) {
  if (!records.length) return false;
  return new Set(records.map(r => r.inputLabel.trim())).size === 1 &&
    new Set(records.map(r => r.calibrationId?.trim())).size === 1 &&
    new Set(records.map(r => r.calibrationOffsetDb)).size === 1;
}
/** v0.76: repeatability is assessed only within one zone/point and one calibration chain. */
export function analyzeMeasurementRepeatability(
  records: SpatialLevelRecord[], points: ListeningPoint[], maxSpreadDb = 1.5
): RepeatabilityResult[] {
  if (!finite(maxSpreadDb) || maxSpreadDb <= 0) throw new Error("maxSpreadDb must be a positive finite value.");
  const valid = validMeasured(records, points);
  if (!hasOneCalibrationChain(valid)) return [];
  const groups = new Map<string, SpatialLevelRecord[]>();
  for (const record of valid) {
    const key = record.zone.trim() + "\\u0000" + record.positionId;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([key, captures]) => {
    const [zone, pointId] = key.split("\\u0000");
    const levels = captures.map(item => item.levelDb);
    const minDb = Math.min(...levels), maxDb = Math.max(...levels), spreadDb = maxDb - minDb;
    return { zone, pointId, captureCount: levels.length, minDb, maxDb, spreadDb,
      status: (levels.length < 2 ? "insufficient" : spreadDb <= maxSpreadDb ? "pass" : "review") as RepeatabilityResult["status"] };
  }).sort((a, b) => a.zone.localeCompare(b.zone) || a.pointId.localeCompare(b.pointId));
}
/** v0.77: robust median/MAD outlier flags; never edits or removes source records. */
export function flagSpatialMeasurementOutliers(
  records: SpatialLevelRecord[], points: ListeningPoint[], minimumThresholdDb = 1.5
): OutlierFlag[] {
  if (!finite(minimumThresholdDb) || minimumThresholdDb <= 0) throw new Error("minimumThresholdDb must be positive.");
  const valid = validMeasured(records, points);
  if (!hasOneCalibrationChain(valid)) return [];
  const groups = new Map<string, SpatialLevelRecord[]>();
  for (const record of valid) {
    const key = record.zone.trim() + "\\u0000" + record.positionId;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const flags: OutlierFlag[] = [];
  for (const [key, captures] of groups) {
    if (captures.length < 3) continue;
    const [zone, pointId] = key.split("\\u0000");
    const center = median(captures.map(r => r.levelDb));
    if (center === null) continue;
    const mad = median(captures.map(r => Math.abs(r.levelDb - center))) ?? 0;
    const threshold = Math.max(minimumThresholdDb, 3 * 1.4826 * mad);
    for (const record of captures) {
      const deviation = Math.abs(record.levelDb - center);
      if (deviation > threshold) flags.push({ recordId: record.id, zone, pointId, levelDb: record.levelDb,
        medianDb: center, deviationDb: deviation, thresholdDb: threshold, action: "technician-review-only" });
    }
  }
  return flags;
}
/** v0.78–v0.80: coverage and repeatability confidence, explicitly not acoustic certification. */
export function summarizeZoneMeasurementConfidence(
  records: SpatialLevelRecord[], points: ListeningPoint[], maxSpreadDb = 1.5
): ZoneConfidence[] {
  if (!points.length) return [];
  const valid = validMeasured(records, points);
  if (!hasOneCalibrationChain(valid)) return [];
  const repeatability = analyzeMeasurementRepeatability(valid, points, maxSpreadDb);
  const zones = [...new Set(valid.map(r => r.zone.trim()))].sort();
  return zones.map(zone => {
    const zoneRecords = valid.filter(r => r.zone.trim() === zone);
    const captured = new Set(zoneRecords.map(r => r.positionId));
    const repeated = repeatability.filter(r => r.zone === zone && r.captureCount >= 2);
    const passCount = repeated.filter(r => r.status === "pass").length;
    const coverageRatio = captured.size / points.length;
    const repeatabilityPassRatio = repeated.length ? passCount / repeated.length : null;
    const reasons: string[] = [];
    if (coverageRatio < 1) reasons.push("Missing listening-point captures.");
    if (repeatability.some(r => r.zone === zone && r.status === "review")) reasons.push("One or more repeated points exceed the repeatability limit.");
    if (repeatabilityPassRatio === null) reasons.push("Not enough repeated captures to assess repeatability.");
    const confidence = coverageRatio >= 1 && repeatabilityPassRatio === 1 ? "high" :
      coverageRatio >= 0.5 && (repeatabilityPassRatio === null || repeatabilityPassRatio >= 0.5) ? "medium" : "low";
    return { zone, expectedPoints: points.length, capturedPoints: captured.size, coverageRatio,
      repeatedPoints: repeated.length, repeatabilityPassRatio, confidence, reasons };
  });
}
