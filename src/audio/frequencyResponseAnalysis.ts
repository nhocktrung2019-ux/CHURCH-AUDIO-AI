export type FrequencyBin={frequencyHz:number;magnitudeDb:number;coherence:number};
export type FrequencyResponseSweep={id:number;zone:string;position:string;sampleRateHz:number;inputLabel:string;capturedAt:number;bins:FrequencyBin[]};
export type ResponseCheck={id:string;status:"pass"|"warning"|"fail";detail:string};
export type ResponseQuality={status:"ready"|"review"|"blocked";checks:ResponseCheck[];sweepCount:number;positionCount:number;zoneCount:number;frequencyBinCount:number};
const validDb=(v:number)=>Number.isFinite(v)&&v>=-180&&v<=60;
const norm=(v:string)=>v.trim().toLocaleLowerCase("vi");
const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const sameGrid=(a:FrequencyBin[],b:FrequencyBin[])=>a.length===b.length&&a.every((p,i)=>Math.abs(p.frequencyHz-b[i].frequencyHz)<=Math.max(.01,p.frequencyHz*1e-5));

export function assessFrequencyResponseQuality(sweeps:FrequencyResponseSweep[],options:{minimumRepeats?:number;minimumCoherence?:number}={}):ResponseQuality{
 const requestedRepeats=options.minimumRepeats??3,requestedCoherence=options.minimumCoherence??.8;
 const validRepeats=Number.isInteger(requestedRepeats)&&requestedRepeats>=2&&requestedRepeats<=20;
 const validCoherence=Number.isFinite(requestedCoherence)&&requestedCoherence>=0&&requestedCoherence<=1;
 const minRepeats=validRepeats?requestedRepeats:3,minCoherence=validCoherence?requestedCoherence:.8,checks:ResponseCheck[]=[];
 const add=(id:string,status:ResponseCheck["status"],detail:string)=>checks.push({id,status,detail});
 if(!sweeps.length){add("sweeps","fail","Chưa có sweep đáp tuyến thực tế.");return{status:"blocked",checks,sweepCount:0,positionCount:0,zoneCount:0,frequencyBinCount:0}}
 add("analysis-options",validRepeats&&validCoherence?"pass":"fail","minimumRepeats phải là số nguyên 2–20; minimumCoherence phải nằm trong 0–1.");
 const ids=sweeps.map(s=>s.id);
 add("sweep-identity",ids.every(Number.isFinite)&&new Set(ids).size===ids.length?"pass":"fail","Mỗi sweep phải có ID số hữu hạn và duy nhất; không chấp nhận bản ghi trùng ID.");
 const safeText=(v:unknown)=>typeof v==="string"?v:"";
 const rates=new Set(sweeps.map(s=>s.sampleRateHz)),inputs=new Set(sweeps.map(s=>norm(safeText(s.inputLabel))));
 const zones=new Set(sweeps.map(s=>norm(safeText(s.zone))).filter(Boolean)),positions=new Set(sweeps.map(s=>norm(safeText(s.zone))+"|"+norm(safeText(s.position))).filter(k=>!k.endsWith("|")));
 add("sample-rate",rates.size===1&&sweeps.every(s=>Number.isInteger(s.sampleRateHz)&&s.sampleRateHz>=8000)?"pass":"fail","Sample rate phải hợp lệ và đồng nhất.");
 add("input-chain",inputs.size===1&&!inputs.has("")?"pass":"fail","Chuỗi đầu vào phải được định danh và đồng nhất.");
 add("metadata",sweeps.some(s=>!safeText(s.zone).trim()||!safeText(s.position).trim()||!Number.isFinite(s.capturedAt)||!Array.isArray(s.bins)||s.bins.length<2)?"fail":"pass","Mỗi sweep cần vùng, vị trí, thời gian và ít nhất hai bins.");
 add("bin-integrity",sweeps.some(s=>!Array.isArray(s.bins)||s.bins.some((b,i)=>!b||!Number.isFinite(b.frequencyHz)||b.frequencyHz<=0||!validDb(b.magnitudeDb)||!Number.isFinite(b.coherence)||b.coherence<0||b.coherence>1||(i>0&&b.frequencyHz<=s.bins[i-1].frequencyHz)))?"fail":"pass","Tần số phải tăng đơn điệu; magnitude/coherence phải hợp lệ.");
 const ref=sweeps[0].bins;
 add("frequency-grid",sweeps.some(s=>!sameGrid(ref,s.bins))?"fail":"pass","Các sweep phải có cùng lưới tần số; không tự nội suy bins bị thiếu.");
 const groups=new Map<string,FrequencyResponseSweep[]>();
 for(const s of sweeps){const k=norm(s.zone)+"|"+norm(s.position),g=groups.get(k)??[];g.push(s);groups.set(k,g)}
 const few=[...groups.values()].filter(g=>g.length<minRepeats).length;
 add("repeatability",few?"warning":"pass",few+" vị trí có ít hơn "+minRepeats+" sweep lặp.");
 const low=sweeps.reduce((n,s)=>n+s.bins.filter(b=>b.coherence<minCoherence).length,0);
 add("coherence",low?"warning":"pass",low+" bins có coherence dưới "+minCoherence+".");
 const fail=checks.some(c=>c.status==="fail"),warn=checks.some(c=>c.status==="warning");
 return{status:fail?"blocked":warn?"review":"ready",checks,sweepCount:sweeps.length,positionCount:positions.size,zoneCount:zones.size,frequencyBinCount:ref.length};
}

