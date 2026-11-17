export const RTA_MIN_FREQUENCY_HZ = 20;
export const RTA_MAX_FREQUENCY_HZ = 20000;
export const RTA_DEFAULT_BAND_COUNT = 64;

/** Geometric centre of a logarithmically spaced RTA band. */
export function rtaBandFrequency(
  index: number,
  bandCount = RTA_DEFAULT_BAND_COUNT,
  minHz = RTA_MIN_FREQUENCY_HZ,
  maxHz = RTA_MAX_FREQUENCY_HZ,
): number {
  if (!Number.isInteger(bandCount) || bandCount < 1) {
    throw new RangeError("bandCount must be a positive integer");
  }
  if (!(minHz > 0) || !(maxHz > minHz)) {
    throw new RangeError("Frequency range must be positive and increasing");
  }
  const safeIndex = Math.max(0, Math.min(bandCount - 1, Math.floor(index)));
  return minHz * Math.pow(maxHz / minHz, (safeIndex + 0.5) / bandCount);
}

/** Maps a frequency to the logarithmic RTA band used by the analyser. */
export function rtaBandIndexForFrequency(
  frequencyHz: number,
  bandCount = RTA_DEFAULT_BAND_COUNT,
  minHz = RTA_MIN_FREQUENCY_HZ,
  maxHz = RTA_MAX_FREQUENCY_HZ,
): number {
  if (!Number.isInteger(bandCount) || bandCount < 1) {
    throw new RangeError("bandCount must be a positive integer");
  }
  if (!(minHz > 0) || !(maxHz > minHz)) {
    throw new RangeError("Frequency range must be positive and increasing");
  }
  if (!Number.isFinite(frequencyHz)) {
    throw new RangeError("frequencyHz must be finite");
  }
  const bounded = Math.max(minHz, Math.min(maxHz, frequencyHz));
  return Math.min(
    bandCount - 1,
    Math.floor((Math.log(bounded / minHz) / Math.log(maxHz / minHz)) * bandCount),
  );
}
