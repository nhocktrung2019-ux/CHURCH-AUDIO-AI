import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMultiZoneCoverage } from "../src/audio/multiZoneCoverage.ts";
const row=(id,zone,position,level,offset=0)=>({id,zone,position,xM:position.endsWith("A")?2:4,yM:3,levelDb:level,rawDbfs:-20,unit:"dB SPL",durationSeconds:10,sampleCount:480000,inputLabel:"Mic calibré",timestamp:1700000000,calibrationOffsetDb:offset});
test("multi-zone report computes matched coverage and relative SPL deltas",()=>{
 const result=analyzeMultiZoneCoverage([row(1,"Main L","Seat A",90),row(2,"Main L","Seat B",88),row(3,"Main R","Seat A",87),row(4,"Main R","Seat B",86)],"Main L");
 assert.equal(result.status,"ready"); assert.equal(result.commonPositionCount,2);
 assert.equal(result.overlapPercent,100); assert.equal(result.points[0].deltas["Main R"],-3);
});
test("repeated captures are energy-averaged and not counted as extra positions",()=>{
 const result=analyzeMultiZoneCoverage([row(1,"L","Seat A",90),row(2,"L","Seat A",90),row(3,"R","Seat A",90),row(4,"L","Seat B",88),row(5,"R","Seat B",88)]);
 assert.equal(result.summaries.find(x=>x.zone==="L").measuredPoints,2);
 assert.equal(result.unionPositionCount,2);
});
test("different input or calibration offsets block cross-zone comparison",()=>{
 assert.equal(analyzeMultiZoneCoverage([row(1,"L","A",90),{...row(2,"R","A",90),inputLabel:"Other"}]).status,"blocked");
 assert.equal(analyzeMultiZoneCoverage([row(1,"L","A",90),row(2,"R","A",90,2)]).status,"blocked");
});
test("legacy dBFS is excluded and one remaining zone is insufficient",()=>{
 assert.equal(analyzeMultiZoneCoverage([{...row(1,"L","A",90),unit:"dBFS"}]).status,"insufficient");
 assert.equal(analyzeMultiZoneCoverage([row(1,"L","A",90)]).status,"insufficient");
});
