import test from "node:test";
import assert from "node:assert/strict";
import { buildMeasurementReport, measurementReportCsv } from "../src/audio/measurementReport.ts";

const base={
 appVersion:"0.30.0-beta.1",
 project:{name:"Test church",site:"Hall A",operator:"Tech",notes:""},
 zoneStorage:JSON.stringify([{id:1,name:"Zone 1",splDb:86.5,note:"seat row 1"},{id:2,name:"Zone 2",splDb:null,note:""}]),
 rt60Storage:JSON.stringify({capturedAt:"2026-11-19T10:00:00.000Z",zone:"Main",position:"Center",inputSelection:"selected-input",sweepDurationSeconds:6,tailSeconds:4,result:{sampleRate:48000,quality:"good",peakToNoiseDb:32,recommendedRt60:1.4,bands:[{centerHz:1000,rt20Seconds:1.2,rt30Seconds:1.4,rt60Seconds:1.4,fitR2:.98,fitRangeDb:30}]}}),
 transferStorage:JSON.stringify({sampleRate:48000,points:[{frequencyHz:1000,magnitudeDb:-2,phaseDeg:12,coherence:.95}]}),
 offsetStorage:"94",
 micCalibrationStorage:JSON.stringify({name:"Mic correction",points:[{frequencyHz:50,correctionDb:1},{frequencyHz:1000,correctionDb:0},{frequencyHz:10000,correctionDb:-1}]}),
 roomStorage:{length:28,width:16,height:7},
};
test("report separates manual SPL entries from calibrated measurements",()=>{
 const report=buildMeasurementReport(base);
 assert.equal(report.integrity.measuredSPLZoneEntries,0);
 assert.equal(report.integrity.unverifiedManualSPLZoneEntries,1);
 assert.equal(report.zoneEntries[0].status,"manual-unverified");
 assert.equal(report.integrity.dBfsConvertedToSpl,false);
});
test("report includes RT60 and relative transfer without inventing missing values",()=>{
 const report=buildMeasurementReport(base);
 assert.equal(report.rt60?.recommendedRt60,1.4);
 assert.equal(report.rt60?.microphoneCorrectionApplied,false);
 assert.equal(report.transferResponse?.status,"relative-response-not-absolute-spl");
 assert.equal(report.transferResponse?.points[0].magnitudeDb,-2);
});
test("malformed storage is safely excluded",()=>{
 const report=buildMeasurementReport({...base,zoneStorage:"{bad",rt60Storage:"[]",transferStorage:"null"});
 assert.equal(report.zoneEntries.length,0);
 assert.equal(report.rt60,null);
 assert.equal(report.transferResponse,null);
});
test("CSV is UTF-8 BOM prefixed and marks manual zone entries unverified",()=>{
 const csv=measurementReportCsv(buildMeasurementReport(base));
 assert.ok(csv.startsWith("\uFEFF"));
 assert.match(csv,/manual-unverified/);
 assert.match(csv,/relative magnitude/); 
});

test("empty project data remains empty and never becomes a fabricated measurement",()=>{
 const report=buildMeasurementReport({
  ...base,
  zoneStorage:JSON.stringify([{id:1,name:"Unmeasured",splDb:null,note:""}]),
  rt60Storage:null,
  transferStorage:null,
  offsetStorage:null,
  micCalibrationStorage:null,
  roomStorage:{length:null,width:null,height:null},
 });
 assert.equal(report.integrity.measuredSPLZoneEntries,0);
 assert.equal(report.integrity.unverifiedManualSPLZoneEntries,0);
 assert.equal(report.rt60,null);
 assert.equal(report.transferResponse,null);
 assert.deepEqual(report.room,{lengthM:null,widthM:null,heightM:null});
});
test("invalid manual SPL values are excluded instead of clamped",()=>{
 const report=buildMeasurementReport({...base,zoneStorage:JSON.stringify([
  {id:1,name:"Bad high",splDb:240,note:"invalid"},
  {id:2,name:"Valid entered",splDb:83,note:"manual"},
 ])});
 assert.equal(report.zoneEntries.length,1);
 assert.equal(report.zoneEntries[0].name,"Valid entered");
 assert.equal(report.zoneEntries[0].status,"manual-unverified");
});
