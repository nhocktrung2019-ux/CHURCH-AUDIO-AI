/** Returns zero for adjacent PCM blocks and a positive count for discontinuities. */
export function countPcmFrameDiscontinuity(previousEndFrame: number, nextStartFrame: number, nominalBlockSize: number): number {
  if (!Number.isFinite(previousEndFrame) || !Number.isFinite(nextStartFrame)
    || !Number.isFinite(nominalBlockSize) || nominalBlockSize <= 0) return 1;
  if (previousEndFrame === nextStartFrame) return 0;
  return Math.max(1, Math.round(Math.abs(nextStartFrame - previousEndFrame) / nominalBlockSize));
}
