import type { MeasuredPoint, RoomBounds, Weighting } from "./measuredPointModel";

const isInsideRoom = (point: MeasuredPoint, room: RoomBounds) =>
  Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z) &&
  point.x >= 0 && point.x <= room.length && point.y >= 0 && point.y <= room.width &&
  point.z >= 0 && point.z <= room.height;

const isValidSpl = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0 && value <= 160;

export type MeasuredSurface = {
  positions: number[];
  values: number[];
  indices: number[];
  minDb: number;
  maxDb: number;
  meanDb: number;
  sampleCount: number;
  cellCount: number;
  weighting: Weighting;
};

type SurfacePoint = Pick<MeasuredPoint, "x" | "y" | "splDb" | "calibration" | "weighting">;

const cross = (o: SurfacePoint, a: SurfacePoint, b: SurfacePoint) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function convexHull(points: SurfacePoint[]): SurfacePoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return [];
  const lower: SurfacePoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-8) lower.pop();
    lower.push(point);
  }
  const upper: SurfacePoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-8) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function insidePolygon(x: number, y: number, polygon: SurfacePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const intersects = ((a.y > y) !== (b.y > y)) &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function interpolate(x: number, y: number, points: SurfacePoint[]): number {
  const distances = points.map((point) => ({
    value: point.splDb as number,
    distance2: (point.x - x) ** 2 + (point.y - y) ** 2,
  }));
  const exact = distances.find((item) => item.distance2 < 1e-8);
  if (exact) return exact.value;
  let weighted = 0, totalWeight = 0;
  for (const item of distances) {
    const weight = 1 / Math.max(item.distance2, 0.04);
    weighted += item.value * weight;
    totalWeight += weight;
  }
  return weighted / totalWeight;
}

/**
 * Builds a conservative floor-level IDW surface from calibrated physical SPL readings.
 * No surface is produced until four compatible readings form a non-degenerate hull.
 * Cells outside the measured convex hull or too far from a reading remain transparent.
 */
export function buildMeasuredSurface(
  allPoints: readonly MeasuredPoint[],
  room: RoomBounds,
  weighting: Weighting,
  columns = 24,
  rows = 14,
): MeasuredSurface | null {
  const points = allPoints.filter((point) =>
    isInsideRoom(point, room) &&
    point.calibration === "calibrated" &&
    point.weighting === weighting &&
    isValidSpl(point.splDb),
  );
  if (points.length < 4 || room.length <= 0 || room.width <= 0) return null;
  const hull = convexHull(points);
  if (hull.length < 3) return null;
  const area = Math.abs(hull.reduce((sum, point, index) => {
    const next = hull[(index + 1) % hull.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
  if (area < 0.25) return null;

  const stepX = room.length / columns;
  const stepY = room.width / rows;
  const maxDistance = Math.max(2, Math.min(room.length, room.width) * 0.28);
  const positions: number[] = [];
  const values: number[] = [];
  const indices: number[] = [];
  const estimates: number[] = [];
  let vertex = 0;
  let cellCount = 0;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x0 = column * stepX, x1 = (column + 1) * stepX;
      const y0 = row * stepY, y1 = (row + 1) * stepY;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (!insidePolygon(cx, cy, hull)) continue;
      const nearest = Math.min(...points.map((point) => Math.hypot(point.x - cx, point.y - cy)));
      if (nearest > maxDistance) continue;

      const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as const;
      for (const [x, y] of corners) {
        const value = interpolate(x, y, points);
        positions.push(x, 0, y);
        values.push(value);
        estimates.push(value);
      }
      indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
      vertex += 4;
      cellCount++;
    }
  }

  if (cellCount === 0) return null;
  const minDb = Math.min(...estimates);
  const maxDb = Math.max(...estimates);
  const meanDb = estimates.reduce((sum, value) => sum + value, 0) / estimates.length;
  return { positions, values, indices, minDb, maxDb, meanDb, sampleCount: points.length, cellCount, weighting };
}
