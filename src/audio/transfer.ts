export type TransferPoint={frequencyHz:number; magnitudeDb:number; phaseDeg:number};
export type TransferResult={points:TransferPoint[]; impulsePeakMs:number; estimatedDelayMs:number; confidence:number};

function fft(re:Float64Array,im:Float64Array,inverse=false){
 const n=re.length;
 for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const angle=(inverse?2:-2)*Math.PI/len,wr0=Math.cos(angle),wi0=Math.sin(angle);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const u=i+j,v=i+j+len/2,tr=wr*re[v]-wi*im[v],ti=wr*im[v]+wi*re[v];re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti;const nw=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=nw;}}}
 if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
export function makeReferenceNoise(sampleRate:number,durationSeconds=5):Float32Array{
 const n=Math.floor(sampleRate*durationSeconds),out=new Float32Array(n);let seed=0x13579bdf;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};
 let low=0;for(let i=0;i<n;i++){low=.985*low+.015*random();out[i]=(.72*random()+.28*low)*.045;}
 return out;
}
function bestLag(reference:Float32Array,recorded:Float32Array,sr:number):{lag:number;score:number}{
 const step=16,limit=Math.min(Math.floor(sr*1.2),Math.floor(recorded.length*.3)),refN=Math.min(reference.length,Math.floor(sr*2));
 let best=0,bestScore=0;
 for(let lag=-limit;lag<=limit;lag+=step){let xy=0,xx=0,yy=0,count=0;for(let i=0;i<refN;i+=step){const j=i+lag;if(j<0||j>=recorded.length)continue;const x=reference[i],y=recorded[j];xy+=x*y;xx+=x*x;yy+=y*y;count++;}const score=count&&xx&&yy?Math.abs(xy)/Math.sqrt(xx*yy):0;if(score>bestScore){bestScore=score;best=lag;}}
 return {lag:best,score:bestScore};
}
export function analyzeTransfer(reference:Float32Array,recorded:Float32Array,sampleRate:number):TransferResult|null{
 const {lag,score}=bestLag(reference,recorded,sampleRate);if(score<.015)return null;
 const startRef=Math.max(0,-lag),startRec=Math.max(0,lag),length=Math.min(reference.length-startRef,recorded.length-startRec);
 const frame=4096,hop=2048;if(length<frame*2)return null;
 const bins=frame/2, crossRe=new Float64Array(bins),crossIm=new Float64Array(bins),auto=new Float64Array(bins);
 let frames=0;
 for(let offset=0;offset+frame<=length;offset+=hop){const xr=new Float64Array(frame),xi=new Float64Array(frame),yr=new Float64Array(frame),yi=new Float64Array(frame);
  for(let i=0;i<frame;i++){const w=.5-.5*Math.cos(2*Math.PI*i/(frame-1));xr[i]=reference[startRef+offset+i]*w;yr[i]=recorded[startRec+offset+i]*w;}
  fft(xr,xi);fft(yr,yi);
  for(let k=1;k<bins;k++){crossRe[k]+=yr[k]*xr[k]+yi[k]*xi[k];crossIm[k]+=yi[k]*xr[k]-yr[k]*xi[k];auto[k]+=xr[k]*xr[k]+xi[k]*xi[k];}frames++;
 }
 if(!frames)return null;
 const points:TransferPoint[]=[];
 for(let k=2;k<bins;k+=2){const power=auto[k];if(power<1e-12)continue;const re=crossRe[k]/power,im=crossIm[k]/power,mag=Math.sqrt(re*re+im*im);if(!Number.isFinite(mag)||mag<1e-8)continue;points.push({frequencyHz:k*sampleRate/frame,magnitudeDb:20*Math.log10(mag),phaseDeg:Math.atan2(im,re)*180/Math.PI});}
 const peakIndex=recorded.reduce((best,v,i)=>Math.abs(v)>Math.abs(recorded[best]??0)?i:best,0);
 return {points,impulsePeakMs:peakIndex/sampleRate*1000,estimatedDelayMs:lag/sampleRate*1000,confidence:Math.round(score*1000)/1000};
}
