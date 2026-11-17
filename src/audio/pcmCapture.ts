export type PcmBlockMetadata = {
  frameStart: number;
  frameCount: number;
  sampleRate: number;
  /** Number of channels actually stored in the transferred PCM buffer. */
  pcmChannelCount: number;
  /** Number of input channels mixed by the capture processor. */
  inputChannelCount: number;
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

/** Fail closed unless PCM byte length exactly matches frame and channel metadata. */
export function validatePcmBlockMetadata(
  metadata: PcmBlockMetadata,
  expectedSampleRate: number,
  expectedInputChannelCount: number | null,
  expectedPcmChannelCount = 1,
): { valid: true; inputChannelCount: number; pcmChannelCount: number; frameCount: number } | { valid: false; reason: string } {
  if (!Number.isSafeInteger(metadata.frameStart) || metadata.frameStart < 0) {
    return { valid: false, reason: "Invalid PCM frame position." };
  }
  if (!Number.isFinite(metadata.sampleRate) || metadata.sampleRate !== expectedSampleRate) {
    return { valid: false, reason: "PCM sample rate changed during capture." };
  }
  if (!Number.isSafeInteger(metadata.frameCount) || metadata.frameCount <= 0 || metadata.frameCount > 65536) {
    return { valid: false, reason: "Invalid PCM frame count." };
  }
  if (!Number.isInteger(metadata.pcmChannelCount) || metadata.pcmChannelCount < 1 || metadata.pcmChannelCount > 32) {
    return { valid: false, reason: "Invalid PCM payload channel count." };
  }
  if (metadata.pcmChannelCount !== expectedPcmChannelCount) {
    return { valid: false, reason: "Unexpected PCM payload channel layout." };
  }
  if (!Number.isInteger(metadata.inputChannelCount) || metadata.inputChannelCount < 1 || metadata.inputChannelCount > 32) {
    return { valid: false, reason: "Invalid audio input channel count." };
  }
  if (expectedInputChannelCount !== null && metadata.inputChannelCount !== expectedInputChannelCount) {
    return { valid: false, reason: "Audio input channel count changed during capture." };
  }
  const expectedByteLength = metadata.frameCount * metadata.pcmChannelCount * Float32Array.BYTES_PER_ELEMENT;
  if (!Number.isSafeInteger(metadata.byteLength) || metadata.byteLength !== expectedByteLength) {
    return { valid: false, reason: "PCM buffer byte length does not match frame/channel metadata." };
  }
  const frameEnd = metadata.frameStart + metadata.frameCount;
  if (!Number.isSafeInteger(frameEnd)) {
    return { valid: false, reason: "PCM frame range exceeds safe integer precision." };
  }
  return {
    valid: true,
    inputChannelCount: metadata.inputChannelCount,
    pcmChannelCount: metadata.pcmChannelCount,
    frameCount: metadata.frameCount,
  };
}
