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
  calibrationOffsetDb?: number;
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


export type ZoneBalanceRow = {
  zone: string;
  pointCount: number;
  positionCount: number;
  meanDb: number;
  minDb: number;
  maxDb: number;
  spreadDb: number;
  standardDeviationDb: number;
  deltaFromMeanDb: number;
  status: "balanced" | "low" | "high" | "insufficient";
};

/**
 * Compare zones only when unit and input label match. Repeated captures at a
 * seat are energy-averaged first, then each distinct seat receives equal weight.
 * The zone-to-zone reference is the arithmetic mean of zone means.
 */
export function compareZoneLevels(
  records: ZoneSplRecord[],
  toleranceDb = 2,
): ZoneBalanceRow[] | null {
  if (!records.length || !Number.isFinite(toleranceDb) || toleranceDb < 0) return null;
  const unit = records[0].unit;
  const input = records[0].inputLabel;
  if (records.some((record) =>
    record.unit !== unit ||
    record.inputLabel !== input ||
    !Number.isFinite(record.levelDb) ||
    record.levelDb <= -99 ||
    record.levelDb > 200 ||
    !Number.isFinite(record.durationSeconds) ||
    record.durationSeconds <= 0 ||
    !record.position.trim() ||
    !record.zone.trim()
  )) return null;
  if (unit === "dB SPL") {
    if (records.some((record) => !Number.isFinite(record.calibrationOffsetDb))) return null;
    const offsets = records.map((record) => record.calibrationOffsetDb as number);
    if (Math.max(...offsets) - Math.min(...offsets) > 0.01) return null;
  }

  const zones = new Map<string, Map<string, ZoneSplRecord[]>>();
  for (const record of records) {
    if (!zones.has(record.zone)) zones.set(record.zone, new Map());
    const positions = zones.get(record.zone)!;
    if (!positions.has(record.position)) positions.set(record.position, []);
    positions.get(record.position)!.push(record);
  }

  const preliminary = [...zones.entries()].map(([zone, positions]) => {
    const positionLevels = [...positions.values()]
      .map((captures) => {
        const totalDuration = captures.reduce((sum, record) => sum + record.durationSeconds, 0);
        const meanEnergy = captures.reduce((sum, record) =>
          sum + (10 ** (record.levelDb / 10)) * record.durationSeconds, 0) / totalDuration;
        return totalDuration > 0 && meanEnergy > 0 && Number.isFinite(meanEnergy)
          ? 10 * Math.log10(meanEnergy)
          : null;
      })
      .filter((value): value is number => value !== null);
    const meanDb = positionLevels.length
      ? positionLevels.reduce((sum, value) => sum + value, 0) / positionLevels.length
      : Number.NaN;
    const minDb = Math.min(...positionLevels);
    const maxDb = Math.max(...positionLevels);
    const variance = positionLevels.reduce((sum, value) => sum + (value - meanDb) ** 2, 0) / positionLevels.length;
    return {
      zone,
      pointCount: [...positions.values()].reduce((sum, levels) => sum + levels.length, 0),
      positionCount: positionLevels.length,
      meanDb,
      minDb,
      maxDb,
      spreadDb: maxDb - minDb,
      standardDeviationDb: Math.sqrt(variance),
    };
  });
  const referenceMean = preliminary.reduce((sum, row) => sum + row.meanDb, 0) / preliminary.length;
  return preliminary.map((row) => {
    const deltaFromMeanDb = row.meanDb - referenceMean;
    const status = row.positionCount < 2
      ? "insufficient"
      : deltaFromMeanDb < -toleranceDb
        ? "low"
        : deltaFromMeanDb > toleranceDb
          ? "high"
          : "balanced";
    return { ...row, deltaFromMeanDb, status };
  }).sort((a, b) => a.zone.localeCompare(b.zone, "vi"));
}
