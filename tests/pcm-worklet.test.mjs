import test from "node:test";
import assert from "node:assert/strict";
import { countPcmFrameDiscontinuity, validatePcmBlockMetadata } from "../src/audio/pcmCapture.ts";

test("PCM frame continuity accepts adjacent blocks", () => {
  assert.equal(countPcmFrameDiscontinuity(2048, 2048, 2048), 0);
  assert.equal(countPcmFrameDiscontinuity(4096, 4096, 2048), 0);
});

test("PCM frame continuity detects dropped, duplicated and reordered frames", () => {
  assert.equal(countPcmFrameDiscontinuity(2048, 4096, 2048), 1);
  assert.equal(countPcmFrameDiscontinuity(2048, 8192, 2048), 3);
  assert.equal(countPcmFrameDiscontinuity(4096, 2048, 2048), 1);
  assert.equal(countPcmFrameDiscontinuity(2048, 2176, 2048), 1);
});

test("invalid frame counters fail closed", () => {
  assert.equal(countPcmFrameDiscontinuity(Number.NaN, 0, 2048), 1);
  assert.equal(countPcmFrameDiscontinuity(0, 1, 0), 1);
});

const valid = { frameStart: 0, sampleRate: 48000, channelCount: 2, byteLength: 8192 };

test("accepts stable PCM metadata", () => {
  assert.deepEqual(validatePcmBlockMetadata(valid, 48000, 2), { valid: true, channelCount: 2 });
});

test("rejects sample-rate, channel-count and buffer changes", () => {
  assert.equal(validatePcmBlockMetadata(valid, 44100, 2).valid, false);
  assert.equal(validatePcmBlockMetadata(valid, 48000, 1).valid, false);
  assert.equal(validatePcmBlockMetadata({ ...valid, byteLength: 8193 }, 48000, 2).valid, false);
  assert.equal(validatePcmBlockMetadata({ ...valid, frameStart: -1 }, 48000, 2).valid, false);
});
