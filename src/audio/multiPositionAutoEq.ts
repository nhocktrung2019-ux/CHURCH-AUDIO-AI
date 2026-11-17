import { assessAutoEqReadiness, type AutoEqMeasurementPoint, type AutoEqReadiness } from "./autoEq.ts";
import type { TransferResult } from "./transfer";

export type MultiPositionAutoEqSample = {
  id: string;
  label: string;
  weight: number;
  savedAt: string;
  sameChainConfirmed: boolean;
  result: TransferResult;
};
export type MultiPositionAutoEqSummary = {
  positionCount: number;
  contributingBinCount: number;
  suppressedVariableBinCount: number;
  medianSpatialSpreadDb: number;
  maximumSpatialSpreadDb: number;
  minimumPositionCoverage: number;
  maximumAllowedSpreadDb: number;
};
export type MultiPositionAutoEqAnalysis = {
  ready: boolean;
  reason: string;
  points: AutoEqMeasurementPoint[];
  readiness: AutoEqReadiness;
  summary: MultiPositionAutoEqSummary;
  issues: string[];
};

const MIN_POSITIONS = 3;
const MAX_POSITIONS = 8;
const MIN_COVERAGE = 0.8;
const MAX_INTERPOLATION_GAP_OCTAVES = 0.25;
const MAX_SPREAD_DB = 8;
const MAX_OUTLIER_DISTANCE_DB = 4;

function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[mid] : ((sorted[mid-1] ?? 0)+(sorted[mid] ?? 0))/2;
}
function qualityValid(result: TransferResult): boolean {
  const q = result.captureQuality;
  return Boolean(q && Number.isFinite(q.rmsDbfs) && q.rmsDbfs >= -55
    && Number.isFinite(q.peakDbfs) && q.peakDbfs <= -0.5
    && Number.isFinite(q.clippedSamplePercent) && q.clippedSamplePercent <= 0.1
    && Number.isFinite(q.invalidSamplePercent) && q.invalidSamplePercent <= 0.01
    && Number.isFinite(q.sampleCount) && q.sampleCount > 0);
}
function usablePoints(points: AutoEqMeasurementPoint[]): AutoEqMeasurementPoint[] {
  return points.filter(p=>Number.isFinite(p.frequencyHz) && p.frequencyHz >= 80 && p.frequencyHz <= 10000
    && Number.isFinite(p.magnitudeDb) && Number.isFinite(p.coherence) && p.coherence >= 0.8 && p.coherence <= 1)
    .sort((a,b)=>a.frequencyHz-b.frequencyHz);
}

/** Require the operator to confirm that only the microphone position changes. */
export function assessMultiPositionAutoEq(samples: MultiPositionAutoEqSample[]): {ready:boolean;reason:string;issues:string[]} {
  const issues:string[]=[];
  if(samples.length<MIN_POSITIONS) issues.push(`Cần tối thiểu ${MIN_POSITIONS} vị trí đo hợp lệ; hiện có ${samples.length}.`);
  if(samples.length>MAX_POSITIONS) issues.push(`Tối đa ${MAX_POSITIONS} vị trí trong một bộ Auto EQ.`);
  const labels=samples.map(s=>s.label.trim().toLocaleLowerCase());
  if(new Set(labels).size!==labels.length) issues.push("Tên khu vực bị trùng; mỗi vị trí cần tên riêng.");
  samples.forEach((s,i)=>{
    const name=s.label.trim() || `Vị trí ${i+1}`;
    if(!s.sameChainConfirmed) issues.push(`${name}: chưa xác nhận giữ nguyên chuỗi đo và hệ thống loa.`);
    if(!Number.isFinite(s.weight)||s.weight<0.5||s.weight>2) issues.push(`${name}: trọng số phải từ 0,5 đến 2,0.`);
    if(s.result.captureMetadata?.analysisMode!=="mono-acoustic") issues.push(`${name}: chỉ nhận phép đo acoustic mono, không nhận loopback hai kênh.`);
    if(s.result.captureMetadata?.captureEngine!=="AudioWorklet") issues.push(`${name}: yêu cầu PCM AudioWorklet, không dùng ScriptProcessor dự phòng.`);
    if(!qualityValid(s.result)) issues.push(`${name}: PCM thiếu metadata hoặc mức/clipping chưa đạt.`);
    const readiness=assessAutoEqReadiness(s.result.points);
    if(!readiness.ready) issues.push(`${name}: ${readiness.reason}`);
    if(!Number.isFinite(s.result.sampleRate)||s.result.sampleRate<=0) issues.push(`${name}: sample rate không hợp lệ.`);
  });
  const rates=samples.map(s=>s.result.sampleRate).filter(Number.isFinite);
  if(rates.length===samples.length&&rates.length>1&&Math.max(...rates)-Math.min(...rates)>1)
    issues.push("Sample rate giữa các vị trí không đồng nhất; hãy đo lại cùng cấu hình thiết bị.");
  return {ready:issues.length===0&&samples.length>=MIN_POSITIONS&&samples.length<=MAX_POSITIONS,
    reason:issues[0]??"Đủ điều kiện tổng hợp đáp tuyến đa vị trí.",issues};
}

