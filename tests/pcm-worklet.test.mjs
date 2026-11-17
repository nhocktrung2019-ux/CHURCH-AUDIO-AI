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

const valid = {
  frameStart: 0,
  frameCount: 2048,
  sampleRate: 48000,
  pcmChannelCount: 1,
  inputChannelCount: 2,
  byteLength: 2048 * Float32Array.BYTES_PER_ELEMENT,
};

test("accepts mono PCM with explicit two-channel input metadata", () => {
  assert.deepEqual(validatePcmBlockMetadata(valid, 48000, 2), {
    valid: true,
    inputChannelCount: 2,
    pcmChannelCount: 1,
    frameCount: 2048,
  });
});

test("rejects sample-rate and input-channel changes", () => {
  assert.equal(validatePcmBlockMetadata(valid, 44100, 2).valid, false);
  assert.equal(validatePcmBlockMetadata(valid, 48000, 1).valid, false);
});

test("rejects a channel layout that does not match the mono payload", () => {
  assert.equal(validatePcmBlockMetadata({ ...valid, pcmChannelCount: 2 }, 48000, 2).valid, false);
  assert.equal(validatePcmBlockMetadata(valid, 48000, 2, 2).valid, false);
});

test("rejects byte length that disagrees with frames and PCM channels", () => {
  assert.equal(validatePcmBlockMetadata({ ...valid, byteLength: valid.byteLength + 4 }, 48000, 2).valid, false);
  assert.equal(validatePcmBlockMetadata({ ...valid, byteLength: 8193 }, 48000, 2).valid, false);
});

test("rejects invalid frame ranges and empty frame blocks", () => {
  assert.equal(validatePcmBlockMetadata({ ...valid, frameStart: -1 }, 48000, 2).valid, false);
  assert.equal(validatePcmBlockMetadata({ ...valid, frameStart: Number.MAX_SAFE_INTEGER }, 48000, 2).valid, false);
  assert.equal(validatePcmBlockMetadata({ ...valid, frameCount: 0, byteLength: 0 }, 48000, 2).valid, false);
});
