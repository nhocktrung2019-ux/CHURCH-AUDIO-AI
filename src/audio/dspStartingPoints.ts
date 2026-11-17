export type MicrophoneUse = "dynamic-handheld" | "gooseneck";
export type DynamicsInputs = {
  microphone: MicrophoneUse;
  noiseFloorDbfs: number;
  speechPeakDbfs: number;
};

export type DynamicsStartingPoint = {
  gate: { mode: "soft-expander"; thresholdDbfs: number; rangeDb: number; attackMs: number; holdMs: number; releaseMs: number };
  compressor: { thresholdDbfs: number; ratio: number; attackMs: number; releaseMs: number; kneeDb: number; makeupGainDb: number };
  limiter: { ceilingDbfs: number; attackMs: number; releaseMs: number };
  warnings: string[];
};

/**
 * Conservative offline starting-point calculator. Values are dBFS references,
 * not console-specific units and never sent to a connected device.
 */
export function calculateDynamicsStartingPoint(input: DynamicsInputs): DynamicsStartingPoint {
  const noise = clamp(input.noiseFloorDbfs, -90, -10);
  const peak = clamp(input.speechPeakDbfs, -40, -1);
  const gooseneck = input.microphone === "gooseneck";
  const gateThreshold = clamp(noise + (gooseneck ? 8 : 6), -80, -12);
  const compressorThreshold = clamp(peak - (gooseneck ? 9 : 7), -36, -6);
  const warnings: string[] = [];
  if (peak <= noise + 6) warnings.push("Khoảng cách giữa tiếng nói và nền ồn thấp; không tăng gate mạnh. Hãy xử lý vị trí micro/loa và gain trước.");
  if (peak > -6) warnings.push("Đỉnh tiếng nói đang sát 0 dBFS; giảm gain đầu vào trước khi áp dụng compressor/limiter.");
  if (noise > -35) warnings.push("Nền ồn cao; gate không thể thay thế việc xử lý tiếng quạt, tiếng sân khấu hoặc vòng lặp loa-micro.");
  return {
    gate: { mode: "soft-expander", thresholdDbfs: gateThreshold, rangeDb: 10, attackMs: 5, holdMs: gooseneck ? 120 : 80, releaseMs: gooseneck ? 220 : 160 },
    compressor: { thresholdDbfs: compressorThreshold, ratio: gooseneck ? 2 : 2.5, attackMs: gooseneck ? 18 : 10, releaseMs: gooseneck ? 180 : 120, kneeDb: 6, makeupGainDb: 0 },
    limiter: { ceilingDbfs: -3, attackMs: 1, releaseMs: 100 },
    warnings,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
