export type SpatialUnit = "dB SPL" | "dBFS";
export type EvidenceSource = "measured" | "simulated" | "theoretical";
export type MeasurementQuality = "accepted" | "review" | "rejected";
export type ListeningPoint = { id: string; label: string; xM: number; yM: number; weight: number };
export type SpatialLevelRecord = {
  id: string; zone: string; positionId: string; xM: number; yM: number; levelDb: number;
  unit: SpatialUnit; inputLabel: string; calibrationId?: string; calibrationOffsetDb?: number;
  source: EvidenceSource; quality: MeasurementQuality; timestamp: number;
};
export type RoomBounds = { lengthM: number; widthM: number };
export type SpatialIssue = { code: string; severity: "error" | "warning"; subjectId: string; message: string };
export type WeightedZoneSummary = {
  zone: string; weightedMeanDb: number | null; measuredPointCount: number; expectedPointCount: number;
  missingPointIds: string[]; unit: "dB SPL"; inputLabel: string; calibrationId: string;
};
export type ZoneOptimizationReview = {
  status: "ready-for-technician-review" | "insufficient-measurements" | "blocked";
  summaries: WeightedZoneSummary[]; referenceMeanDb: number | null;
  priorities: Array<{ zone: string; deviationDb: number | null; action: "capture-missing-points" | "review-coverage" | "review-level-balance"; reason: string }>;
  writeEnabled: false;
};
const finite = (value: number) => Number.isFinite(value);
const energyMeanDb = (values: number[]): number | null => {
  if (!values.length || values.some(value => !finite(value))) return null;
  const meanEnergy = values.reduce((sum, value) => sum + 10 ** (value / 10), 0) / values.length;
  return meanEnergy > 0 ? 10 * Math.log10(meanEnergy) : null;
};
export function validateListeningPoints(points: ListeningPoint[], room: RoomBounds): SpatialIssue[] {
  const issues: SpatialIssue[] = [];
  const ids = new Set<string>();
  for (const point of points) {
    if (!point.id.trim() || ids.has(point.id)) issues.push({ code: "duplicate-or-empty-point-id", severity: "error", subjectId: point.id, message: "Listening-point IDs must be non-empty and unique." });
    ids.add(point.id);
    if (!point.label.trim()) issues.push({ code: "missing-point-label", severity: "error", subjectId: point.id, message: "A listening point needs a readable label." });
    if (!finite(point.xM) || !finite(point.yM) || point.xM < 0 || point.yM < 0 || point.xM > room.lengthM || point.yM > room.widthM) issues.push({ code: "point-outside-room", severity: "error", subjectId: point.id, message: "Listening point must be inside the saved room dimensions." });
    if (!finite(point.weight) || point.weight <= 0 || point.weight > 100) issues.push({ code: "invalid-point-weight", severity: "error", subjectId: point.id, message: "Weight must be greater than 0 and no more than 100." });
  }
  if (!finite(room.lengthM) || !finite(room.widthM) || room.lengthM <= 0 || room.widthM <= 0) issues.push({ code: "invalid-room-bounds", severity: "error", subjectId: "room", message: "Room dimensions must be positive finite values." });
  if (!points.length) issues.push({ code: "no-listening-points", severity: "error", subjectId: "room", message: "Add at least one listening point." });
  return issues;
}
function compatibleMeasuredRecords(records: SpatialLevelRecord[]) {
  const candidates = records.filter(record => record.source === "measured" && record.quality === "accepted" && record.unit === "dB SPL");
  if (!candidates.length) return { ok: false, inputLabel: "", calibrationId: "", reason: "No accepted calibrated dB SPL measurements are available." };
  const inputIds = new Set(candidates.map(record => record.inputLabel.trim()));
  const calibrationIds = new Set(candidates.map(record => record.calibrationId?.trim() ?? ""));
  if (inputIds.size !== 1 || candidates.some(record => !record.inputLabel.trim())) return { ok: false, inputLabel: "", calibrationId: "", reason: "Measurements use different or missing input-chain identities." };
  if (calibrationIds.size !== 1 || candidates.some(record => !record.calibrationId?.trim())) return { ok: false, inputLabel: [...inputIds][0] ?? "", calibrationId: "", reason: "Measurements use different or missing calibration identities." };
  const offsets = new Set(candidates.map(record => record.calibrationOffsetDb));
  if (offsets.size !== 1 || candidates.some(record => !finite(record.calibrationOffsetDb as number))) return { ok: false, inputLabel: [...inputIds][0] ?? "", calibrationId: [...calibrationIds][0] ?? "", reason: "Calibration offsets are missing or inconsistent." };
  return { ok: true, inputLabel: [...inputIds][0], calibrationId: [...calibrationIds][0] };
}
/** v0.72: only accepted measured dB SPL records with one matching input/calibration chain contribute. */
export function buildWeightedZoneSummaries(records: SpatialLevelRecord[], points: ListeningPoint[]): WeightedZoneSummary[] {
  const compatible = compatibleMeasuredRecords(records);
  if (!compatible.ok) return [];
  const measured = records.filter(record => record.source === "measured" && record.quality === "accepted" && record.unit === "dB SPL" && record.inputLabel.trim() === compatible.inputLabel && record.calibrationId?.trim() === compatible.calibrationId);
  const zones = [...new Set(measured.map(record => record.zone.trim()).filter(Boolean))].sort();
  return zones.map(zone => {
    const zoneRecords = measured.filter(record => record.zone.trim() === zone);
    const byPoint = new Map<string, number[]>();
    for (const record of zoneRecords) {
      if (!finite(record.levelDb) || !finite(record.xM) || !finite(record.yM)) continue;
      const point = points.find(item => item.id === record.positionId);
      if (!point || Math.hypot(point.xM - record.xM, point.yM - record.yM) > 0.5) continue;
      const values = byPoint.get(point.id) ?? []; values.push(record.levelDb); byPoint.set(point.id, values);
    }
    const weighted: Array<{ level: number; weight: number }> = [];
    for (const point of points) {
      const values = byPoint.get(point.id); const level = values ? energyMeanDb(values) : null;
      if (level !== null) weighted.push({ level, weight: point.weight });
    }
    const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0);
    const weightedMeanDb = weightTotal > 0 ? 10 * Math.log10(weighted.reduce((sum, item) => sum + item.weight * 10 ** (item.level / 10), 0) / weightTotal) : null;
    return { zone, weightedMeanDb, measuredPointCount: weighted.length, expectedPointCount: points.length, missingPointIds: points.filter(point => !byPoint.has(point.id)).map(point => point.id), unit: "dB SPL", inputLabel: compatible.inputLabel, calibrationId: compatible.calibrationId };
  });
}
/** v0.73: simulation and theory are summarized separately and never merged into measured records. */
export function separateEvidenceRecords(records: SpatialLevelRecord[]) {
  return { measured: records.filter(record => record.source === "measured"), simulated: records.filter(record => record.source === "simulated"), theoretical: records.filter(record => record.source === "theoretical") };
}
export type SpeakerPlacement = { id: string; name: string; zone: string; x: number; y: number; z: number };
/** v0.74: geometry-only placement review. It does not infer acoustic coverage or alter saved coordinates. */
export function reviewSpeakerPlacement(speakers: SpeakerPlacement[], points: ListeningPoint[], room: RoomBounds & { heightM: number }) {
  const issues: SpatialIssue[] = [];
  for (const speaker of speakers) {
    if (![speaker.x, speaker.y, speaker.z].every(finite) || speaker.x < 0 || speaker.x > room.lengthM || speaker.y < 0 || speaker.y > room.widthM || speaker.z < 0 || speaker.z > room.heightM) issues.push({ code: "speaker-outside-room", severity: "error", subjectId: speaker.id, message: "Speaker coordinates are outside the saved room bounds." });
    if (!speaker.zone.trim()) issues.push({ code: "speaker-zone-missing", severity: "warning", subjectId: speaker.id, message: "Assign this speaker to a named zone before reviewing zone coverage." });
  }
  const pointReviews = points.map(point => {
    const nearest = speakers.filter(speaker => [speaker.x, speaker.y, speaker.z].every(finite)).map(speaker => ({ speaker, distanceM: Math.hypot(point.xM - speaker.x, point.yM - speaker.y, 1.2 - speaker.z) })).sort((a, b) => a.distanceM - b.distanceM)[0];
    return { pointId: point.id, nearestSpeakerId: nearest?.speaker.id ?? null, nearestZone: nearest?.speaker.zone ?? null, geometricDistanceM: nearest?.distanceM ?? null, status: nearest ? "geometry-reference-only" as const : "no-speaker" as const };
  });
  return { issues, pointReviews, changesSaved: false as const };
}
/** v0.75: creates a review queue only. It never emits gain/delay/EQ values or DSP commands. */
export function buildMultiZoneOptimizationReview(records: SpatialLevelRecord[], points: ListeningPoint[], toleranceDb = 2): ZoneOptimizationReview {
  if (!finite(toleranceDb) || toleranceDb < 0) return { status: "blocked", summaries: [], referenceMeanDb: null, priorities: [], writeEnabled: false };
  const compatible = compatibleMeasuredRecords(records);
  if (!compatible.ok) return { status: "blocked", summaries: [], referenceMeanDb: null, priorities: [], writeEnabled: false };
  const summaries = buildWeightedZoneSummaries(records, points);
  const populated = summaries.filter(summary => summary.weightedMeanDb !== null);
  if (!populated.length) return { status: "insufficient-measurements", summaries, referenceMeanDb: null, priorities: [], writeEnabled: false };
  const referenceMeanDb = energyMeanDb(populated.map(summary => summary.weightedMeanDb as number));
  const priorities = summaries.map(summary => {
    if (summary.missingPointIds.length || summary.measuredPointCount < summary.expectedPointCount) return { zone: summary.zone, deviationDb: null, action: "capture-missing-points" as const, reason: "Complete the same weighted listening-point set before comparing zones." };
    const deviationDb = referenceMeanDb === null || summary.weightedMeanDb === null ? null : summary.weightedMeanDb - referenceMeanDb;
    return { zone: summary.zone, deviationDb, action: Math.abs(deviationDb ?? 0) > toleranceDb ? "review-level-balance" as const : "review-coverage" as const, reason: Math.abs(deviationDb ?? 0) > toleranceDb ? "Review measured zone balance with the technician; no gain adjustment is calculated." : "Review spatial coverage and repeatability; no simulated data is used." };
  });
  return { status: priorities.some(item => item.action === "capture-missing-points") ? "insufficient-measurements" : "ready-for-technician-review", summaries, referenceMeanDb, priorities, writeEnabled: false };
}
