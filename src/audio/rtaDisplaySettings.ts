export type RtaSensitivity = "high" | "medium" | "low";
export type RtaSpeed = "fast" | "medium" | "slow";

const DISPLAY_FLOOR: Record<RtaSensitivity, number> = {
  high: -90,
  medium: -75,
  low: -60,
};

export function getRtaDisplayFloor(sensitivity: RtaSensitivity): number {
  return DISPLAY_FLOOR[sensitivity];
}

/** Analyser smoothing: lower values react faster; this does not change the FFT cadence. */
export function getRtaSmoothing(speed: RtaSpeed): number {
  return speed === "fast" ? 0.35 : speed === "slow" ? 0.9 : 0.72;
}

export function getRtaBarHeight(levelDbfs: number, sensitivity: RtaSensitivity): number {
  const floor = getRtaDisplayFloor(sensitivity);
  if (!Number.isFinite(levelDbfs)) return 2;
  return Math.max(2, Math.min(100, ((levelDbfs - floor) / (0 - floor)) * 100));
}

/** Rainbow frequency palette: low bands start blue and progress through cyan, green, yellow and red. */
export function getRtaBandColor(index: number, bandCount: number): string {
  const safeCount = Math.max(1, bandCount);
  const hue = 240 - (Math.max(0, index) / safeCount) * 240;
  return `hsl(${hue}, 88%, 58%)`;
}
