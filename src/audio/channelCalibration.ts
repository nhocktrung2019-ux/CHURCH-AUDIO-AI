export type ChannelCalibrationPoint = {
  frequencyHz: number;
  magnitudeDb: number;
  phaseDeg: number;
};

export type ChannelCalibrationProfile = {
  schemaVersion: 1;
  deviceKey: string;
  inputChannel: number;
  outputKey: string;
  sampleRate: number;
  loopbackDelayMs: number;
  points: ChannelCalibrationPoint[];
};

export type CalibrationTarget = {
  deviceKey: string;
  inputChannel: number;
  outputKey: string;
  sampleRate: number;
};

export type CalibratedTransferPoint = {
  frequencyHz: number;
  magnitudeDb: number;
  phaseDeg: number;
  coherence: number;
};

export type ChannelCalibrationStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const CHANNEL_CALIBRATION_STORAGE_PREFIX = "church-audio-channel-calibration-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidTarget(target: unknown): target is CalibrationTarget {
  if (!isRecord(target)) return false;
  return typeof target.deviceKey === "string" && target.deviceKey.trim().length > 0
    && Number.isInteger(target.inputChannel) && (target.inputChannel as number) >= 0
    && typeof target.outputKey === "string" && target.outputKey.trim().length > 0
    && Number.isFinite(target.sampleRate)
    && (target.sampleRate as number) >= 8000 && (target.sampleRate as number) <= 192000;
}

export function validateChannelCalibrationProfile(
  profile: unknown,
): { valid: true } | { valid: false; reason: string } {
  if (!isRecord(profile)) return { valid: false, reason: "Calibration profile must be an object." };
  if (profile.schemaVersion !== 1) return { valid: false, reason: "Unsupported calibration schema version." };
  if (typeof profile.deviceKey !== "string" || !profile.deviceKey.trim()
    || typeof profile.outputKey !== "string" || !profile.outputKey.trim()) {
    return { valid: false, reason: "Calibration must identify the exact interface and output." };
  }
  if (!Number.isInteger(profile.inputChannel) || (profile.inputChannel as number) < 0) {
    return { valid: false, reason: "Invalid calibrated input channel." };
  }
  if (!Number.isFinite(profile.sampleRate) || (profile.sampleRate as number) < 8000
    || (profile.sampleRate as number) > 192000) {
    return { valid: false, reason: "Invalid calibration sample rate." };
  }
  if (!Number.isFinite(profile.loopbackDelayMs) || Math.abs(profile.loopbackDelayMs as number) > 500) {
    return { valid: false, reason: "Invalid loopback delay." };
  }
  if (!Array.isArray(profile.points) || profile.points.length < 3) {
    return { valid: false, reason: "At least three frequency calibration points are required." };
  }

  let previousFrequency = 0;
  for (const rawPoint of profile.points) {
    if (!isRecord(rawPoint)) return { valid: false, reason: "Calibration contains a malformed frequency point." };
    const frequencyHz = rawPoint.frequencyHz;
    const magnitudeDb = rawPoint.magnitudeDb;
    const phaseDeg = rawPoint.phaseDeg;
    if (!Number.isFinite(frequencyHz) || (frequencyHz as number) <= previousFrequency
      || (frequencyHz as number) < 10
      || (frequencyHz as number) > Math.min(40000, (profile.sampleRate as number) * 0.45)) {
      return { valid: false, reason: "Calibration frequencies must be finite, strictly increasing and below Nyquist." };
    }
    if (!Number.isFinite(magnitudeDb) || Math.abs(magnitudeDb as number) > 60
      || !Number.isFinite(phaseDeg) || Math.abs(phaseDeg as number) > 36000) {
      return { valid: false, reason: "Calibration magnitude or phase is outside the supported range." };
    }
    previousFrequency = frequencyHz as number;
  }
  const first = profile.points[0] as Record<string, unknown>;
  const last = profile.points[profile.points.length - 1] as Record<string, unknown>;
  if ((first.frequencyHz as number) > 50 || (last.frequencyHz as number) < 10000) {
    return { valid: false, reason: "Calibration must cover at least 50 Hz to 10 kHz; do not extrapolate outside the measured band." };
  }
  return { valid: true };
}

export function isChannelCalibrationCompatible(
  profile: ChannelCalibrationProfile,
  target: CalibrationTarget,
): boolean {
  return validateChannelCalibrationProfile(profile).valid
    && isValidTarget(target)
    && profile.deviceKey === target.deviceKey
    && profile.inputChannel === target.inputChannel
    && profile.outputKey === target.outputKey
    && profile.sampleRate === target.sampleRate;
}

