import test from "node:test";
import assert from "node:assert/strict";
import { buildArrivalAlignment, speedOfSoundAtTemperature } from "../src/audio/arrivalAlignmentModel.ts";

const speakers=[
 {id:1,name:"Main L",zone:"Main",x:0,y:0,z:5},
 {id:2,name:"Delay",zone:"Delay",x:10,y:0,z:5},
];

test("computes speed of sound with bounded temperature input",()=>{
 assert.ok(Math.abs(speedOfSoundAtTemperature(20)-343.42)<1e-9);
 assert.ok(speedOfSoundAtTemperature(100)===speedOfSoundAtTemperature(50));
});

test("delays earlier arrivals to align with latest arrival at the reference point",()=>{
 const result=buildArrivalAlignment(speakers,{x:20,y:0,z:1.2},20);
 assert.ok(result);
 assert.equal(result.alignments.length,2);
 const main=result.alignments.find(x=>x.speakerId===1);
 const delay=result.alignments.find(x=>x.speakerId===2);
 assert.ok(main && delay);
 assert.ok(main.suggestedDelayMs>delay.suggestedDelayMs);
 assert.equal(delay.suggestedDelayMs,0);
});

test("creates bounded arrival map cells and rejects invalid input",()=>{
 const result=buildArrivalAlignment(speakers,{x:20,y:8,z:1.2},20,{cols:5,rows:3,roomLength:28,roomWidth:16});
 assert.equal(result?.map.length,15);
 assert.equal(buildArrivalAlignment([], {x:1,y:1,z:1}),null);
 assert.equal(buildArrivalAlignment(speakers,{x:NaN,y:0,z:1}),null);
});

test("does not mutate speaker positions or settings",()=>{
 const before=JSON.stringify(speakers);
 buildArrivalAlignment(speakers,{x:20,y:8,z:1.2});
 assert.equal(JSON.stringify(speakers),before);
});
