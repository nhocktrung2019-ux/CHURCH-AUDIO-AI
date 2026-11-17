export function frequencyForBand(index: number, count: number, minHz = 20, maxHz = 20000): number {
  if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(index)) return minHz;
  const safeCount = Math.max(1, Math.floor(count));
  const safeIndex = Math.max(0, Math.min(safeCount - 1, Math.floor(index)));
  return minHz * Math.pow(maxHz / minHz, (safeIndex + 0.5) / safeCount);
}

export function bandForFrequency(frequencyHz: number, count: number, minHz = 20, maxHz = 20000): number {
  if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(frequencyHz)) return 0;
  const safeCount = Math.max(1, Math.floor(count));
  const safeFrequency = Math.max(minHz, Math.min(maxHz, frequencyHz));
  return Math.max(0, Math.min(safeCount - 1, Math.floor(Math.log(safeFrequency / minHz) / Math.log(maxHz / minHz) * safeCount)));
}
