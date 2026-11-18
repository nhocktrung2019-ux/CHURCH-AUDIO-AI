export type ZoneSplUnit = "dBFS" | "dB SPL";
export type ZoneSplRecord = {
  id: number;
  zone: string;
  position: string;
  levelDb: number;
  rawDbfs: number;
  unit: ZoneSplUnit;
  durationSeconds: number;
  sampleCount: number;
  inputLabel: string;
  timestamp: number;
};
export type UniformitySummary = {
  count: number;
  minDb: number;
  maxDb: number;
  meanDb: number;
  spreadDb: number;
  standardDeviationDb: number;
  unit: ZoneSplUnit;
};

/** Energy-average dB samples; invalid/near-silence sentinels are ignored. */
export function energyAverageDb(values: number[]): number | null {
  const valid = values.filter((value) => Number.isFinite(value) && value > -99 && value <= 200);
  if (!valid.length) return null;
  const meanEnergy = valid.reduce((sum, value) => sum + 10 ** (value / 10), 0) / valid.length;
  if (!(meanEnergy > 0) || !Number.isFinite(meanEnergy)) return null;
  return 10 * Math.log10(meanEnergy);
}

/** Spatial uniformity uses the arithmetic mean of point LAeq values in dB. */
export function summarizeUniformity(records: ZoneSplRecord[]): UniformitySummary | null {
  if (!records.length) return null;
  const unit = records[0].unit;
  if (records.some((record) => record.unit !== unit || !Number.isFinite(record.levelDb))) return null;
  const values = records.map((record) => record.levelDb);
  const minDb = Math.min(...values);
  const maxDb = Math.max(...values);
  const meanDb = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - meanDb) ** 2, 0) / values.length;
  return {
    count: values.length,
    minDb,
    maxDb,
    meanDb,
    spreadDb: maxDb - minDb,
    standardDeviationDb: Math.sqrt(variance),
    unit,
  };
}
