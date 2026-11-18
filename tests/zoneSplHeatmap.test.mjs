import test from "node:test";
import assert from "node:assert/strict";
import { buildZoneSplHeatmap } from "../src/audio/zoneSplHeatmap.ts";
const point = (id, xM, yM, levelDb, extra = {}) => ({
  id, zone: "Khu 1", position: "P" + id, xM, yM, levelDb,
  unit: "dBFS", inputLabel: "USB mic", durationSeconds: 10, ...extra,
});
test("builds a bounded heatmap from measured positions", () => {
  const result = buildZoneSplHeatmap([point(1,1,1,80),point(2,8,1,82),point(3,1,6,84)],
    "Khu 1", {roomLengthM:10,roomWidthM:8,gridColumns:4,gridRows:3,interpolationRadiusM:20});
  assert.equal(result.cells.length,12);
  assert.equal(result.measuredPositionCount,3);
  assert.ok(result.cells.some(cell => cell.confidence === "interpolated"));
});
test("does not extrapolate beyond interpolation radius", () => {
  const result = buildZoneSplHeatmap([point(1,.5,.5,80),point(2,1,.5,81),point(3,.5,1,82)],
    "Khu 1", {roomLengthM:20,roomWidthM:10,gridColumns:4,gridRows:2,interpolationRadiusM:1});
  assert.ok(result.cells.some(cell => cell.confidence === "outside-radius"));
});
test("rejects mixed input identities and units", () => {
  assert.equal(buildZoneSplHeatmap([point(1,1,1,80),point(2,2,1,81,{inputLabel:"Phone mic"}),point(3,1,2,82)],
    "Khu 1", {roomLengthM:10,roomWidthM:8}),null);
  assert.equal(buildZoneSplHeatmap([point(1,1,1,80),point(2,2,1,81,{unit:"dB SPL"}),point(3,1,2,82)],
    "Khu 1", {roomLengthM:10,roomWidthM:8}),null);
});
test("dB SPL requires a consistent calibration offset", () => {
  const calibrated=(id,x,y,level,offset)=>point(id,x,y,level,{unit:"dB SPL",calibrationOffsetDb:offset});
  assert.equal(buildZoneSplHeatmap([calibrated(1,1,1,80,93),calibrated(2,2,1,81,94),calibrated(3,1,2,82,93)],
    "Khu 1", {roomLengthM:10,roomWidthM:8}),null);
});
test("repeated captures at one named coordinate aggregate to one position", () => {
  const result=buildZoneSplHeatmap([
    point(1,2,2,80,{position:"Ghế A"}),point(2,2,2,80,{position:"Ghế A"}),
    point(3,8,2,82,{position:"Ghế B"}),point(4,2,6,84,{position:"Ghế C"})],
    "Khu 1",{roomLengthM:10,roomWidthM:8,gridColumns:5,gridRows:4,interpolationRadiusM:20});
  assert.equal(result.measuredPositionCount,3);
});
test("invalid geometry and unknown zones fail closed", () => {
  assert.equal(buildZoneSplHeatmap([point(1,1,1,80)],"Khu 1",{roomLengthM:0,roomWidthM:8}),null);
  assert.equal(buildZoneSplHeatmap([point(1,1,1,80)],"Khu 9",{roomLengthM:10,roomWidthM:8}),null);
});
