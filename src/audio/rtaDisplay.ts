export type RtaSensitivity = "high" | "medium" | "low";
export type RtaSpeed = "fast" | "medium" | "slow";

const DISPLAY_FLOOR_DB: Record<RtaSensitivity, number> = {
  high: -100,
  medium: -85,
  low: -70,
};

/** Display-only floor. This never changes captured PCM or analysis values. */
export function rtaDisplayFloorDb(sensitivity: RtaSensitivity): number {
  return DISPLAY_FLOOR_DB[sensitivity];
}

/** RequestAnimationFrame is normally about 60 Hz: target ~30 / 20 / 10 updates per second. */
export function rtaFrameInterval(speed: RtaSpeed): number {
  switch (speed) {
    case "fast": return 2;
    case "medium": return 3;
    case "slow": return 6;
  }
}

/** AnalyserNode time smoothing: lower values respond faster to transients. */
export function rtaSmoothingConstant(speed: RtaSpeed): number {
  switch (speed) {
    case "fast": return 0.18;
    case "medium": return 0.55;
    case "slow": return 0.82;
  }
}

export type RtaBarVisual = {
  heightPercent: number;
  hueDegrees: number;
  intensity: number;
};

/** Convert a dBFS band to a multicolour display bar without altering its measured value. */
export function rtaBarVisual(levelDbfs: number, sensitivity: RtaSensitivity): RtaBarVisual {
  const floorDb = rtaDisplayFloorDb(sensitivity);
  const finiteLevel = Number.isFinite(levelDbfs) ? levelDbfs : floorDb;
  const boundedLevel = Math.max(floorDb, Math.min(0, finiteLevel));
  const intensity = Math.max(0, Math.min(1, (boundedLevel - floorDb) / -floorDb));
  return {
    heightPercent: Math.max(2, intensity * 100),
    hueDegrees: Math.round(220 * (1 - intensity)),
    intensity,
  };
}
