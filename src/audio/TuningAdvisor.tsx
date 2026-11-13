import{useEffect,useMemo,useRef,useState}from"react";
import{AudioLines,Mic2,SlidersHorizontal,Volume2,ShieldCheck}from"lucide-react";
import{detectNarrowPeaks}from"./feedback";

type Props={history:number[][];level:number};
export default function TuningAdvisor({history,level}:Props){
 const[voice,setVoice]=useState(true),[mic,setMic]=useState("dynamic"),[speaker,setSpeaker]=useState("fullrange");
 const peaks=useMemo(()=>detectNarrowPeaks(history),[history]),lastSpoken=useRef("");
 const noiseFloor=useMemo(()=>{const tail=history.slice(-20);if(!tail.length)return -90;const vals=tail.flat().filter(Number.isFinite).sort((a,b)=>a-b);return vals[Math.floor(vals.length*.2)]??-90;},[history]);
 const hpf=mic==="gooseneck"?100:mic==="wireless"?110:80;
 const gateThreshold=Math.max(-55,Math.min(-30,Math.round(noiseFloor+8)));
 const comp=mic==="gooseneck"?"2:1 · threshold −18 dB · attack 15 ms · release 120 ms":"2.5:1 · threshold −18 dB · attack 10 ms · release 100 ms";
 const limiter=speaker==="column"?"−3 dBFS (DSP output ceiling khởi điểm)":"−3 dBFS (DSP output ceiling khởi điểm)";
 useEffect(()=>{if(!voice||!peaks.length||typeof window==="undefined"||!("speechSynthesis"in window))return;const p=peaks[0],key=Math.round(p.frequencyHz/10)*10;if(lastSpoken.current===String(key))return;lastSpoken.current=String(key);const utterance=new SpeechSynthesisUtterance("Cảnh báo. Có đỉnh tần số nghi hú tại "+p.frequencyHz+" héc. Hãy giảm gain và kiểm tra micro.");utterance.lang="vi-VN";utterance.rate=.92;window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);},[peaks,voice]);
 return <section className="panel"><div className="heading"><SlidersHorizontal/><h2>AI Tuning Advisor · Cân chỉnh có kiểm soát</h2><span>ADVISORY ONLY</span></div>
 <p className="muted">Tạo điểm bắt đầu từ mức ồn nền và phổ RTA. Luôn nghe/đo xác minh; không tự ghi tham số vào mixer hoặc DSP.</p>
 <div className="form-grid"><div><label>LOẠI MICROPHONE</label><select value={mic} onChange={e=>setMic(e.target.value)}><option value="dynamic">Shure dynamic / handheld (generic)</option><option value="gooseneck">Microphone cổ ngỗng (generic)</option><option value="wireless">Microphone không dây (generic)</option></select></div><div><label>NHÓM LOA</label><select value={speaker} onChange={e=>setSpeaker(e.target.value)}><option value="fullrange">Full-range / point source</option><option value="column">Column / distributed</option><option value="sub">Subwoofer</option></select></div></div>
 <div className="advisor-grid"><article><Mic2/><small>HPF START</small><b>{speaker==="sub"?"80–120 Hz":hpf+" Hz"}</b><span>Đặt theo giọng nói, proximity và crossover thực tế.</span></article><article><AudioLines/><small>GATE THRESHOLD</small><b>{gateThreshold} dBFS</b><span>Ước lượng noise floor + 8 dB; chỉnh release để tránh cụt chữ.</span></article><article><SlidersHorizontal/><small>COMPRESSOR</small><b>{comp}</b><span>Preset khởi điểm, không phải thông số tối ưu cho mọi giọng.</span></article><article><ShieldCheck/><small>LIMITER CEILING</small><b>{limiter}</b><span>Phải đặt theo độ nhạy, công suất loa, gain structure và DSP.</span></article></div>
 <div className="voice-row"><div><b><Volume2/> Cảnh báo hú bằng giọng nói</b><small>Đọc tần số nghi vấn đầu tiên khi phát hiện đỉnh mới.</small></div><label className="switch-label"><input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/> {voice?"Bật":"Tắt"}</label></div>
 <div className="feedback-clear"><ShieldCheck/><span>Auto Mix: chưa kích hoạt. Cần nhiều kênh micro đồng thời và quyền truy cập mixer để tự cân bằng gain; bản hiện tại chỉ có một luồng microphone đo.</span></div>
 <p className="warning">Các preset không đại diện thông số chính thức của Shure hay từng model loa. Limiter phải được tính theo thông số nhà sản xuất; không dùng −3 dBFS làm giới hạn công suất loa nếu chưa hiệu chuẩn gain DSP/ampli.</p>
 </section>;
}