import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCrossoverAlignment } from "../src/audio/crossoverAlignment.ts";

function response(phase, magnitude=0, coherence=.95) {
  return Array.from({length:17},(_,i)=>({
    frequencyHz:500+i*62.5,magnitudeDb:magnitude,phaseDeg:phase,coherence,
  }));
}

test("recognizes a coherent, level-matched crossover overlap",()=>{
  const result=analyzeCrossoverAlignment(response(0),response(12,1),1000);
  assert.equal(result.status,"good-overlap");
  assert.equal(result.absoluteDelayAvailable,false);
  assert.ok(result.matchedBins>=5);
  assert.ok(result.octaveCoverage>=.5);
});

test("flags likely polarity opposition without changing polarity",()=>{
  const result=analyzeCrossoverAlignment(response(0),response(178),1000);
  assert.equal(result.status,"review-polarity");
  assert.match(result.recommendation,/không tự đảo cực/);
});

test("flags level mismatch independently of phase",()=>{
  const result=analyzeCrossoverAlignment(response(0),response(0,8),1000);
  assert.equal(result.status,"review-level-balance");
});

test("rejects insufficient coherence and insufficient frequency coverage",()=>{
  assert.equal(analyzeCrossoverAlignment(response(0,0,.4),response(0,0,.4),1000).status,"insufficient-data");
  const narrow=Array.from({length:5},(_,i)=>({frequencyHz:990+i*2,magnitudeDb:0,phaseDeg:0,coherence:.99}));
  assert.equal(analyzeCrossoverAlignment(narrow,narrow,1000).status,"insufficient-data");
});

test("rejects invalid crossover values",()=>{
  assert.equal(analyzeCrossoverAlignment([],[],0).status,"insufficient-data");
  assert.equal(analyzeCrossoverAlignment([],[],1000,2).status,"insufficient-data");
});

test("does not infer absolute delay from sequential phase comparisons",()=>{
  const result=analyzeCrossoverAlignment(response(0),response(90),1000);
  assert.equal(result.absoluteDelayAvailable,false);
});
