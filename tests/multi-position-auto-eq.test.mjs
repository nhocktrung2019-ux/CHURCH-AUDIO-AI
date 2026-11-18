import test from "node:test";
import assert from "node:assert/strict";
import { assessMultiPositionAutoEq, aggregateMultiPositionAutoEq } from "../src/audio/multiPositionAutoEq.ts";

function response(offset=0){
 const points=[];
 for(let f=100;f<=8000;f+=25){const oct=Math.log2(f/1000);const peak=8*Math.exp(-0.5*(oct/0.11)**2);points.push({frequencyHz:f,magnitudeDb:peak+offset,coherence:0.96});}
 return points;
}
function sample(label,offset=0,weight=1,meta={}){
 return {id:label,label,weight,savedAt:"2026-11-17T00:00:00.000Z",sameChainConfirmed:true,result:{
  points:response(offset),estimatedDelayMs:12,confidence:0.95,averageCoherence:0.96,reliableBandPercent:100,
  sampleRate:48000,framesAveraged:16,analysisMode:"mono-acoustic",
  captureQuality:{peakDbfs:-8,rmsDbfs:-25,clippedSamplePercent:0,invalidSamplePercent:0,sampleCount:240000},
  captureMetadata:{captureEngine:"AudioWorklet",inputChannelCount:1,pcmChannelCount:1,channelMix:"direct-mono",trackChannelCount:1,trackSampleRate:48000,analysisMode:"mono-acoustic"},
  ...meta,
 },repeatability:{passed:true,captureCount:3,includedBinCount:300,unstableBinCount:0,insufficientCoverageBinCount:0,medianSpreadDb:0.6,maximumSpreadDb:1,maximumAllowedSpreadDb:3}};
}
test("requires at least three different listening positions",()=>{
 const check=assessMultiPositionAutoEq([sample("A"),sample("B")]);
 assert.equal(check.ready,false);assert.match(check.reason,/tối thiểu 3 vị trí/);
});
test("weighted mean combines three clean coherent positions",()=>{
 const a=aggregateMultiPositionAutoEq([sample("Trái",0,1),sample("Giữa",2,1),sample("Phải",4,2)]);
 assert.equal(a.ready,true);assert.equal(a.summary.positionCount,3);assert.ok(a.points.length>=24);
 const peak=a.points.find(p=>Math.abs(p.frequencyHz-1000)<30);
 assert.ok(peak);assert.ok(peak.magnitudeDb>9&&peak.magnitudeDb<12);
 assert.ok(a.summary.medianSpatialSpreadDb<=4.1);
});
test("rejects non-AudioWorklet capture chain",()=>{
 const bad=sample("B",0,1,{captureMetadata:{captureEngine:"ScriptProcessor fallback",analysisMode:"mono-acoustic"}});
 const a=aggregateMultiPositionAutoEq([sample("A"),bad,sample("C")]);
 assert.equal(a.ready,false);assert.ok(a.issues.some(x=>x.includes("AudioWorklet")));
});
test("omits bins with excessive spatial variability",()=>{
 const a=aggregateMultiPositionAutoEq([sample("A",0),sample("B",1),sample("C",15)]);
 assert.equal(a.ready,false);assert.ok(a.summary.suppressedVariableBinCount>0);
});
test("requires operator confirmation of unchanged signal chain",()=>{
 const a=assessMultiPositionAutoEq([sample("A"),sample("B"),{...sample("C"),sameChainConfirmed:false}]);
 assert.equal(a.ready,false);assert.ok(a.issues.some(x=>x.includes("chưa xác nhận giữ nguyên")));
});


test("reports frequency bins suppressed by spatial variation",()=>{
 const result=aggregateMultiPositionAutoEq([sample("A",0),sample("B",1),sample("C",15)]);
 const rejected=result.diagnostics.filter(d=>d.status==="spatial-variance");
 assert.ok(rejected.length>0);
 assert.ok(rejected.every(d=>d.spreadDb!==null&&d.spreadDb>8));
 assert.equal(result.summary.suppressedVariableBinCount,rejected.length);
});

test("reports bins that do not meet the minimum position coverage",()=>{
 const reduced=sample("C");
 reduced.result.points=reduced.result.points.filter(p=>p.frequencyHz<700||p.frequencyHz>1400);
 const result=aggregateMultiPositionAutoEq([sample("A"),sample("B"),reduced]);
 const missing=result.diagnostics.filter(d=>d.status==="insufficient-coverage");
 assert.ok(missing.length>0);
 assert.ok(missing.every(d=>d.coverageCount<3&&d.spreadDb===null));
 assert.equal(result.summary.insufficientCoverageBinCount,missing.length);
});

test("rejects legacy positions without repeatability evidence",()=>{
 const legacy={...sample("B")};delete legacy.repeatability;
 const result=assessMultiPositionAutoEq([sample("A"),legacy,sample("C")]);
 assert.equal(result.ready,false);
 assert.ok(result.issues.some(issue=>issue.includes("cần đo lặp tối thiểu 3 lần")));
});
