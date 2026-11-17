import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePolarBeamwidth,
  getPolarOnAxisLevel,
  normalizePolarCurve,
  parsePolarCsv,
} from "../src/audio/polarData.ts";

test("parses comma-delimited manufacturer polar CSV and sorts its samples", () => {
  const points = parsePolarCsv([
    "frequency_hz,plane,angle_deg,level_db",
    "1000,V,30,-3",
    "1000,V,-30,-3",
    "1000,V,0,0",
  ].join("\n"));
  assert.equal(points.length, 3);
  assert.deepEqual(points.map(point => point.angleDeg), [-30, 0, 30]);
});

test("parses semicolon CSV with decimal comma and quoted fields", () => {
  const points = parsePolarCsv([
    "frequency_hz;plane;angle_deg;level_db",
    '1000;"Vertical";-30;-3,5',
    '1000;"V";0;0,0',
    '1000;"V";30;-3,5',
  ].join("\n"));
  assert.equal(points[0].levelDb, -3.5);
  assert.equal(points[0].plane, "V");
});

test("rejects ambiguous duplicate frequency-plane-angle samples", () => {
  assert.throws(() => parsePolarCsv([
    "frequency_hz,plane,angle_deg,level_db",
    "1000,V,-30,-3",
    "1000,V,-30,-4",
    "1000,V,0,0",
  ].join("\n")), /trùng mẫu/);
});

test("rejects malformed, out-of-range and unsupported plane rows rather than skipping them", () => {
  const header = "frequency_hz,plane,angle_deg,level_db";
  assert.throws(() => parsePolarCsv([header, "1000,V,-30,-3", "1000,V,0,0", "abc,V,30,-3"].join("\n")), /không phải số/);
  assert.throws(() => parsePolarCsv([header, "1000,V,-190,-3", "1000,V,0,0", "1000,V,30,-3"].join("\n")), /−180°/);
  assert.throws(() => parsePolarCsv([header, "1000,X,-30,-3", "1000,V,0,0", "1000,V,30,-3"].join("\n")), /plane chỉ nhận/);
});

test("normalizes from the measured 0-degree value when present", () => {
  const points = [
    { frequencyHz: 1000, plane: "V", angleDeg: -30, levelDb: -6 },
    { frequencyHz: 1000, plane: "V", angleDeg: 0, levelDb: 0 },
    { frequencyHz: 1000, plane: "V", angleDeg: 30, levelDb: -6 },
  ];
  assert.equal(getPolarOnAxisLevel(points), 0);
  const normalized = normalizePolarCurve(points);
  assert.ok(normalized);
  assert.deepEqual(normalized.map(point => point.relativeDb), [-6, 0, -6]);
  assert.equal(normalized[0].onAxisLevelDb, 0);
});

test("interpolates the true on-axis level only when measurements exist on both sides", () => {
  const twoSided = [
    { frequencyHz: 1000, plane: "V", angleDeg: -30, levelDb: -4 },
    { frequencyHz: 1000, plane: "V", angleDeg: 30, levelDb: -2 },
    { frequencyHz: 1000, plane: "V", angleDeg: 90, levelDb: -20 },
  ];
  assert.equal(getPolarOnAxisLevel(twoSided), -3);
  assert.ok(normalizePolarCurve(twoSided));
  const oneSided = [twoSided[1], twoSided[2]];
  assert.equal(getPolarOnAxisLevel(oneSided), null);
  assert.equal(normalizePolarCurve(oneSided), null);
});

test("calculates the -6 dB beamwidth by interpolating both measured edge crossings", () => {
  const points = [
    { frequencyHz: 1000, plane: "V", angleDeg: -90, levelDb: -20 },
    { frequencyHz: 1000, plane: "V", angleDeg: -30, levelDb: -3 },
    { frequencyHz: 1000, plane: "V", angleDeg: 30, levelDb: -3 },
    { frequencyHz: 1000, plane: "V", angleDeg: 90, levelDb: -20 },
  ];
  const normalized = normalizePolarCurve(points);
  assert.ok(normalized);
  const beamwidth = calculatePolarBeamwidth(normalized);
  assert.ok(beamwidth);
  assert.ok(beamwidth.left !== null && beamwidth.left < 0);
  assert.ok(beamwidth.right !== null && beamwidth.right > 0);
  assert.ok(beamwidth.width !== null && beamwidth.width > 100 && beamwidth.width < 105);
  assert.equal(beamwidth.onAxisLevelDb, -3);
});

test("does not invent a beam edge when measured data never crosses the threshold", () => {
  const points = [
    { frequencyHz: 1000, plane: "V", angleDeg: -30, levelDb: 0 },
    { frequencyHz: 1000, plane: "V", angleDeg: 0, levelDb: 0 },
    { frequencyHz: 1000, plane: "V", angleDeg: 30, levelDb: -2 },
  ];
  const normalized = normalizePolarCurve(points);
  assert.ok(normalized);
  const beamwidth = calculatePolarBeamwidth(normalized);
  assert.ok(beamwidth);
  assert.equal(beamwidth.left, null);
  assert.equal(beamwidth.right, null);
  assert.equal(beamwidth.width, null);
});
