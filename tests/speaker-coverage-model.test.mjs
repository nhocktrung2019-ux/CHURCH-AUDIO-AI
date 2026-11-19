import test from "node:test";
import assert from "node:assert/strict";
import { getSpeakerCoverageStatus } from "../src/audio/speakerCoverageModel.ts";

const speaker = { x: 0, y: 0, z: 5, azimuth: 0, coverage: 90, verticalCoverage: 40 };

test("listener on the acoustic axis is inside horizontal and vertical coverage", () => {
  const result = getSpeakerCoverageStatus(speaker, { x: 8, y: 0, z: 5 });
  assert.equal(result.inCoverage, true);
  assert.equal(result.horizontalRatio, 0);
  assert.equal(result.verticalRatio, 0);
});

test("horizontal and vertical boundaries are evaluated independently", () => {
  const horizontalEdge = getSpeakerCoverageStatus(speaker, { x: 8, y: 8 * Math.tan(Math.PI / 4), z: 5 });
  assert.ok(Math.abs(horizontalEdge.horizontalRatio - 1) < 1e-9);
  assert.equal(horizontalEdge.inCoverage, true);

  const verticalOutside = getSpeakerCoverageStatus(speaker, { x: 8, y: 0, z: 8 });
  assert.ok(verticalOutside.verticalRatio > 1);
  assert.equal(verticalOutside.inCoverage, false);
});

test("azimuth wraps correctly around negative and positive 180 degrees", () => {
  const rotated = { ...speaker, azimuth: 179, coverage: 30 };
  const result = getSpeakerCoverageStatus(rotated, { x: -8, y: 0.14, z: 5 });
  assert.ok(Math.abs(result.horizontalAngle) < 2);
  assert.equal(result.inCoverage, true);
});

test("invalidly narrow and wide angles are bounded to a stable geometric range", () => {
  const narrow = getSpeakerCoverageStatus({ ...speaker, coverage: 0, verticalCoverage: 0 }, { x: 8, y: 0, z: 5 });
  assert.equal(narrow.inCoverage, true);
  const wide = getSpeakerCoverageStatus({ ...speaker, coverage: 360, verticalCoverage: 360 }, { x: 0, y: 8, z: 5 });
  assert.equal(wide.inCoverage, true);
});
