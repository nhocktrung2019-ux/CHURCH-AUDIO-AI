import test from "node:test";
import assert from "node:assert/strict";
import { buildGeometricDelayPlan, buildSynchronousPhaseDelayReview, buildPhaseBandReview, buildCutOnlyEqReview } from "../src/audio/systemAlignmentReview.ts";
const speakers=[{id:1,name:"Main",zone:"Main",x:0,y:0,z:3},{id:2,name:"Fill",zone:"Fill",x:4,y:0,z:3}];
test("geometric delay aligns nearer speaker to farthest arrival at listener point",()=>{
 const p=buildGeometricDelayPlan(speakers,{x:0,y:0,z:0},343);
 assert.equal(p.status,"ready"); assert.equal(p.writeEnabled,false);
 assert.equal(p.rows.find(x=>x.speakerName==="Fill").delayMs,0);
 assert.ok(p.rows.find(x=>x.speakerName==="Main").delayMs>0);
});
test("geometric delay rejects missing geometry and invalid speed",()=>{
 assert.equal(buildGeometricDelayPlan(speakers.slice(0,1),{x:0,y:0,z:0}).status,"blocked");
 assert.equal(buildGeometricDelayPlan(speakers,{x:0,y:0,z:0},100).status,"blocked");
});
const evidence={simultaneousCapture:true,sharedHardwareClock:true,perChannelCalibration:true,latencyCharacterized:true};
const phasePoints=(delay=0)=>Array.from({length:30},(_,i)=>({frequencyHz:400+i*50,magnitudeDb:0,phaseDeg:20-360*(400+i*50)*delay/1000,coherence:.96}));
test("synchronous phase delay stays blocked when any evidence is absent",()=>{
 const captures=[{id:"a",zone:"A",role:"main",sampleRate:48000,points:phasePoints()},{id:"b",zone:"B",role:"fill",sampleRate:48000,points:phasePoints(2)}];
 assert.equal(buildSynchronousPhaseDelayReview(captures,{...evidence,sharedHardwareClock:false}).ready,false);
 assert.equal(buildSynchronousPhaseDelayReview(captures,evidence).ready,true);
});
test("phase band review detects near-opposite phase without changing polarity",()=>{
 const points=Array.from({length:9},(_,i)=>({frequencyHz:800+i*50,magnitudeDb:0,phaseDeg:0,coherence:.95}));
 const inverted=points.map(p=>({...p,phaseDeg:180}));
 assert.match(buildPhaseBandReview(points,inverted,1000).interpretation,/polarity/i);
});
test("cut-only EQ requires coherent bins and never emits boosts or DSP writes",()=>{
 const weak=buildCutOnlyEqReview(phasePoints().map(p=>({...p,coherence:.2})));
 assert.equal(weak.filters.length,0);
 const points=Array.from({length:100},(_,i)=>({frequencyHz:80*Math.pow(10000/80,i/99),magnitudeDb:0,coherence:.96}));
 const result=buildCutOnlyEqReview(points,"flat");
 assert.equal(result.writeEnabled,false);
 assert.ok(result.filters.every(f=>f.gainDb<=0 && f.gainDb>=-4));
});
