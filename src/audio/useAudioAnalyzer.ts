import {useCallback,useEffect,useRef,useState} from "react";

function estimateRt60(samples: Float32Array, sampleRate: number): number | null {
  if (!samples.length) return null;
  const energy = new Float64Array(samples.length);
  let sum = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    sum += samples[i] * samples[i];
    energy[i] = sum;
  }
  const total = energy[0];
  if (!(total > 0)) return null;
  const db = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) db[i] = 10 * Math.log10(Math.max(energy[i] / total, 1e-12));
  const start = db.findIndex(v => v <= -5);
  let end = -1;
  for (let i = start + 1; i < db.length; i++) if (db[i] <= -25) { end = i; break; }
  if (start < 0 || end <= start) return null;
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  const stride = Math.max(1, Math.floor((end - start) / 4000));
  for (let i = start; i <= end; i += stride) {
    const x = i / sampleRate, y = db[i];
    n++; sx += x; sy += y; sxx += x*x; sxy += x*y;
  }
  const denom = n*sxx - sx*sx;
  const slope = denom ? (n*sxy - sx*sy) / denom : 0;
  if (slope >= -1 || !Number.isFinite(slope)) return null;
  return Math.round(( -60 / slope) * 100) / 100;
}

export function useAudioAnalyzer(){
 const ctx=useRef<AudioContext|null>(null), streamRef=useRef<MediaStream|null>(null), analyserRef=useRef<AnalyserNode|null>(null);
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[selectedInput,setSelectedInput]=useState(""),[running,setRunning]=useState(false),[level,setLevel]=useState(-100),[spectrum,setSpectrum]=useState<number[]>(Array(64).fill(-100)),[history,setHistory]=useState<number[][]>([]),[error,setError]=useState(""),[rt60,setRt60]=useState<number|null>(null),[capturingRt60,setCapturingRt60]=useState(false);
 const refreshDevices=useCallback(async()=>{try{setDevices((await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="audioinput"||d.kind==="audiooutput"));}catch{setError("Không thể liệt kê thiết bị âm thanh.");}},[]);
 const stop=useCallback(()=>{streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;analyserRef.current?.disconnect();analyserRef.current=null;setRunning(false);},[]);
 const start=useCallback(async()=>{setError("");try{if(!navigator.mediaDevices?.getUserMedia)throw new Error("Cần HTTPS hoặc localhost và quyền microphone.");stop();const stream=await navigator.mediaDevices.getUserMedia({audio:selectedInput?{deviceId:{exact:selectedInput},echoCancellation:false,noiseSuppression:false,autoGainControl:false}:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});const audio=new AudioContext(),source=audio.createMediaStreamSource(stream),analyser=audio.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=.72;source.connect(analyser);ctx.current=audio;streamRef.current=stream;analyserRef.current=analyser;setHistory([]);setRunning(true);await refreshDevices();}catch(e){setError(e instanceof Error?e.message:"Không mở được microphone.");}},[refreshDevices,selectedInput,stop]);
 const captureRt60=useCallback(async()=>{const stream=streamRef.current;if(!stream||!ctx.current){setError("Hãy bắt đầu đo microphone trước.");return;}if(typeof MediaRecorder==="undefined"){setError("Thiết bị/trình duyệt không hỗ trợ ghi âm để ước tính RT60.");return;}setCapturingRt60(true);setError("");try{const recorder=new MediaRecorder(stream);const chunks:BlobPart[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const finished=new Promise<Blob>((resolve,reject)=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||"audio/webm"}));recorder.onerror=()=>reject(new Error("Không ghi được mẫu âm thanh."));});recorder.start();await new Promise(r=>setTimeout(r,6000));recorder.stop();const blob=await finished;const buffer=await ctx.current.decodeAudioData(await blob.arrayBuffer());const mono=new Float32Array(buffer.length);for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<channel.length;i++)mono[i]+=channel[i]/buffer.numberOfChannels;}const result=estimateRt60(mono,buffer.sampleRate);setRt60(result);if(result===null)setError("Không tìm thấy đoạn suy giảm đủ 20 dB. Hãy phát sweep/impulse ở mức an toàn rồi đo lại trong phòng yên tĩnh.");}catch(e){setError(e instanceof Error?e.message:"Không phân tích được mẫu RT60.");}finally{setCapturingRt60(false);}},[]);
 useEffect(()=>{if(!running)return;let id=0,frame=0;const tick=()=>{const a=analyserRef.current;if(a){const d=new Float32Array(a.frequencyBinCount);a.getFloatFrequencyData(d);const bins=Array.from({length:64},(_,i)=>{const s=Math.max(1,Math.floor(Math.pow(d.length,i/64))),e=Math.max(s+1,Math.floor(Math.pow(d.length,(i+1)/64)));let v=-120;for(let j=s;j<Math.min(e,d.length);j++)v=Math.max(v,d[j]);return Number.isFinite(v)?Math.max(-100,Math.min(0,v)):-100;});setSpectrum(bins);setLevel(Math.max(-100,...Array.from(d.slice(1,300))));if(++frame%5===0)setHistory(old=>[...old.slice(-39),bins]);}id=requestAnimationFrame(tick);};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id);},[running]);
 useEffect(()=>{void refreshDevices();return()=>{streamRef.current?.getTracks().forEach(t=>t.stop());void ctx.current?.close();};},[refreshDevices]);
 return {devices,selectedInput,setSelectedInput,running,level,spectrum,history,error,start,stop,refreshDevices,rt60,captureRt60,capturingRt60};
}