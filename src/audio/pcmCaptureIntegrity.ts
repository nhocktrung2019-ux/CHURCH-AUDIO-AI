import { validatePcmBlockMetadata, type PcmBlockMetadata } from "./pcmCapture.ts";

export type PcmCaptureChannelIntegrity = {
  channelIndex: number;
  peakDbfs: number | null;
  rmsDbfs: number | null;
  nearFullScaleSamples: number;
  nearFullScalePercent: number;
};

export type PcmCaptureIntegritySnapshot = {
  sampleFormat: "float32";
  sampleRate: number;
  channelCount: number | null;
  blocksReceived: number;
  framesCaptured: number;
  firstFrame: number | null;
  nextExpectedFrame: number | null;
  durationSeconds: number;
  channelStats: PcmCaptureChannelIntegrity[];
};

export type PcmCaptureBlockAcceptance =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Verifies PCM blocks before they enter measurement analysis.
 *
 * The frame counter is the Web Audio render clock for this single stream.
 * It does not prove the USB interface's physical ADC clock or bit depth.
 */
export class PcmCaptureIntegrityMonitor {
  private readonly expectedSampleRate: number;
  private channelCount: number | null = null;
  private blocksReceived = 0;
  private framesCaptured = 0;
  private firstFrame: number | null = null;
  private nextExpectedFrame: number | null = null;
  private peaks: number[] = [];
  private sumSquares: number[] = [];
  private nearFullScale: number[] = [];
  private failureReason: string | null = null;

  constructor(expectedSampleRate: number) {
    this.expectedSampleRate = expectedSampleRate;
  }

  accept(
    metadata: PcmBlockMetadata,
    samples: Float32Array,
    sequence: number,
    channelMix: string,
    sampleFormat: string,
  ): PcmCaptureBlockAcceptance {
    if (this.failureReason) return { valid: false, reason: this.failureReason };
    if (!Number.isFinite(this.expectedSampleRate) || this.expectedSampleRate <= 0) {
      return this.fail("Invalid AudioContext sample rate for PCM integrity monitoring.");
    }
    if (!Number.isSafeInteger(sequence) || sequence !== this.blocksReceived) {
      return this.fail("PCM block sequence is missing, duplicated or out of order.");
    }
    if (channelMix !== "interleaved-preserved") {
      return this.fail("PCM channel layout is not explicitly marked as preserved interleaved data.");
    }
    if (sampleFormat !== "float32") {
      return this.fail("Unsupported PCM sample format; expected Float32 from Web Audio.");
    }

    const validation = validatePcmBlockMetadata(
      metadata,
      this.expectedSampleRate,
      this.channelCount,
      metadata.pcmChannelCount,
    );
    if (!validation.valid) return this.fail(validation.reason);
    if (metadata.pcmChannelCount !== metadata.inputChannelCount) {
      return this.fail("PCM payload does not preserve every input channel.");
    }
    if (!(samples instanceof Float32Array) || samples.length !== metadata.frameCount * metadata.pcmChannelCount
      || samples.byteLength !== metadata.byteLength) {
      return this.fail("PCM sample buffer length does not match the declared frame/channel layout.");
    }
    if (this.nextExpectedFrame !== null && metadata.frameStart !== this.nextExpectedFrame) {
      return this.fail(metadata.frameStart > this.nextExpectedFrame
        ? "PCM frame gap detected; dropped frames make this capture unusable."
        : "PCM frames were duplicated or reordered; capture is unusable.");
    }
    if (!Number.isSafeInteger(metadata.frameStart + metadata.frameCount)
      || !Number.isSafeInteger(this.framesCaptured + metadata.frameCount)) {
      return this.fail("PCM frame counters exceed safe integer precision.");
    }

    const channelCount = metadata.pcmChannelCount;
    const peaks = this.channelCount === null ? Array.from({ length: channelCount }, () => 0) : [...this.peaks];
    const sumSquares = this.channelCount === null ? Array.from({ length: channelCount }, () => 0) : [...this.sumSquares];
    const nearFullScale = this.channelCount === null ? Array.from({ length: channelCount }, () => 0) : [...this.nearFullScale];

    for (let frame = 0; frame < metadata.frameCount; frame++) {
      for (let channel = 0; channel < channelCount; channel++) {
        const sample = samples[frame * channelCount + channel];
        if (!Number.isFinite(sample)) {
          return this.fail("Non-finite PCM sample detected in channel " + (channel + 1) + ".");
        }
        const absolute = Math.abs(sample);
        if (absolute > peaks[channel]) peaks[channel] = absolute;
        sumSquares[channel] += sample * sample;
        if (absolute >= 0.999) nearFullScale[channel]++;
      }
    }

    if (this.firstFrame === null) this.firstFrame = metadata.frameStart;
    this.channelCount = channelCount;
    this.peaks = peaks;
    this.sumSquares = sumSquares;
    this.nearFullScale = nearFullScale;
    this.nextExpectedFrame = metadata.frameStart + metadata.frameCount;
    this.framesCaptured += metadata.frameCount;
    this.blocksReceived++;
    return { valid: true };
  }

  private fail(reason: string): PcmCaptureBlockAcceptance {
    this.failureReason = reason;
    return { valid: false, reason };
  }

  getSnapshot(): PcmCaptureIntegritySnapshot {
    const channelCount = this.channelCount ?? 0;
    const channelStats = Array.from({ length: channelCount }, (_, channelIndex) => {
      const peak = this.peaks[channelIndex] ?? 0;
      const meanSquare = this.framesCaptured > 0
        ? (this.sumSquares[channelIndex] ?? 0) / this.framesCaptured
        : 0;
      return {
        channelIndex,
        peakDbfs: peak > 0 ? 20 * Math.log10(peak) : null,
        rmsDbfs: meanSquare > 0 ? 10 * Math.log10(meanSquare) : null,
        nearFullScaleSamples: this.nearFullScale[channelIndex] ?? 0,
        nearFullScalePercent: this.framesCaptured > 0
          ? (this.nearFullScale[channelIndex] / this.framesCaptured) * 100
          : 0,
      };
    });
    return {
      sampleFormat: "float32",
      sampleRate: this.expectedSampleRate,
      channelCount: this.channelCount,
      blocksReceived: this.blocksReceived,
      framesCaptured: this.framesCaptured,
      firstFrame: this.firstFrame,
      nextExpectedFrame: this.nextExpectedFrame,
      durationSeconds: this.expectedSampleRate > 0 ? this.framesCaptured / this.expectedSampleRate : 0,
      channelStats,
    };
  }
}
