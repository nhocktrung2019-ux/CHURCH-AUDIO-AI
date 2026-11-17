import test from "node:test";
import assert from "node:assert/strict";
import { PcmCaptureIntegrityMonitor } from "../src/audio/pcmCaptureIntegrity.ts";

function metadata(frameStart, frameCount, channels = 2, sampleRate = 48000) {
  return {
    frameStart,
    frameCount,
    sampleRate,
    pcmChannelCount: channels,
    inputChannelCount: channels,
    byteLength: frameCount * channels * Float32Array.BYTES_PER_ELEMENT,
  };
}

function accept(monitor, meta, samples, sequence = 0, channelMix = "interleaved-preserved", sampleFormat = "float32") {
  return monitor.accept(meta, samples, sequence, channelMix, sampleFormat);
}

test("accepts contiguous interleaved blocks and reports per-channel PCM statistics", () => {
  const monitor = new PcmCaptureIntegrityMonitor(48000);
  assert.deepEqual(accept(monitor, metadata(100, 2), new Float32Array([0.5, 0.25, 1, -0.5])), { valid: true });
  assert.deepEqual(accept(monitor, metadata(102, 2), new Float32Array([0.25, 0.5, -0.25, 0.25]), 1), { valid: true });
  const snapshot = monitor.getSnapshot();
  assert.equal(snapshot.channelCount, 2);
  assert.equal(snapshot.blocksReceived, 2);
  assert.equal(snapshot.framesCaptured, 4);
  assert.equal(snapshot.firstFrame, 100);
  assert.equal(snapshot.nextExpectedFrame, 104);
  assert.equal(snapshot.durationSeconds, 4 / 48000);
  assert.equal(snapshot.channelStats[0].nearFullScaleSamples, 1);
  assert.ok(snapshot.channelStats[0].peakDbfs !== null);
  assert.ok(snapshot.channelStats[1].rmsDbfs !== null);
});

test("rejects dropped frame ranges and latches the capture as invalid", () => {
  const monitor = new PcmCaptureIntegrityMonitor(48000);
  assert.equal(accept(monitor, metadata(0, 2), new Float32Array([0, 0, 0, 0])).valid, true);
  const gap = accept(monitor, metadata(3, 2), new Float32Array([0, 0, 0, 0]), 1);
  assert.equal(gap.valid, false);
  assert.match(gap.reason, /frame gap/i);
  assert.equal(accept(monitor, metadata(2, 2), new Float32Array([0, 0, 0, 0]), 1).valid, false);
});

test("rejects duplicated or reordered block sequence numbers", () => {
  const monitor = new PcmCaptureIntegrityMonitor(48000);
  const result = accept(monitor, metadata(0, 2), new Float32Array([0, 0, 0, 0]), 2);
  assert.equal(result.valid, false);
  assert.match(result.reason, /sequence/i);
});

test("rejects changes in sample rate, channel count and frame payload size", () => {
  const monitor = new PcmCaptureIntegrityMonitor(48000);
  assert.equal(accept(monitor, metadata(0, 2), new Float32Array([0, 0, 0, 0])).valid, true);
  assert.equal(accept(monitor, metadata(2, 2, 1), new Float32Array([0, 0]), 1).valid, false);
});

test("rejects non-finite samples in any retained channel", () => {
  const monitor = new PcmCaptureIntegrityMonitor(48000);
  const result = accept(monitor, metadata(0, 2), new Float32Array([0, 0, Number.NaN, 0]));
  assert.equal(result.valid, false);
  assert.match(result.reason, /non-finite/i);
});

test("rejects channel downmixes and unsupported sample format labels", () => {
  const first = new PcmCaptureIntegrityMonitor(48000);
  const downmix = accept(first, metadata(0, 2, 1), new Float32Array([0, 0]), 0, "arithmetic-mean");
  assert.equal(downmix.valid, false);
  const second = new PcmCaptureIntegrityMonitor(48000);
  const format = accept(second, metadata(0, 2, 2), new Float32Array([0, 0, 0, 0]), 0, "interleaved-preserved", "int16");
  assert.equal(format.valid, false);
});

test("tracks near-full-scale samples without claiming native ADC clipping", () => {
  const monitor = new PcmCaptureIntegrityMonitor(48000);
  assert.equal(accept(monitor, metadata(0, 1), new Float32Array([0.9995, -0.25])).valid, true);
  const snapshot = monitor.getSnapshot();
  assert.equal(snapshot.channelStats[0].nearFullScaleSamples, 1);
  assert.equal(snapshot.channelStats[0].nearFullScalePercent, 100);
});