/** Unwrap wrapped phase using the nearest 360-degree branch at each frequency. */
function unwrapCalibrationPoints(points: ChannelCalibrationPoint[]): ChannelCalibrationPoint[] | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  const result: ChannelCalibrationPoint[] = [];
  let previousFrequency = 0;
  let previousPhase: number | null = null;
  for (const point of points) {
    if (!point || !Number.isFinite(point.frequencyHz) || point.frequencyHz <= previousFrequency
      || !Number.isFinite(point.magnitudeDb) || !Number.isFinite(point.phaseDeg)) return null;
    let phaseDeg = point.phaseDeg;
    if (previousPhase !== null) {
      while (phaseDeg - previousPhase > 180) phaseDeg -= 360;
      while (phaseDeg - previousPhase < -180) phaseDeg += 360;
    }
    result.push({ ...point, phaseDeg });
    previousFrequency = point.frequencyHz;
    previousPhase = phaseDeg;
  }
  return result;
}

/** Log-frequency interpolation; returns null outside the measured calibration band. */
export function interpolateChannelCalibration(
  points: ChannelCalibrationPoint[],
  frequencyHz: number,
): ChannelCalibrationPoint | null {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return null;
  const unwrapped = unwrapCalibrationPoints(points);
  if (!unwrapped || frequencyHz < unwrapped[0].frequencyHz
    || frequencyHz > unwrapped[unwrapped.length - 1].frequencyHz) return null;

  let low = 0;
  let high = unwrapped.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (unwrapped[middle].frequencyHz <= frequencyHz) low = middle;
    else high = middle;
  }
  const a = unwrapped[low];
  const b = unwrapped[high];
  if (frequencyHz === a.frequencyHz) return { ...a };
  if (frequencyHz === b.frequencyHz) return { ...b };
  const ratio = Math.log(frequencyHz / a.frequencyHz) / Math.log(b.frequencyHz / a.frequencyHz);
  return {
    frequencyHz,
    magnitudeDb: a.magnitudeDb + (b.magnitudeDb - a.magnitudeDb) * ratio,
    phaseDeg: a.phaseDeg + (b.phaseDeg - a.phaseDeg) * ratio,
  };
}

/**
 * Remove the measured electrical loopback path from an H1 result.
 * Returns null if any point is malformed or outside the calibrated band. It
 * never silently passes uncalibrated points through as if they were corrected.
 */
export function applyChannelCalibration(
  measured: CalibratedTransferPoint[],
  profile: ChannelCalibrationProfile,
): CalibratedTransferPoint[] | null {
  if (!validateChannelCalibrationProfile(profile).valid || !Array.isArray(measured)) return null;
  const firstFrequency = profile.points[0].frequencyHz;
  const lastFrequency = profile.points[profile.points.length - 1].frequencyHz;
  const output: CalibratedTransferPoint[] = [];
  for (const point of measured) {
    if (!point || !Number.isFinite(point.frequencyHz) || point.frequencyHz < firstFrequency
      || point.frequencyHz > lastFrequency || !Number.isFinite(point.magnitudeDb)
      || !Number.isFinite(point.phaseDeg) || !Number.isFinite(point.coherence)
      || point.coherence < 0 || point.coherence > 1) return null;
    const correction = interpolateChannelCalibration(profile.points, point.frequencyHz);
    if (!correction) return null;
    output.push({
      ...point,
      magnitudeDb: point.magnitudeDb - correction.magnitudeDb,
      phaseDeg: point.phaseDeg - correction.phaseDeg,
    });
  }
  return output;
}

export function correctLoopbackDelayMs(
  measuredDelayMs: number,
  profile: ChannelCalibrationProfile,
): number | null {
  if (!Number.isFinite(measuredDelayMs) || !validateChannelCalibrationProfile(profile).valid) return null;
  return measuredDelayMs - profile.loopbackDelayMs;
}

/** A profile is isolated by exact input/output identity and sample rate. */
export function channelCalibrationStorageKey(target: CalibrationTarget): string | null {
  if (!isValidTarget(target)) return null;
  return [
    CHANNEL_CALIBRATION_STORAGE_PREFIX,
    encodeURIComponent(target.deviceKey),
    String(target.inputChannel),
    encodeURIComponent(target.outputKey),
    String(target.sampleRate),
  ].join(":");
}

export function saveChannelCalibrationProfile(
  storage: ChannelCalibrationStorage,
  profile: ChannelCalibrationProfile,
): boolean {
  if (!validateChannelCalibrationProfile(profile).valid) return false;
  const key = channelCalibrationStorageKey(profile);
  if (!key) return false;
  try {
    storage.setItem(key, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function loadChannelCalibrationProfile(
  storage: ChannelCalibrationStorage,
  target: CalibrationTarget,
): ChannelCalibrationProfile | null {
  const key = channelCalibrationStorageKey(target);
  if (!key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > 1_000_000) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isChannelCalibrationCompatible(parsed as ChannelCalibrationProfile, target)) return null;
    return parsed as ChannelCalibrationProfile;
  } catch {
    return null;
  }
}

export function deleteChannelCalibrationProfile(
  storage: ChannelCalibrationStorage,
  target: CalibrationTarget,
): boolean {
  const key = channelCalibrationStorageKey(target);
  if (!key) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
