export type SPLZoneReading = {
  id: string;
  zone: string;
  levelDb: number;
  capturedAt: string;
  calibrated: boolean;
};

export type SPLZoneBalance = {
  count: number;
  minimumDb: number;
  maximumDb: number;
  spreadDb: number;
  energyAverageDb: number;
  targetDb: number;
  recommendations: Array<{ zone: string; measuredDb: number; gainSuggestionDb: number }>;
};

const energyMean = (values: number[]) =>
  10 * Math.log10(values.reduce((sum, value) => sum + 10 ** (value / 10), 0) / values.length);

export function summarizeSPLZones(readings: SPLZoneReading[]): SPLZoneBalance | null {
  const valid = readings.filter((reading) => Number.isFinite(reading.levelDb));
  if (!valid.length) return null;

  const levels = valid.map((reading) => reading.levelDb).sort((a, b) => a - b);
  const middle = Math.floor(levels.length / 2);
  const targetDb = levels.length % 2
    ? levels[middle]
    : (levels[middle - 1] + levels[middle]) / 2;

  return {
    count: valid.length,
    minimumDb: levels[0],
    maximumDb: levels[levels.length - 1],
    spreadDb: levels[levels.length - 1] - levels[0],
    energyAverageDb: energyMean(levels),
    targetDb,
    recommendations: valid.map((reading) => ({
      zone: reading.zone,
      measuredDb: reading.levelDb,
      // Advisory only: keep suggested changes conservative and never write to a DSP.
      gainSuggestionDb: Math.max(-6, Math.min(6, targetDb - reading.levelDb)),
    })),
  };
}
