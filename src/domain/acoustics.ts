/**
 * Shared acoustic-domain contracts.
 *
 * Physical SPL, digital full-scale levels and model estimates are intentionally
 * represented as different measurement kinds so they cannot be silently mixed.
 */

export type MeasurementKind = "calibrated-spl" | "relative-dbfs" | "simulated-spl" | "interpolated-spl";
export type SplWeighting = "A" | "C" | "Z" | "unweighted";
export type MeasurementQuality = "valid" | "uncalibrated" | "insufficient-coverage" | "rejected";

export interface CalibrationReference {
  profileId?: string;
  microphoneModel?: string;
  referenceLevelDbSpl?: number;
  calibratedAt?: string;
  calibrationMethod?: "acoustic-calibrator" | "reference-meter" | "manufacturer-file" | "one-point-offset" | "none";
  notes?: string;
}

export interface MeasurementProvenance {
  sessionId: string;
  capturedAt: string;
  sourceLabel: string;
  sampleRateHz?: number;
  channelCount?: number;
  microphonePosition?: { x: number; y: number; z: number; unit: "m" };
  microphoneOrientation?: string;
  integrationTimeSeconds?: number;
  weighting?: SplWeighting;
  calibration?: CalibrationReference;
  operatorNotes?: string;
}

export interface AcousticMeasurement {
  id: string;
  projectId: string;
  zoneId: string;
  kind: MeasurementKind;
  value: number;
  unit: "dB_SPL" | "dBFS";
  quality: MeasurementQuality;
  provenance: MeasurementProvenance;
}

export interface AcousticZone {
  id: string;
  name: string;
  targetSplDb?: number;
  speakerIds: string[];
  region?: { center: { x: number; y: number; z: number }; radiusMeters?: number };
}

export interface AcousticProject {
  id: string;
  schemaVersion: 1;
  name: string;
  locale: "vi" | "en";
  createdAt: string;
  updatedAt: string;
  zones: AcousticZone[];
  measurements: AcousticMeasurement[];
}

export interface SplSummary {
  count: number;
  energyAverageDbSpl: number | null;
  minimumDbSpl: number | null;
  maximumDbSpl: number | null;
  spreadDb: number | null;
  calibratedCount: number;
  excludedCount: number;
}

/**
 * A record is eligible for a physical SPL summary only when it explicitly
 * carries a non-"none" calibration method. A UI quality flag alone is not
 * evidence of calibration; this prevents stale/imported records from silently
 * entering calibrated zone statistics.
 */
function hasCalibrationEvidence(record: AcousticMeasurement): boolean {
  const calibration = record.provenance?.calibration;
  return Boolean(
    calibration &&
    calibration.calibrationMethod &&
    calibration.calibrationMethod !== "none",
  );
}

/** Only valid, calibrated physical SPL records contribute to this summary. */
export function summarizeCalibratedSpl(records: readonly AcousticMeasurement[]): SplSummary {
  const valid = records.filter(
    (record) =>
      record.kind === "calibrated-spl" &&
      record.unit === "dB_SPL" &&
      record.quality === "valid" &&
      Number.isFinite(record.value) &&
      hasCalibrationEvidence(record),
  );
  const values = valid.map((record) => record.value);
  if (values.length === 0) {
    return {
      count: 0,
      energyAverageDbSpl: null,
      minimumDbSpl: null,
      maximumDbSpl: null,
      spreadDb: null,
      calibratedCount: 0,
      excludedCount: records.length,
    };
  }

  const meanSquare = values.reduce((sum, value) => sum + 10 ** (value / 10), 0) / values.length;
  const minimumDbSpl = Math.min(...values);
  const maximumDbSpl = Math.max(...values);
  return {
    count: values.length,
    energyAverageDbSpl: 10 * Math.log10(meanSquare),
    minimumDbSpl,
    maximumDbSpl,
    spreadDb: maximumDbSpl - minimumDbSpl,
    calibratedCount: values.length,
    excludedCount: records.length - values.length,
  };
}

export function validateAcousticMeasurement(record: AcousticMeasurement): string[] {
  const errors: string[] = [];
  if (!record.id.trim()) errors.push("Measurement id is required.");
  if (!record.projectId.trim()) errors.push("Project id is required.");
  if (!record.zoneId.trim()) errors.push("Zone id is required.");
  if (!Number.isFinite(record.value)) errors.push("Measurement value must be finite.");
  if (record.kind === "calibrated-spl") {
    if (record.unit !== "dB_SPL") errors.push("Calibrated SPL must use dB_SPL units.");
    if (record.quality === "valid" && !hasCalibrationEvidence(record)) {
      errors.push("A valid calibrated SPL record requires a non-none calibration method.");
    }
  }
  if (record.kind === "relative-dbfs" && record.unit !== "dBFS") {
    errors.push("Relative digital level must use dBFS units.");
  }
  if ((record.kind === "simulated-spl" || record.kind === "interpolated-spl") && record.unit !== "dB_SPL") {
    errors.push("Simulated and interpolated SPL estimates must use dB_SPL units.");
  }
  if (!record.provenance.sessionId.trim()) errors.push("Measurement session id is required.");
  if (!record.provenance.sourceLabel.trim()) errors.push("Measurement source label is required.");
  if (!Number.isFinite(Date.parse(record.provenance.capturedAt))) errors.push("Capture timestamp must be a valid date.");
  if (record.provenance.sampleRateHz !== undefined &&
      (!Number.isFinite(record.provenance.sampleRateHz) || record.provenance.sampleRateHz <= 0)) {
    errors.push("Sample rate must be a positive finite number.");
  }
  if (record.provenance.channelCount !== undefined &&
      (!Number.isInteger(record.provenance.channelCount) || record.provenance.channelCount < 1)) {
    errors.push("Channel count must be a positive integer.");
  }
  return errors;
}
