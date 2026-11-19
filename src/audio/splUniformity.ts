export type SplWeighting = "A" | "C" | "Z";
export type SplCalibrationState = "calibrated" | "uncalibrated";

export interface SplUniformityReading {
  splDb: number | null;
  calibration: SplCalibrationState;
  weighting: SplWeighting;
}

export interface SplUniformityAnalysis {
  count: number;
  weighting: SplWeighting | null;
  comparable: boolean;
  energyAverageDb: number | null;
  minimumDb: number | null;
  maximumDb: number | null;
  spreadDb: number | null;
  standardDeviationDb: number | null;
  within3Db: number;
  within6Db: number;
  targetOffsetDb: number | null;
}

/**
 * Analyze only finite, explicitly calibrated physical SPL readings.
 * Mixed A/C/Z weighting is not pooled because those measurements are not
 * directly comparable for a coverage-uniformity summary.
 */
export function analyzeSplUniformity(
  readings: readonly SplUniformityReading[],
  targetDb: number,
): SplUniformityAnalysis {
  const valid = readings.filter(
    (reading) =>
      reading.calibration === "calibrated" &&
      reading.splDb !== null &&
      Number.isFinite(reading.splDb),
  );
  const values = valid.map((reading) => reading.splDb as number);
  const weightings = [...new Set(valid.map((reading) => reading.weighting))];
  const weighting = weightings.length === 1 ? weightings[0] : null;

  if (values.length === 0 || weightings.length !== 1) {
    return {
      count: values.length,
      weighting,
      comparable: values.length === 0 || weightings.length === 1,
      energyAverageDb: null,
      minimumDb: null,
      maximumDb: null,
      spreadDb: null,
      standardDeviationDb: null,
      within3Db: 0,
      within6Db: 0,
      targetOffsetDb: null,
    };
  }

  const energyAverageDb =
    10 *
    Math.log10(
      values.reduce((sum, value) => sum + 10 ** (value / 10), 0) /
        values.length,
    );
  const arithmeticMean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - arithmeticMean) ** 2, 0) /
    values.length;
  const minimumDb = Math.min(...values);
  const maximumDb = Math.max(...values);

  return {
    count: values.length,
    weighting,
    comparable: true,
    energyAverageDb,
    minimumDb,
    maximumDb,
    spreadDb: maximumDb - minimumDb,
    standardDeviationDb: Math.sqrt(variance),
    within3Db: values.filter((value) => Math.abs(value - targetDb) <= 3).length,
    within6Db: values.filter((value) => Math.abs(value - targetDb) <= 6).length,
    targetOffsetDb: energyAverageDb - targetDb,
  };
}
