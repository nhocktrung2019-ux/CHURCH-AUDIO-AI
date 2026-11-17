import test from "node:test";
import assert from "node:assert/strict";
import { countPcmFrameDiscontinuity } from "../src/audio/pcmCapture.ts";

test("PCM frame continuity accepts adjacent AudioWorklet blocks", () => {
  assert.equal(countPcmFrameDiscontinuity(2048, 2048, 2048), 0);
  assert.equal(countPcmFrameDiscontinuity(4096, 4096, 2048), 0);
});

test("PCM frame continuity detects dropped and out-of-order blocks", () => {
  assert.equal(countPcmFrameDiscontinuity(2048, 4096, 2048), 1);
  assert.equal(countPcmFrameDiscontinuity(4096, 2048, 2048), 1);
  assert.equal(countPcmFrameDiscontinuity(2048, 8192, 2048), 3);
});

test("invalid frame metadata fails closed", () => {
  assert.equal(countPcmFrameDiscontinuity(Number.NaN, 0, 2048), 1);
  assert.equal(countPcmFrameDiscontinuity(0, 1, 0), 1);
});
