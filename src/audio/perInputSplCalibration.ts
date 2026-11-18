export type InputSplCalibrationProfile = {
  schemaVersion: 1;
  deviceId: string;
  sampleRate: number;
  calibratorFrequencyHz: 1000;
  referenceLevelDbSpl: 94 | 114;
  measuredToneDbfs: number;
  offsetDb: number;
  calibratedAt: string;
};

export type InputSplCalibrationRegistry = Record<string, InputSplCalibrationProfile>;

export function estimateOneKilohertzDbfs(
  frequencyDataDbfs: Float32Array | number[],
  sampleRate: number,
  fftSize: number,
  centerHz = 1000,
  bandwidthHz = 40,
): number | null {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000
    || !Number.isInteger(fftSize) || fftSize < 256
    || !Number.isFinite(centerHz) || centerHz <= 0
    || !Number.isFinite(bandwidthHz) || bandwidthHz <= 0
    || !frequencyDataDbfs || frequencyDataDbfs.length !== fftSize / 2) return null;

  const binHz = sampleRate / fftSize;
  const first = Math.max(1, Math.ceil((centerHz - bandwidthHz / 2) / binHz));
  const last = Math.min(frequencyDataDbfs.length - 1, Math.floor((centerHz + bandwidthHz / 2) / binHz));
  if (last < first) return null;

  let power = 0;
  let count = 0;
  for (let bin = first; bin <= last; bin++) {
    const dbfs = frequencyDataDbfs[bin];
    if (!Number.isFinite(dbfs) || dbfs <= -120 || dbfs > 6) continue;
    power += Math.pow(10, dbfs / 10);
    count++;
  }
  return count ? 10 * Math.log10(power / count) : null;
}

export function createInputSplCalibration(
  deviceId: string,
  sampleRate: number,
  measuredToneDbfs: number,
  referenceLevelDbSpl: 94 | 114,
  calibratedAt = new Date().toISOString(),
): InputSplCalibrationProfile | null {
  if (!deviceId.trim() || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000
    || !Number.isFinite(measuredToneDbfs) || measuredToneDbfs < -90 || measuredToneDbfs > 0
    || (referenceLevelDbSpl !== 94 && referenceLevelDbSpl !== 114)
    || !Number.isFinite(Date.parse(calibratedAt))) return null;
  return {
    schemaVersion: 1,
    deviceId,
    sampleRate,
    calibratorFrequencyHz: 1000,
    referenceLevelDbSpl,
    measuredToneDbfs,
    offsetDb: referenceLevelDbSpl - measuredToneDbfs,
    calibratedAt,
  };
}

export function validateInputSplCalibration(value: unknown, expectedDeviceId?: string): value is InputSplCalibrationProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const profile = value as Partial<InputSplCalibrationProfile>;
  return profile.schemaVersion === 1
    && typeof profile.deviceId === "string" && !!profile.deviceId.trim()
    && (!expectedDeviceId || profile.deviceId === expectedDeviceId)
    && Number.isFinite(profile.sampleRate) && (profile.sampleRate as number) >= 8000 && (profile.sampleRate as number) <= 192000
    && profile.calibratorFrequencyHz === 1000
    && (profile.referenceLevelDbSpl === 94 || profile.referenceLevelDbSpl === 114)
    && Number.isFinite(profile.measuredToneDbfs) && (profile.measuredToneDbfs as number) >= -90 && (profile.measuredToneDbfs as number) <= 0
    && Number.isFinite(profile.offsetDb) && Math.abs((profile.offsetDb as number) - (profile.referenceLevelDbSpl as number) + (profile.measuredToneDbfs as number)) < 0.01
    && typeof profile.calibratedAt === "string" && Number.isFinite(Date.parse(profile.calibratedAt));
}

export function normalizeInputSplCalibrationRegistry(value: unknown): InputSplCalibrationRegistry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const registry: InputSplCalibrationRegistry = {};
  for (const [deviceId, profile] of Object.entries(value)) {
    if (validateInputSplCalibration(profile, deviceId)) registry[deviceId] = profile;
  }
  return registry;
}

export function applyInputSplOffset(measuredDbfs: number, profile: InputSplCalibrationProfile | null | undefined): number | null {
  if (!Number.isFinite(measuredDbfs) || measuredDbfs < -120 || measuredDbfs > 12
    || !profile || !validateInputSplCalibration(profile)) return null;
  return measuredDbfs + profile.offsetDb;
}
