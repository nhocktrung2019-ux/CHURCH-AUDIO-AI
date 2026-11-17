import test from "node:test";
import assert from "node:assert/strict";
import {
  deinterleaveInterleavedPcm,
  mixInterleavedPcmToMono,
  validatePcmBlockMetadata,
} from "../src/audio/pcmCapture.ts";

test("deinterleaves frame-major stereo PCM without swapping channels", () => {
  const interleaved = new Float32Array([1, 10, 2, 20, 3, 30]);
  const channels = deinterleaveInterleavedPcm(interleaved, 3, 2);
  assert.ok(channels);
  assert.deepEqual(Array.from(channels[0]), [1, 2, 3]);
  assert.deepEqual(Array.from(channels[1]), [10, 20, 30]);
});

test("downmixes interleaved stereo only when explicitly requested", () => {
  const interleaved = new Float32Array([1, 3, 2, 4, -1, 1]);
  const mono = mixInterleavedPcmToMono(interleaved, 3, 2);
  assert.ok(mono);
  assert.deepEqual(Array.from(mono), [2, 3, 0]);
});

test("rejects malformed interleaved payload sizes and invalid channel counts", () => {
  assert.equal(deinterleaveInterleavedPcm(new Float32Array(5), 3, 2), null);
  assert.equal(mixInterleavedPcmToMono(new Float32Array(6), 3, 0), null);
  assert.equal(mixInterleavedPcmToMono(new Float32Array([1, NaN]), 1, 2), null);
});

test("validates a two-channel PCM block against exact byte length", () => {
  const result = validatePcmBlockMetadata({
    frameStart: 4096,
    frameCount: 2048,
    sampleRate: 48000,
    pcmChannelCount: 2,
    inputChannelCount: 2,
    byteLength: 2048 * 2 * Float32Array.BYTES_PER_ELEMENT,
  }, 48000, 2, 2);
  assert.equal(result.valid, true);
});

test("rejects PCM whose payload does not preserve the declared input channels", () => {
  const result = validatePcmBlockMetadata({
    frameStart: 4096,
    frameCount: 2048,
    sampleRate: 48000,
    pcmChannelCount: 1,
    inputChannelCount: 2,
    byteLength: 2048 * Float32Array.BYTES_PER_ELEMENT,
  }, 48000, 2, 2);
  assert.equal(result.valid, false);
});
