import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateSynchronousRelativeDelay,
  extractSynchronousPlanarPair,
  validateSynchronousChannelPair,
} from "../src/audio/dualChannel.ts";

const refMeta = {
  captureSessionId: "session-a",
  clockDomainId: "audio-context-a",
  sourceStreamId: "usb-stream-a",
  sampleRate: 48000,
  frameStart: 8192,
  frameCount: 2048,
  channelIndex: 0,
};
const micMeta = { ...refMeta, channelIndex: 1 };

test("accepts two distinct channels from the same frame clock and stream", () => {
  assert.deepEqual(validateSynchronousChannelPair(refMeta, micMeta), {
    valid: true,
    sampleRate: 48000,
    frameStart: 8192,
    frameCount: 2048,
    referenceChannel: 0,
    measurementChannel: 1,
  });
});

test("rejects independent streams and clock domains", () => {
  assert.equal(validateSynchronousChannelPair(refMeta, { ...micMeta, sourceStreamId: "bluetooth-stream" }).valid, false);
  assert.equal(validateSynchronousChannelPair(refMeta, { ...micMeta, clockDomainId: "other-context" }).valid, false);
  assert.equal(validateSynchronousChannelPair(refMeta, { ...micMeta, captureSessionId: "session-b" }).valid, false);
});

test("rejects sample rate, frame range and channel mapping mismatches", () => {
  assert.equal(validateSynchronousChannelPair(refMeta, { ...micMeta, sampleRate: 44100 }).valid, false);
  assert.equal(validateSynchronousChannelPair(refMeta, { ...micMeta, frameStart: 8193 }).valid, false);
  assert.equal(validateSynchronousChannelPair(refMeta, { ...micMeta, frameCount: 1024 }).valid, false);
  assert.equal(validateSynchronousChannelPair(refMeta, { ...micMeta, channelIndex: 0 }).valid, false);
});

test("rejects missing provenance metadata", () => {
  assert.equal(validateSynchronousChannelPair({ ...refMeta, clockDomainId: "" }, micMeta).valid, false);
});

test("extracts only complete equal-length planar channel pairs", () => {
  const channels = [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])];
  const pair = extractSynchronousPlanarPair(channels, 3, 0, 1);
  assert.equal(pair.valid, true);
  if (pair.valid) {
    assert.deepEqual(Array.from(pair.reference), [1, 2, 3]);
    assert.deepEqual(Array.from(pair.measurement), [4, 5, 6]);
    assert.notEqual(pair.reference, channels[0]);
  }
});

test("rejects missing, same or incomplete channel arrays", () => {
  assert.equal(extractSynchronousPlanarPair([new Float32Array(3)], 3, 0, 1).valid, false);
  assert.equal(extractSynchronousPlanarPair([new Float32Array(3), new Float32Array(2)], 3, 0, 1).valid, false);
  assert.equal(extractSynchronousPlanarPair([new Float32Array(3), new Float32Array(3)], 3, 1, 1).valid, false);
});

test("estimates positive relative delay for broadband test signal", () => {
  const sampleRate = 48000;
  const reference = new Float32Array(12000);
  let state = 0x12345678;
  for (let i = 0; i < reference.length; i++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    reference[i] = ((state >>> 0) / 0xffffffff) * 2 - 1;
  }
  const expectedDelay = 37;
  const measurement = new Float32Array(reference.length);
  for (let i = expectedDelay; i < measurement.length; i++) measurement[i] = reference[i - expectedDelay];
  const result = estimateSynchronousRelativeDelay(reference, measurement, sampleRate, 10);
  assert.ok(result);
  assert.ok(Math.abs(result.delaySamples - expectedDelay) < 0.6);
  assert.ok(result.correlation > 0.9);
});

test("rejects silence and invalid delay limits", () => {
  assert.equal(estimateSynchronousRelativeDelay(new Float32Array(2048), new Float32Array(2048), 48000), null);
  assert.equal(estimateSynchronousRelativeDelay(new Float32Array(2048), new Float32Array(2048), 48000, 0), null);
  assert.equal(estimateSynchronousRelativeDelay(new Float32Array(2048), new Float32Array(2048), 6000), null);
});
