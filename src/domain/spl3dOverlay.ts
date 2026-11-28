import type { AcousticMeasurement, AcousticZone } from "./acoustics";

export type MeasuredSplOverlayPoint = {
  id: string;
  positionId: string;
  zoneId: string;
  label: string;
  xM: number;
  yM: number;
  zM: number;
  splDb: number;
  targetSplDb: number | null;
  sampleCount: number;
  sessionId: string;
  weighting: string;
  calibrationProfileId: string | null;
};

/**
 * Builds discrete measured-point markers only. It never interpolates between
 * points or combines different sessions, weightings, or calibration profiles.
 */
export function buildMeasuredSplOverlay(
  positions: readonly { id: string; label: string; zoneId: string; xM: number; yM: number; zM: number }[],
  measurements: readonly AcousticMeasurement[],
  zones: readonly AcousticZone[],
): MeasuredSplOverlayPoint[] {
  const byId = new Map(positions.map((position) => [position.id, position]));
  const targets = new Map(zones.map((zone) => [zone.id, zone.targetSplDb]));
  const groups = new Map<string, { position: typeof positions[number]; records: AcousticMeasurement[]; profileId: string | null; sessionId: string; weighting: string }>();

  for (const record of measurements) {
    const positionId = record.provenance?.measurementPositionId;
    const position = positionId ? byId.get(positionId) : undefined;
    const calibration = record.provenance?.calibration;
    if (!position || position.zoneId !== record.zoneId ||
        record.kind !== "calibrated-spl" || record.unit !== "dB_SPL" ||
        record.quality !== "valid" || !Number.isFinite(record.value) ||
        !calibration?.calibrationMethod || calibration.calibrationMethod === "none") continue;

    const profileId = calibration.profileId ?? null;
    const weighting = record.provenance.weighting ?? "unspecified";
    const key = [position.id, record.provenance.sessionId, weighting, profileId ?? "no-profile"].join("|");
    const existing = groups.get(key);
    if (existing) existing.records.push(record);
    else groups.set(key, { position, records: [record], profileId, sessionId: record.provenance.sessionId, weighting });
  }

  return [...groups.entries()].map(([key, group]) => {
    const energyMean = group.records.reduce((sum, record) => sum + 10 ** (record.value / 10), 0) / group.records.length;
    return {
      id: key,
      positionId: group.position.id,
      zoneId: group.position.zoneId,
      label: group.position.label,
      xM: group.position.xM,
      yM: group.position.yM,
      zM: group.position.zM,
      splDb: 10 * Math.log10(energyMean),
      targetSplDb: targets.get(group.position.zoneId) ?? null,
      sampleCount: group.records.length,
      sessionId: group.sessionId,
      weighting: group.weighting,
      calibrationProfileId: group.profileId,
    };
  });
}