function interpolate(points:AutoEqMeasurementPoint[],frequency:number):{magnitudeDb:number;coherence:number}|null {
  let lo=0,hi=points.length-1;
  while(lo<=hi){
    const mid=(lo+hi)>>1,p=points[mid]; if(!p)return null;
    if(Math.abs(p.frequencyHz-frequency)<1e-6)return {magnitudeDb:p.magnitudeDb,coherence:p.coherence};
    if(p.frequencyHz<frequency)lo=mid+1;else hi=mid-1;
  }
  const a=points[hi],b=points[lo];
  if(!a||!b)return null;
  const span=Math.log2(b.frequencyHz/a.frequencyHz);
  if(!Number.isFinite(span)||span<=0||span>MAX_INTERPOLATION_GAP_OCTAVES)return null;
  const t=Math.log2(frequency/a.frequencyHz)/span;
  if(t<0||t>1)return null;
  return {magnitudeDb:a.magnitudeDb+(b.magnitudeDb-a.magnitudeDb)*t,coherence:Math.min(a.coherence,b.coherence)};
}

/** Weighted spatial mean with outlier limiting; highly inconsistent bins are omitted. */
export function aggregateMultiPositionAutoEq(samples:MultiPositionAutoEqSample[]):MultiPositionAutoEqAnalysis {
  const gate=assessMultiPositionAutoEq(samples);
  const empty=assessAutoEqReadiness([]);
  const emptySummary:MultiPositionAutoEqSummary={positionCount:samples.length,contributingBinCount:0,
    suppressedVariableBinCount:0,medianSpatialSpreadDb:0,maximumSpatialSpreadDb:0,
    minimumPositionCoverage:0,maximumAllowedSpreadDb:MAX_SPREAD_DB};
  if(!gate.ready)return {ready:false,reason:gate.reason,issues:gate.issues,points:[],readiness:empty,summary:emptySummary};

  const prepared=samples.map(s=>({sample:s,points:usablePoints(s.result.points)}));
  const anchor=[...prepared].sort((a,b)=>b.points.length-a.points.length)[0];
  if(!anchor)return {ready:false,reason:"Không có dữ liệu tần số chung.",issues:["Thiếu điểm đo."],points:[],readiness:empty,summary:emptySummary};
  const minCount=Math.max(MIN_POSITIONS,Math.ceil(samples.length*MIN_COVERAGE));
  const output:AutoEqMeasurementPoint[]=[];
  const spreads:number[]=[];
  let suppressed=0,minObserved=samples.length;

  for(const p of anchor.points){
    const values=prepared.flatMap(({sample,points})=>{
      const v=interpolate(points,p.frequencyHz);
      return v?[{...v,weight:sample.weight}]:[];
    });
    minObserved=Math.min(minObserved,values.length);
    if(values.length<minCount)continue;
    const levels=values.map(v=>v.magnitudeDb);
    const spread=Math.max(...levels)-Math.min(...levels);
    if(!Number.isFinite(spread))continue;
    if(spread>MAX_SPREAD_DB){suppressed++;continue;}
    const center=median(levels);
    let sum=0,coherence=0,totalWeight=0;
    for(const v of values){
      const bounded=Math.max(center-MAX_OUTLIER_DISTANCE_DB,Math.min(center+MAX_OUTLIER_DISTANCE_DB,v.magnitudeDb));
      sum+=bounded*v.weight; coherence+=v.coherence*v.weight; totalWeight+=v.weight;
    }
    if(totalWeight<=0)continue;
    output.push({frequencyHz:p.frequencyHz,magnitudeDb:sum/totalWeight,coherence:coherence/totalWeight});
    spreads.push(spread);
  }
  const readiness=assessAutoEqReadiness(output);
  const summary:MultiPositionAutoEqSummary={positionCount:samples.length,contributingBinCount:output.length,
    suppressedVariableBinCount:suppressed,medianSpatialSpreadDb:spreads.length?median(spreads):0,
    maximumSpatialSpreadDb:spreads.length?Math.max(...spreads):0,minimumPositionCoverage:minObserved,
    maximumAllowedSpreadDb:MAX_SPREAD_DB};
  const ready=readiness.ready;
  const reason=ready
    ? `Đã tổng hợp ${samples.length} vị trí, ${output.length} bin; loại ${suppressed} bin có biến thiên không gian trên ${MAX_SPREAD_DB} dB.`
    : `Đáp tuyến tổng hợp chưa đủ điều kiện Auto EQ: ${readiness.reason}`;
  return {ready,reason,issues:ready?[]:[reason],points:output,readiness,summary};
}
