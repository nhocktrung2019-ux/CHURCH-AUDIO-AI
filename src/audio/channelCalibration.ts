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

export function validateChannelCalibrationProfile(
  profile: ChannelCalibrationProfile,
): { valid: true } | { valid: false; reason: string } {
  if (profile.schemaVersion !== 1) return { valid: false, reason: "Unsupported calibration schema version." };
  if (!profile.deviceKey?.trim() || !profile.outputKey?.trim()) return { valid: false, reason: "Calibration must identify the exact interface and output." };
  if (!Number.isInteger(profile.inputChannel) || profile.inputChannel < 0) return { valid: false, reason: "Invalid calibrated input channel." };
  if (!Number.isFinite(profile.sampleRate) || profile.sampleRate < 8000 || profile.sampleRate > 192000) return { valid: false, reason: "Invalid calibration sample rate." };
  if (!Number.isFinite(profile.loopbackDelayMs) || Math.abs(profile.loopbackDelayMs) > 500) return { valid: false, reason: "Invalid loopback delay." };
  if (!Array.isArray(profile.points) || profile.points.length < 3) return { valid: false, reason: "At least three frequency calibration points are required." };

  let previousFrequency = 0;
  for (const point of profile.points) {
    if (!Number.isFinite(point.frequencyHz) || point.frequencyHz <= previousFrequency
      || point.frequencyHz < 10 || point.frequencyHz > Math.min(40000, profile.sampleRate * 0.45)) {
      return { valid: false, reason: "Calibration frequencies must be finite, strictly increasing and below Nyquist." };
    }
    if (!Number.isFinite(point.magnitudeDb) || Math.abs(point.magnitudeDb) > 60
      || !Number.isFinite(point.phaseDeg) || Math.abs(point.phaseDeg) > 36000) {
      return { valid: false, reason: "Calibration magnitude or phase is outside the supported range." };
    }
    previousFrequency = point.frequencyHz;
  }
  if (profile.points[0].frequencyHz > 50 || profile.points[profile.points.length - 1].frequencyHz < 10000) {
    return { valid: false, reason: "Calibration must cover at least 50 Hz to 10 kHz; do not extrapolate outside the measured band." };
  }
  return { valid: true };
}

export function isChannelCalibrationCompatible(
  profile: ChannelCalibrationProfile,
  target: CalibrationTarget,
): boolean {
  return validateChannelCalibrationProfile(profile).valid
    && profile.deviceKey === target.deviceKey
    && profile.inputChannel === target.inputChannel
    && profile.outputKey === target.outputKey
    && profile.sampleRate === target.sampleRate;
}

/** Log-frequency interpolation; returns null outside the measured calibration band. */
export function interpolateChannelCalibration(
  points: ChannelCalibrationPoint[],
  frequencyHz: number,
): ChannelCalibrationPoint | null {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0 || points.length < 2
    || frequencyHz < points[0].frequencyHz || frequencyHz > points[points.length - 1].frequencyHz) return null;
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle].frequencyHz <= frequencyHz) low = middle;
    else high = middle;
  }
  const a = points[low];
  const b = points[high];
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
 * This only corrects the calibrated interface path; it does not calibrate a
 * loudspeaker, room, microphone, acoustic propagation or independent clocks.
 */
export function applyChannelCalibration(
  measured: CalibratedTransferPoint[],
  profile: ChannelCalibrationProfile,
): CalibratedTransferPoint[] | null {
  if (!validateChannelCalibrationProfile(profile).valid) return null;
  return measured.map(point => {
    const correction = interpolateChannelCalibration(profile.points, point.frequencyHz);
    if (!correction) return { ...point };
    return {
      ...point,
      magnitudeDb: point.magnitudeDb - correction.magnitudeDb,
      phaseDeg: point.phaseDeg - correction.phaseDeg,
    };
  });
}

export function correctLoopbackDelayMs(
  measuredDelayMs: number,
  profile: ChannelCalibrationProfile,
): number | null {
  if (!Number.isFinite(measuredDelayMs) || !validateChannelCalibrationProfile(profile).valid) return null;
  return measuredDelayMs - profile.loopbackDelayMs;
}