export type ResponseCurvePoint={frequencyHz:number;magnitudeDb:number;coherence:number;positionCount:number};
export type ZoneResponseCurve={zone:string;points:ResponseCurvePoint[];unit:"relative-response-dB";sourceSweepIds:number[];note:string};
/** Repeats are amplitude-averaged per seat; each seat then has equal spatial weight. */
export function buildZoneResponseCurves(sweeps:FrequencyResponseSweep[],options:{minimumCoherence?:number;minimumRepeats?:number}={}):ZoneResponseCurve[]{
 if(assessFrequencyResponseQuality(sweeps,options).status==="blocked")return[];
 const minC=options.minimumCoherence??.8,minR=options.minimumRepeats??3;
 const zones=new Map<string,Map<string,FrequencyResponseSweep[]>>();
 for(const s of sweeps){const seats=zones.get(s.zone)??new Map<string,FrequencyResponseSweep[]>(),g=seats.get(s.position)??[];g.push(s);seats.set(s.position,g);zones.set(s.zone,seats)}
 const out:ZoneResponseCurve[]=[];
 for(const [zone,seats] of zones){const seatCurves:ResponseCurvePoint[][]=[],ids:number[]=[];
  for(const captures of seats.values()){if(captures.length<minR)continue;ids.push(...captures.map(s=>s.id));
   const curve=captures[0].bins.map((bin,i)=>{const valid=captures.map(s=>s.bins[i]).filter(b=>b.coherence>=minC);if(!valid.length)return null;
    const amp=valid.reduce((sum,b)=>sum+10**(b.magnitudeDb/20),0)/valid.length;
    return{frequencyHz:bin.frequencyHz,magnitudeDb:20*Math.log10(amp),coherence:valid.reduce((sum,b)=>sum+b.coherence,0)/valid.length,positionCount:1}});
   if(curve.every(Boolean))seatCurves.push(curve as ResponseCurvePoint[]);
  }
  if(!seatCurves.length)continue;
  const points=seatCurves[0].map((p,i)=>{const at=seatCurves.map(c=>c[i]);return{frequencyHz:p.frequencyHz,magnitudeDb:median(at.map(x=>x.magnitudeDb)),coherence:median(at.map(x=>x.coherence)),positionCount:at.length}});
  out.push({zone,points,unit:"relative-response-dB",sourceSweepIds:ids,note:"Đáp tuyến tương đối từ sweep thực tế; mỗi vị trí nghe có trọng số ngang nhau, không phải dB SPL tuyệt đối."});
 }
 return out;
}

export function smoothFractionalOctaveResponse(points:ResponseCurvePoint[],fraction=6):ResponseCurvePoint[]{
 if(!Number.isInteger(fraction)||fraction<1||fraction>24||points.length<2||points.some(p=>!Number.isFinite(p.frequencyHz)||p.frequencyHz<=0||!validDb(p.magnitudeDb)))return[];
 const sorted=[...points].sort((a,b)=>a.frequencyHz-b.frequencyHz),ratio=2**(1/(2*fraction));
 return sorted.map(center=>{const selected=sorted.filter(p=>p.frequencyHz>=center.frequencyHz/ratio&&p.frequencyHz<=center.frequencyHz*ratio);
  const amp=selected.reduce((sum,p)=>sum+10**(p.magnitudeDb/20),0)/selected.length;return{...center,magnitudeDb:20*Math.log10(amp)}});
}
export function compareZoneResponseCurves(a:ZoneResponseCurve,b:ZoneResponseCurve){
 if(!a.points.length||a.points.length!==b.points.length||a.points.some((p,i)=>Math.abs(p.frequencyHz-b.points[i].frequencyHz)>Math.max(.01,p.frequencyHz*1e-5)))return null;
 return{zoneA:a.zone,zoneB:b.zone,points:a.points.map((p,i)=>({frequencyHz:p.frequencyHz,deltaDb:p.magnitudeDb-b.points[i].magnitudeDb,coherence:Math.min(p.coherence,b.points[i].coherence)})),note:"Chênh lệch A−B của đáp tuyến tương đối; cần cùng chuỗi và điều kiện đo."};
}
export function assessResponseRepeatability(sweeps:FrequencyResponseSweep[],spreadLimitDb=2){
 if(!Number.isFinite(spreadLimitDb)||spreadLimitDb<=0)return[];
 const groups=new Map<string,FrequencyResponseSweep[]>();
 for(const s of sweeps){const k=norm(s.zone)+"|"+norm(s.position),g=groups.get(k)??[];g.push(s);groups.set(k,g)}
 const out:{zone:string;position:string;frequencyHz:number;medianDb:number;spreadDb:number;repeatCount:number;status:"consistent"|"review"}[]=[];
 for(const g of groups.values()){if(g.length<2||g.some(s=>!sameGrid(g[0].bins,s.bins)))continue;
  g[0].bins.forEach((bin,i)=>{const values=g.map(s=>s.bins[i].magnitudeDb),spread=Math.max(...values)-Math.min(...values);
   out.push({zone:g[0].zone,position:g[0].position,frequencyHz:bin.frequencyHz,medianDb:median(values),spreadDb:spread,repeatCount:g.length,status:spread>spreadLimitDb?"review":"consistent"})});
 }
 return out;
}
