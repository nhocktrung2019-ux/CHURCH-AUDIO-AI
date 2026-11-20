export type PcmBlockMetadata = {
  frameStart: number;
  frameCount: number;
  sampleRate: number;
  /** Number of channels actually stored in the transferred PCM buffer. */
  pcmChannelCount: number;
  /** Number of channels delivered by the input stream before analysis downmix. */
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
  expectedPcmChannelCount: number | null = 1,
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
  if (expectedPcmChannelCount !== null && metadata.pcmChannelCount !== expectedPcmChannelCount) {
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


/** Convert frame-major interleaved PCM to independent channel arrays. */
export function deinterleaveInterleavedPcm(
  samples: Float32Array,
  frameCount: number,
  channelCount: number,
): Float32Array[] | null {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0
    || !Number.isInteger(channelCount) || channelCount < 1 || channelCount > 32
    || samples.length !== frameCount * channelCount) return null;
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount));
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      channels[channel][frame] = samples[frame * channelCount + channel];
    }
  }
  return channels;
}

/** Explicitly downmix preserved interleaved PCM for the current mono H1 analyzer. */
export function mixInterleavedPcmToMono(
  samples: Float32Array,
  frameCount: number,
  channelCount: number,
): Float32Array | null {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0
    || !Number.isInteger(channelCount) || channelCount < 1 || channelCount > 32
    || samples.length !== frameCount * channelCount) return null;
  const mono = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = samples[frame * channelCount + channel];
      if (!Number.isFinite(sample)) return null;
      sum += sample;
    }
    mono[frame] = sum / channelCount;
  }
  return mono;
}

/** Join copied mono PCM blocks in arrival order without exposing reused audio buffers. */
export function concatenatePcmChunks(chunks: readonly Float32Array[], maxSamples = Number.MAX_SAFE_INTEGER): Float32Array {
  if (!Number.isSafeInteger(maxSamples) || maxSamples < 0) {
    throw new Error("Giới hạn mẫu PCM không hợp lệ.");
  }
  let total = 0;
  for (const chunk of chunks) {
    if (!(chunk instanceof Float32Array)) throw new Error("PCM chunk phải là Float32Array.");
    total += chunk.length;
    if (!Number.isSafeInteger(total)) throw new Error("Tổng số mẫu PCM vượt giới hạn an toàn.");
  }
  const outputLength = Math.min(total, maxSamples);
  const output = new Float32Array(outputLength);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= outputLength) break;
    const count = Math.min(chunk.length, outputLength - offset);
    output.set(chunk.subarray(0, count), offset);
    offset += count;
  }
  return output;
}
