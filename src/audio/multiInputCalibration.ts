import { micCorrectionAt, type MicCalibrationFile, type MicCalibrationPoint } from "./micCalibration.ts";

export type MultiInputCalibrationRegistry = Record<string, MicCalibrationFile>;

function normalizePoints(value: unknown): MicCalibrationPoint[] {
  if (!Array.isArray(value)) return [];
  const sorted = value
    .filter((point): point is { frequencyHz: number; correctionDb: number } =>
      !!point && typeof point === "object"
      && Number.isFinite((point as MicCalibrationPoint).frequencyHz)
      && Number.isFinite((point as MicCalibrationPoint).correctionDb)
      && (point as MicCalibrationPoint).frequencyHz >= 10
      && (point as MicCalibrationPoint).frequencyHz <= 40000
      && (point as MicCalibrationPoint).correctionDb >= -30
      && (point as MicCalibrationPoint).correctionDb <= 30)
    .map(point => ({ frequencyHz: point.frequencyHz, correctionDb: point.correctionDb }))
    .sort((a, b) => a.frequencyHz - b.frequencyHz);

  const unique: MicCalibrationPoint[] = [];
  for (const point of sorted) {
    if (unique.length && unique[unique.length - 1].frequencyHz === point.frequencyHz) {
      unique[unique.length - 1] = point;
    } else {
      unique.push(point);
    }
  }
  if (unique.length < 3 || unique[0].frequencyHz > 50
    || unique[unique.length - 1].frequencyHz < 10000) return [];
  return unique;
}

/** Validate persisted calibration data before it can affect a measurement. */
export function normalizeMultiInputCalibrationRegistry(value: unknown): MultiInputCalibrationRegistry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: MultiInputCalibrationRegistry = {};
  for (const [deviceId, candidate] of Object.entries(value)) {
    if (!deviceId.trim() || !candidate || typeof candidate !== "object") continue;
    const profile = candidate as Partial<MicCalibrationFile>;
    if (typeof profile.name !== "string" || !profile.name.trim()) continue;
    const points = normalizePoints(profile.points);
    if (points.length) result[deviceId] = { name: profile.name.slice(0, 180), points };
  }
  return result;
}

export function setInputCalibration(
  registry: MultiInputCalibrationRegistry,
  deviceId: string,
  profile: MicCalibrationFile,
): MultiInputCalibrationRegistry {
  if (!deviceId.trim()) throw new Error("Không xác định được ID thiết bị micro.");
  const normalized = normalizeMultiInputCalibrationRegistry({ [deviceId]: profile })[deviceId];
  if (!normalized) throw new Error("Hồ sơ hiệu chuẩn không hợp lệ hoặc thiếu dải tần 50 Hz–10 kHz.");
  return { ...registry, [deviceId]: normalized };
}

export function removeInputCalibration(
  registry: MultiInputCalibrationRegistry,
  deviceId: string,
): MultiInputCalibrationRegistry {
  const next = { ...registry };
  delete next[deviceId];
  return next;
}

/**
 * Apply one input's frequency-response correction to logarithmic RTA bands.
 * Outside the supplied calibration range the raw measurement is retained;
 * this avoids silently extrapolating a correction beyond measured data.
 */
export function applyInputMicCalibration(
  spectrum: number[],
  points: MicCalibrationPoint[],
  minHz = 20,
  maxHz = 20000,
): number[] {
  if (!spectrum.length || !points.length) return spectrum.slice();
  if (!Number.isFinite(minHz) || !Number.isFinite(maxHz) || minHz <= 0 || maxHz < minHz) {
    return spectrum.slice();
  }
  const validPoints = normalizePoints(points);
  if (!validPoints.length) return spectrum.slice();
  const ratio = maxHz / minHz;
  return spectrum.map((value, index) => {
    if (!Number.isFinite(value)) return value;
    const centerHz = minHz * Math.pow(ratio, (index + 0.5) / spectrum.length);
    const firstHz = validPoints[0].frequencyHz;
    const lastHz = validPoints[validPoints.length - 1].frequencyHz;
    const correctionDb = centerHz < firstHz || centerHz > lastHz
      ? 0
      : micCorrectionAt(validPoints, centerHz);
    return Math.max(-120, Math.min(24, value + correctionDb));
  });
}
