import test from "node:test";
import assert from "node:assert/strict";
import { calculateGeometricDelayRecommendations, buildSurveyReport } from "../src/audio/zoneSPLWorkflow.ts";

test("geometric delay recommendations use the farthest speaker as zero reference", () => {
  const result = calculateGeometricDelayRecommendations([
    {id:1,name:"Front",zone:"Khu 1",x:0,y:0,z:4},
    {id:2,name:"Rear",zone:"Khu 2",x:10,y:0,z:4},
  ], {x:5,y:0,earHeightM:1.2}, 343);
  assert.equal(result.length,2);
  assert.ok(result.every(row => row.relativeDelayMs >= 0));
  assert.ok(Math.abs(result[0].relativeDelayMs-result[1].relativeDelayMs)<1e-9);
});

test("invalid sound speed or empty speaker list returns null", () => {
  assert.equal(calculateGeometricDelayRecommendations([], {x:0,y:0}),null);
  assert.equal(calculateGeometricDelayRecommendations([{id:1,name:"A",zone:"Z",x:0,y:0,z:2}], {x:0,y:0}, 500),null);
});

test("survey report explicitly excludes simulated values and DSP writes", () => {
  const report=buildSurveyReport([{id:1,zone:"Khu 1",position:"Ghế A",levelDb:-20,unit:"dBFS",timestamp:1,inputLabel:"USB"}],
    {roomLengthM:20,roomWidthM:10,roomHeightM:6},"2026-11-18T00:00:00.000Z");
  assert.equal(report.measurementIntegrity.measuredValuesOnly,true);
  assert.equal(report.measurementIntegrity.simulatedValuesIncluded,false);
  assert.equal(report.measurementIntegrity.dBFSIsSPL,false);
  assert.equal(report.measurementIntegrity.dspWritesPerformed,false);
  assert.equal(report.measurements.length,1);
});
