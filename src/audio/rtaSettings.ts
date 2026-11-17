export type RtaSensitivity = "high" | "medium" | "low";
export type RtaSpeed = "fast" | "medium" | "slow";

export const RTA_SENSITIVITY_OPTIONS: Record<RtaSensitivity, {
  label: string;
  floorDbfs: number;
  description: string;
}> = {
  high: { label: "Cao", floorDbfs: -100, description: "Hiển thị cả tín hiệu nhỏ" },
  medium: { label: "Vừa", floorDbfs: -85, description: "Cân bằng tín hiệu và nhiễu nền" },
  low: { label: "Thấp", floorDbfs: -70, description: "Tập trung tín hiệu mạnh" },
};

export const RTA_SPEED_OPTIONS: Record<RtaSpeed, {
  label: string;
  refreshLabel: string;
}> = {
  fast: { label: "Nhanh", refreshLabel: "~30 lần/giây" },
  medium: { label: "Vừa", refreshLabel: "~15 lần/giây" },
  slow: { label: "Chậm", refreshLabel: "~7,5 lần/giây" },
};

const RTA_SPEED_CONFIG: Record<RtaSpeed, {
  frameDivisor: number;
  smoothingTimeConstant: number;
  historyIntervalSamples: number;
}> = {
  fast: { frameDivisor: 2, smoothingTimeConstant: 0.35, historyIntervalSamples: 6 },
  medium: { frameDivisor: 4, smoothingTimeConstant: 0.62, historyIntervalSamples: 3 },
  slow: { frameDivisor: 8, smoothingTimeConstant: 0.82, historyIntervalSamples: 2 },
};

export function getRtaSpeedConfig(speed: RtaSpeed) {
  return RTA_SPEED_CONFIG[speed];
}

export function getRtaDisplayHeight(levelDbfs: number, sensitivity: RtaSensitivity): number {
  if (!Number.isFinite(levelDbfs)) return 0;
  const floor = RTA_SENSITIVITY_OPTIONS[sensitivity].floorDbfs;
  return Math.max(0, Math.min(100, ((levelDbfs - floor) / (0 - floor)) * 100));
}

export function getRtaBarColor(levelDbfs: number, sensitivity: RtaSensitivity): string {
  if (!Number.isFinite(levelDbfs)) return "#263640";
  const floor = RTA_SENSITIVITY_OPTIONS[sensitivity].floorDbfs;
  const amount = Math.max(0, Math.min(1, (levelDbfs - floor) / (0 - floor)));
  if (amount <= 0) return "#263640";
  const hue = 215 - amount * 215;
  const lightness = 42 + amount * 10;
  return `hsl(${hue.toFixed(0)} 88% ${lightness.toFixed(0)}%)`;
}
