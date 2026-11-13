import{logBandFrequency}from"./acoustics";
export type FeedbackCandidate={index:number;frequencyHz:number;prominenceDb:number;levelDb:number;recommendedCutDb:number;q:number;};
export function detectNarrowPeaks(history:number[][]):FeedbackCandidate[]{
 if(history.length<5)return[];
 const frames=history.slice(-8),count=Math.min(...frames.map(x=>x.length));if(count<12)return[];
 const found:FeedbackCandidate[]=[];
 for(let i=2;i<count-2;i++){
  const vals=frames.map(f=>f[i]).filter(Number.isFinite).sort((a,b)=>a-b),median=vals[Math.floor(vals.length/2)];
  const neighbours=frames.map(f=>(f[i-2]+f[i-1]+f[i+1]+f[i+2])/4).filter(Number.isFinite).sort((a,b)=>a-b);
  const local=neighbours[Math.floor(neighbours.length/2)],prominence=median-local;
  const stable=vals.filter(v=>v>=local+4).length;
  if(prominence>=6&&stable>=5&&median>-65){
   found.push({index:i,frequencyHz:Math.round(logBandFrequency(i,count)),prominenceDb:Math.round(prominence*10)/10,levelDb:Math.round(median*10)/10,recommendedCutDb:-Math.min(6,Math.max(3,Math.round(prominence*.55))),q:8});
  }
 }
 return found.sort((a,b)=>b.prominenceDb-a.prominenceDb).slice(0,5);
}
