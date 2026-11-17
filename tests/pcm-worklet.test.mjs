import test from "node:test";
import assert from "node:assert/strict";

function hasFrameGap(previousEndFrame, nextStartFrame) {
  return previousEndFrame !== null && nextStartFrame !== previousEndFrame;
}

test("PCM frame continuity accepts adjacent AudioWorklet blocks", () => {
  assert.equal(hasFrameGap(2048, 2048), false);
  assert.equal(hasFrameGap(4096, 4096), false);
});

test("PCM frame continuity detects dropped and out-of-order blocks", () => {
  assert.equal(hasFrameGap(2048, 4096), true);
  assert.equal(hasFrameGap(4096, 2048), true);
});

test("first PCM block has no prior frame to compare", () => {
  assert.equal(hasFrameGap(null, 0), false);
});
