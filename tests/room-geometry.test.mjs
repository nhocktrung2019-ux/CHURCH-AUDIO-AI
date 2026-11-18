import test from "node:test";
import assert from "node:assert/strict";
import {
  clampRoomObject,
  clampRoomPoint,
  classifySpeakerCabinet,
  rotatedHalfExtents,
} from "../src/audio/roomGeometry.ts";

test("keeps rotated furniture inside the room after a resize", () => {
  const original = {
    id: 7, kind: "altar", x: 9.8, y: 7.8, w: 4, d: 2, h: 8, rotation: 45,
  };
  const fitted = clampRoomObject(original, 10, 8, 5);
  const extents = rotatedHalfExtents(fitted.w, fitted.d, fitted.rotation);

  assert.ok(fitted.x - extents.x >= -1e-9);
  assert.ok(fitted.x + extents.x <= 10 + 1e-9);
  assert.ok(fitted.y - extents.y >= -1e-9);
  assert.ok(fitted.y + extents.y <= 8 + 1e-9);
  assert.equal(fitted.h, 5);
});

test("shrinks over-sized furniture to fit a small room", () => {
  const fitted = clampRoomObject(
    { x: 1, y: 1, w: 8, d: 8, h: 2, rotation: 45 },
    2,
    2,
    3,
  );
  const extents = rotatedHalfExtents(fitted.w, fitted.d, fitted.rotation);
  assert.ok(fitted.w <= 2);
  assert.ok(fitted.d <= 2);
  assert.ok(extents.x <= 1 + 1e-9);
  assert.ok(extents.y <= 1 + 1e-9);
});

test("clamps room points using an object's edge clearance", () => {
  assert.deepEqual(clampRoomPoint(-4, 30, 12, 8, 0.5, 1), { x: 0.5, y: 7 });
});

test("recognizes column speakers without misclassifying JBL SRX tops as subs", () => {
  assert.equal(classifySpeakerCabinet("JBL CBT 70J-1"), "column");
  assert.equal(classifySpeakerCabinet("Bose MA12"), "column");
  assert.equal(classifySpeakerCabinet("JBL SRX815P"), "standard");
  assert.equal(classifySpeakerCabinet("JBL SRX818SP"), "sub");
  assert.equal(classifySpeakerCabinet("Generic 18-inch subwoofer"), "sub");
});


test("keeps speaker cabinet footprint and height inside resized room", async () => {
  const { clampRoomSpeaker, speakerCabinetDimensions } = await import("../src/audio/roomGeometry.ts");
  const fitted = clampRoomSpeaker(
    { id: 3, model: "JBL CBT 70J-1", x: 0, y: 0, z: 9 },
    12,
    8,
    4,
  );
  const dimensions = speakerCabinetDimensions(fitted.model);
  assert.ok(fitted.x >= dimensions.width / 2);
  assert.ok(fitted.y >= dimensions.depth / 2);
  assert.ok(fitted.z + dimensions.height / 2 <= 4 + 1e-9);
});
