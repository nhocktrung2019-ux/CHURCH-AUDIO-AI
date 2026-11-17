import { assessAutoEqReadiness } from "./autoEq.ts";
import type { TransferPoint, TransferResult } from "./transfer.ts";
export type MeasurementRepeatabilityStatus = "included" | "unstable" | "insufficient-coverage";
export type MeasurementRepeatabilityDiagnostic = { frequencyHz:number; captureCount:number; spreadDb:number|null; standardDeviationDb:number|null; status:MeasurementRepeatabilityStatus };
export type MeasurementRepeatabilitySummary = { passed:boolean; captureCount:number; includedBinCount:number; unstableBinCount:number; insufficientCoverageBinCount:number; medianSpreadDb:number; maximumSpreadDb:number; maximumAllowedSpreadDb:number };
export type MeasurementRepeatabilityAnalysis = { ready:boolean; reason:string; issues:string[]; result:TransferResult|null; summary:MeasurementRepeatabilitySummary; diagnostics:MeasurementRepeatabilityDiagnostic[] };
const MIN_CAPTURES=3, MAX_CAPTURES=5, MIN_COVERAGE=0.8, MAX_GAP_OCTAVES=0.25, MAX_SPREAD_DB=3;
function median(values:number[]):number { if(!values.length)return 0; const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2); return sorted.length%2?sorted[mid]??0:((sorted[mid-1]??0)+(sorted[mid]??0))/2; }
function validCapture(result:TransferResult):boolean {
 const q=result.captureQuality;
 return Boolean(result.captureMetadata?.analysisMode==="mono-acoustic"&&result.captureMetadata?.captureEngine==="AudioWorklet"
  &&q&&Number.isFinite(q.rmsDbfs)&&q.rmsDbfs>=-55&&Number.isFinite(q.peakDbfs)&&q.peakDbfs<=-0.5
  &&Number.isFinite(q.clippedSamplePercent)&&q.clippedSamplePercent<=0.1&&Number.isFinite(q.invalidSamplePercent)&&q.invalidSamplePercent<=0.01
  &&Number.isFinite(q.sampleCount)&&q.sampleCount>0&&Number.isFinite(result.sampleRate)&&result.sampleRate>0&&assessAutoEqReadiness(result.points).ready);
}
function usable(points:TransferPoint[]):TransferPoint[] { return points.filter(p=>Number.isFinite(p.frequencyHz)&&p.frequencyHz>=80&&p.frequencyHz<=10000&&Number.isFinite(p.magnitudeDb)&&Number.isFinite(p.phaseDeg)&&Number.isFinite(p.coherence)&&p.coherence>=0.8&&p.coherence<=1).sort((a,b)=>a.frequencyHz-b.frequencyHz); }
function interpolate(points:TransferPoint[],frequencyHz:number):TransferPoint|null {
 let lo=0,hi=points.length-1; while(lo<=hi){const mid=(lo+hi)>>1,p=points[mid];if(!p)return null;if(Math.abs(p.frequencyHz-frequencyHz)<1e-6)return p;if(p.frequencyHz<frequencyHz)lo=mid+1;else hi=mid-1;}
 const a=points[hi],b=points[lo];if(!a||!b)return null;const span=Math.log2(b.frequencyHz/a.frequencyHz);if(!Number.isFinite(span)||span<=0||span>MAX_GAP_OCTAVES)return null;
 const t=Math.log2(frequencyHz/a.frequencyHz)/span;if(t<0||t>1)return null;const delta=((b.phaseDeg-a.phaseDeg+540)%360)-180;
 return {frequencyHz,magnitudeDb:a.magnitudeDb+(b.magnitudeDb-a.magnitudeDb)*t,phaseDeg:((a.phaseDeg+delta*t+540)%360)-180,coherence:Math.min(a.coherence,b.coherence)};
}
function circularMean(phases:number[]):number { const radians=phases.map(v=>v*Math.PI/180),x=radians.reduce((s,v)=>s+Math.cos(v),0),y=radians.reduce((s,v)=>s+Math.sin(v),0);return ((Math.atan2(y,x)*180/Math.PI+540)%360)-180; }
function emptySummary(count:number):MeasurementRepeatabilitySummary { return {passed:false,captureCount:count,includedBinCount:0,unstableBinCount:0,insufficientCoverageBinCount:0,medianSpreadDb:0,maximumSpreadDb:0,maximumAllowedSpreadDb:MAX_SPREAD_DB}; }
/** Fixed-position repeatability gate; not absolute phase, SPL calibration or room certification. */
export function analyzeMeasurementRepeatability(captures:TransferResult[]):MeasurementRepeatabilityAnalysis {
 const issues:string[]=[];if(captures.length<MIN_CAPTURES)issues.push(`Cần tối thiểu ${MIN_CAPTURES} lần đo lặp tại cùng vị trí; hiện có ${captures.length}.`);
 if(captures.length>MAX_CAPTURES)issues.push(`Mỗi vị trí chỉ nhận tối đa ${MAX_CAPTURES} lần đo lặp.`);
 captures.forEach((c,i)=>{if(!validCapture(c))issues.push(`Lần đo ${i+1}: cần PCM AudioWorklet mono sạch, coherence đạt và headroom hợp lệ.`);});
 const rates=captures.map(c=>c.sampleRate).filter(Number.isFinite);
 if(rates.length===captures.length&&rates.length>1&&Math.max(...rates)-Math.min(...rates)>1)issues.push("Sample rate giữa các lần đo không đồng nhất; hãy giữ nguyên interface và cấu hình.");
 const empty=emptySummary(captures.length);if(issues.length)return {ready:false,reason:issues[0]??"Phép đo lặp chưa đạt.",issues,result:null,summary:empty,diagnostics:[]};
 const prepared=captures.map(c=>usable(c.points)),anchor=[...prepared].sort((a,b)=>b.length-a.length)[0]??[];
 const minimumCoverage=Math.max(MIN_CAPTURES,Math.ceil(captures.length*MIN_COVERAGE));
 const points:TransferPoint[]=[],diagnostics:MeasurementRepeatabilityDiagnostic[]=[],spreads:number[]=[];let unstable=0,under=0;
 for(const anchorPoint of anchor){
  const values=prepared.flatMap(source=>{const v=interpolate(source,anchorPoint.frequencyHz);return v?[v]:[];});
  if(values.length<minimumCoverage){under++;diagnostics.push({frequencyHz:anchorPoint.frequencyHz,captureCount:values.length,spreadDb:null,standardDeviationDb:null,status:"insufficient-coverage"});continue;}
  const levels=values.map(v=>v.magnitudeDb),spread=Math.max(...levels)-Math.min(...levels),mean=levels.reduce((s,v)=>s+v,0)/levels.length;
  const sd=Math.sqrt(levels.reduce((s,v)=>s+(v-mean)**2,0)/levels.length);
  if(spread>MAX_SPREAD_DB){unstable++;diagnostics.push({frequencyHz:anchorPoint.frequencyHz,captureCount:values.length,spreadDb:spread,standardDeviationDb:sd,status:"unstable"});continue;}
  points.push({frequencyHz:anchorPoint.frequencyHz,magnitudeDb:median(levels),phaseDeg:circularMean(values.map(v=>v.phaseDeg)),coherence:median(values.map(v=>v.coherence))});
  spreads.push(spread);diagnostics.push({frequencyHz:anchorPoint.frequencyHz,captureCount:values.length,spreadDb:spread,standardDeviationDb:sd,status:"included"});
 }
 const readiness=assessAutoEqReadiness(points.map(({frequencyHz,magnitudeDb,coherence})=>({frequencyHz,magnitudeDb,coherence}))),ready=readiness.ready;
 const summary:MeasurementRepeatabilitySummary={passed:ready,captureCount:captures.length,includedBinCount:points.length,unstableBinCount:unstable,insufficientCoverageBinCount:under,medianSpreadDb:median(spreads),maximumSpreadDb:spreads.length?Math.max(...spreads):0,maximumAllowedSpreadDb:MAX_SPREAD_DB};
 const reason=ready?`Đạt độ lặp: ${captures.length} lần đo, ${points.length} bin ổn định; loại ${unstable} bin spread trên ${MAX_SPREAD_DB} dB.`:`Độ lặp chưa đủ điều kiện Auto EQ: ${readiness.reason}`;
 if(!ready)issues.push(reason);
 const first=captures[0],qualities=captures.map(c=>c.captureQuality!);
 const result:TransferResult|null=first&&points.length?{...first,points,estimatedDelayMs:median(captures.map(c=>c.estimatedDelayMs)),confidence:Math.min(...captures.map(c=>c.confidence)),averageCoherence:median(captures.map(c=>c.averageCoherence)),reliableBandPercent:Math.min(...captures.map(c=>c.reliableBandPercent)),framesAveraged:Math.min(...captures.map(c=>c.framesAveraged)),captureQuality:{rmsDbfs:median(qualities.map(q=>q.rmsDbfs)),peakDbfs:Math.max(...qualities.map(q=>q.peakDbfs)),clippedSamplePercent:Math.max(...qualities.map(q=>q.clippedSamplePercent)),invalidSamplePercent:Math.max(...qualities.map(q=>q.invalidSamplePercent)),sampleCount:Math.min(...qualities.map(q=>q.sampleCount))}}:null;
 return {ready,reason,issues:ready?[]:issues,result,summary,diagnostics};
}
