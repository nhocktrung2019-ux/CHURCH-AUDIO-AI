import test from "node:test";
import assert from "node:assert/strict";
import { buildAcousticAssistantFindings, compareMeasuredToSimulation, estimatePropagationAt, simulateSoundField } from "../src/audio/soundPropagation.ts";

const speakers=[{id:1,name:"Main",model:"CBT",zone:"Main",x:2,y:2,z:1.2,azimuth:0,coverage:90,verticalCoverage:180}];
const config={lengthM:20,widthM:10,earHeightM:1.2,referenceSplAt1m:90,columns:9,rows:5};
const record=(overrides={})=>({id:1,zone:"Main",position:"P1",xM:8,yM:2,levelDb:70,rawDbfs:-20,unit:"dB SPL",durationSeconds:2,sampleCount:100,inputLabel:"USB mic",timestamp:1,calibrationOffsetDb:100,...overrides});

test("propagation simulation returns a bounded grid and read-only status",()=>{
 const result=simulateSoundField(speakers,config);
 assert.equal(result.status,"ready"); assert.equal(result.cells.length,45); assert.equal(result.writeEnabled,false);
 assert.ok(result.maxDb>=result.minDb);
});
test("free-field estimate falls with distance on axis",()=>{
 const near=estimatePropagationAt(speakers,3,2,1.2,90);
 const far=estimatePropagationAt(speakers,13,2,1.2,90);
 assert.ok(near>far);
});
test("invalid room and missing speaker coordinates are blocked",()=>{
 assert.equal(simulateSoundField(speakers,{...config,lengthM:0}).status,"blocked");
 assert.equal(simulateSoundField([{...speakers[0],x:Number.NaN}],config).status,"blocked");
});
test("measurement comparison requires calibrated SPL coordinates and consistent input",()=>{
 const ok=compareMeasuredToSimulation([record()],speakers,config);
 assert.equal(ok.status,"ready"); assert.equal(ok.rows.length,1);
 assert.equal(compareMeasuredToSimulation([record({xM:undefined})],speakers,config).status,"blocked");
 assert.equal(compareMeasuredToSimulation([record(),record({id:2,inputLabel:"Other"})],speakers,config).status,"blocked");
 assert.equal(compareMeasuredToSimulation([record({unit:"dBFS"})],speakers,config).status,"blocked");
});
test("assistant findings are explainable and do not emit writes",()=>{
 const result=compareMeasuredToSimulation([record({levelDb:40})],speakers,config);
 const findings=buildAcousticAssistantFindings(result);
 assert.ok(findings.length>0); assert.match(findings[0].action,/Kiểm tra|Đo/);
});
