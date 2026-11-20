import test from "node:test";
import assert from "node:assert/strict";
import { concatenatePcmChunks } from "../src/audio/pcmCapture.ts";

test("joins PCM callback blocks without changing sample order", () => {
  const result = concatenatePcmChunks([
    Float32Array.from([0.1, 0.2]),
    Float32Array.from([0.3]),
    Float32Array.from([-0.4, -0.5]),
  ]);
  const expected = [0.1, 0.2, 0.3, -0.4, -0.5];
  assert.equal(result.length, expected.length);
  result.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-6));
});

test("caps PCM capture to the requested sample count", () => {
  const result = concatenatePcmChunks([
    Float32Array.from([1, 2, 3]),
    Float32Array.from([4, 5]),
  ], 4);
  assert.deepEqual(Array.from(result), [1, 2, 3, 4]);
});

test("returns an independent buffer and accepts empty capture", () => {
  const source = Float32Array.from([1, 2]);
  const result = concatenatePcmChunks([source]);
  source[0] = 99;
  assert.deepEqual(Array.from(result), [1, 2]);
  assert.equal(concatenatePcmChunks([]).length, 0);
});

test("rejects malformed chunks and invalid sample caps", () => {
  assert.throws(() => concatenatePcmChunks([new Float32Array(2), new Float64Array(2)]));
  assert.throws(() => concatenatePcmChunks([], -1));
  assert.throws(() => concatenatePcmChunks([], 1.5));
});
