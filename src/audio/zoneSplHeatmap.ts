export type HeatmapUnit = "dBFS" | "dB SPL";

export type SpatialSplPoint = {
  id: number; zone: string; position: string; xM: number; yM: number;
  levelDb: number; unit: HeatmapUnit; inputLabel: string;
  durationSeconds: number; calibrationOffsetDb?: number;
};
export type HeatmapCell = {
  xM: number; yM: number; levelDb: number | null;
  contributingPositions: number; nearestDistanceM: number | null;
  confidence: "measured" | "interpolated" | "insufficient" | "outside-radius";
};
export type ZoneHeatmap = {
  zone: string; unit: HeatmapUnit; cells: HeatmapCell[];
  measuredPositionCount: number; gridColumns: number; gridRows: number;
  interpolationRadiusM: number; method: "inverse-distance-squared";
};
export type HeatmapOptions = {
  roomLengthM: number; roomWidthM: number; gridColumns?: number;
  gridRows?: number; interpolationRadiusM?: number;
  minimumPositions?: number; power?: number;
};
type AggregatedPoint = { xM: number; yM: number; levelDb: number };

function aggregatePositions(points: SpatialSplPoint[]): AggregatedPoint[] {
  const groups = new Map<string, SpatialSplPoint[]>();
  for (const point of points) {
    const key = point.position.trim().toLocaleLowerCase("vi") + "|" + point.xM.toFixed(3) + "|" + point.yM.toFixed(3);
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const duration = group.reduce((sum, point) => sum + point.durationSeconds, 0);
    const energy = group.reduce((sum, point) => sum + 10 ** (point.levelDb / 10) * point.durationSeconds, 0) / duration;
    return { xM: group[0].xM, yM: group[0].yM, levelDb: 10 * Math.log10(energy) };
  });
}

/** Bounded IDW survey map. It never extrapolates beyond the configured radius. */
export function buildZoneSplHeatmap(
  records: SpatialSplPoint[], zone: string, options: HeatmapOptions,
): ZoneHeatmap | null {
  const columns = options.gridColumns ?? 12;
  const rows = options.gridRows ?? 8;
  const radius = options.interpolationRadiusM ?? 6;
  const minimumPositions = options.minimumPositions ?? 3;
  const power = options.power ?? 2;
  if (!zone.trim() || !Number.isFinite(options.roomLengthM) || options.roomLengthM <= 0 ||
      !Number.isFinite(options.roomWidthM) || options.roomWidthM <= 0 ||
      !Number.isInteger(columns) || columns < 2 || columns > 100 ||
      !Number.isInteger(rows) || rows < 2 || rows > 100 ||
      !Number.isFinite(radius) || radius <= 0 ||
      !Number.isInteger(minimumPositions) || minimumPositions < 2 ||
      !Number.isFinite(power) || power <= 0) return null;

  const selected = records.filter((point) => point.zone === zone);
  if (!selected.length) return null;
  const unit = selected[0].unit;
  const input = selected[0].inputLabel;
  if (selected.some((point) => point.unit !== unit || point.inputLabel !== input ||
      !Number.isFinite(point.levelDb) || point.levelDb <= -99 || point.levelDb > 200 ||
      !Number.isFinite(point.xM) || !Number.isFinite(point.yM) ||
      point.xM < 0 || point.xM > options.roomLengthM ||
      point.yM < 0 || point.yM > options.roomWidthM ||
      !Number.isFinite(point.durationSeconds) || point.durationSeconds <= 0 ||
      !point.position.trim())) return null;
  if (unit === "dB SPL") {
    if (selected.some((point) => !Number.isFinite(point.calibrationOffsetDb))) return null;
    const offsets = selected.map((point) => point.calibrationOffsetDb as number);
    if (Math.max(...offsets) - Math.min(...offsets) > 0.01) return null;
  }

  const positions = aggregatePositions(selected);
  const cells: HeatmapCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const xM = (column + 0.5) / columns * options.roomLengthM;
      const yM = (row + 0.5) / rows * options.roomWidthM;
      const distances = positions.map((point) => ({ point, distance: Math.hypot(xM - point.xM, yM - point.yM) }))
        .sort((a, b) => a.distance - b.distance);
      const nearestDistanceM = distances[0]?.distance ?? null;
      if (nearestDistanceM === null || nearestDistanceM > radius) {
        cells.push({ xM, yM, levelDb: null, contributingPositions: 0, nearestDistanceM, confidence: "outside-radius" });
        continue;
      }
      const exact = distances.find((entry) => entry.distance < 0.001);
      if (exact) {
        cells.push({ xM, yM, levelDb: exact.point.levelDb, contributingPositions: 1, nearestDistanceM: 0, confidence: "measured" });
        continue;
      }
      const neighbours = distances.filter((entry) => entry.distance <= radius);
      if (neighbours.length < minimumPositions) {
        cells.push({ xM, yM, levelDb: null, contributingPositions: neighbours.length, nearestDistanceM, confidence: "insufficient" });
        continue;
      }
      const weightedEnergy = neighbours.reduce((sum, entry) => sum + 10 ** (entry.point.levelDb / 10) / entry.distance ** power, 0);
      const weightTotal = neighbours.reduce((sum, entry) => sum + 1 / entry.distance ** power, 0);
      cells.push({
        xM, yM, levelDb: 10 * Math.log10(weightedEnergy / weightTotal),
        contributingPositions: neighbours.length, nearestDistanceM, confidence: "interpolated",
      });
    }
  }
  return {
    zone, unit, cells, measuredPositionCount: positions.length,
    gridColumns: columns, gridRows: rows, interpolationRadiusM: radius,
    method: "inverse-distance-squared",
  };
}
