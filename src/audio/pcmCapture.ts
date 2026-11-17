export type PcmBlockMetadata = {
  frameStart: number;
  sampleRate: number;
  channelCount: number;
  byteLength: number;
};

/** Returns zero for adjacent PCM blocks and a positive count for discontinuities. */
export function countPcmFrameDiscontinuity(previousEndFrame: number, nextStartFrame: number, nominalBlockSize: number): number {
  if (!Number.isSafeInteger(previousEndFrame) || !Number.isSafeInteger(nextStartFrame)
    || !Number.isSafeInteger(nominalBlockSize) || nominalBlockSize <= 0) return 1;
  if (previousEndFrame === nextStartFrame) return 0;
  const delta = Math.abs(nextStartFrame - previousEndFrame);
  return Math.max(1, Math.ceil(delta / nominalBlockSize));
}

/** Fail closed on malformed PCM metadata before constructing a Float32Array. */
export function validatePcmBlockMetadata(
  metadata: PcmBlockMetadata,
  expectedSampleRate: number,
  expectedChannelCount: number | null,
): { valid: true; channelCount: number } | { valid: false; reason: string } {
  if (!Number.isSafeInteger(metadata.frameStart) || metadata.frameStart < 0) {
    return { valid: false, reason: "Invalid PCM frame position." };
  }
  if (!Number.isFinite(metadata.sampleRate) || metadata.sampleRate !== expectedSampleRate) {
    return { valid: false, reason: "PCM sample rate changed during capture." };
  }
  if (!Number.isInteger(metadata.channelCount) || metadata.channelCount < 1 || metadata.channelCount > 32) {
    return { valid: false, reason: "Invalid PCM channel count." };
  }
  if (expectedChannelCount !== null && metadata.channelCount !== expectedChannelCount) {
    return { valid: false, reason: "PCM channel count changed during capture." };
  }
  if (!Number.isSafeInteger(metadata.byteLength) || metadata.byteLength <= 0
    || metadata.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    return { valid: false, reason: "Invalid PCM buffer length." };
  }
  return { valid: true, channelCount: metadata.channelCount };
}
