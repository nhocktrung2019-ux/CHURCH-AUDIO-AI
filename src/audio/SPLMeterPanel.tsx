import { Activity, Gauge, Volume2 } from "lucide-react";
type Levels={z:number;a:number;c:number};\ntype TimeWeighted={af:number;as:number;cf:number;cs:number};
type Props={weighted:Levels;leq:Levels;timeWeighted:TimeWeighted;peakDbfs:number;offsetDb:number;durationSeconds:number;running:boolean};
const fmt=(value:number)=>Number.isFinite(value)&&value> -99?value.toFixed(1):"—";
export default function SPLMeterPanel({weighted,leq,timeWeighted,peakDbfs,offsetDb,durationSeconds,running}:Props){
  const calibrated = Math.abs(offsetDb) > 0.001;
  const unit = calibrated ? "dB SPL" : "dBFS";
  return <section className="panel spl-meter-panel">
    <div className="heading"><Gauge/><h2>Sound Level Meter · Z / A / C Weighting</h2><span>{running?"INTEGRATING":"STOPPED"}</span></div>
    <div className="spl-live-readings">
      <article className="spl-main-reading"><small>LA · INSTANTANEOUS</small><strong>{fmt(weighted.a+offsetDb)} <small>{unit}</small></strong><span>{calibrated ? "A-weighted, offset active" : "Uncalibrated A-weighted dBFS"}</span></article>
      <article><small>LZeq · INTEGRATED</small><b>{fmt(leq.z+offsetDb)} {unit}</b><span>Z-weighted</span></article>
      <article><small>LAeq · INTEGRATED</small><b>{fmt(leq.a+offsetDb)} {unit}</b><span>A-weighted</span></article>
      <article><small>LCeq · INTEGRATED</small><b>{fmt(leq.c+offsetDb)} {unit}</b><span>C-weighted</span></article>
      <article><small>LC · LIVE</small><b>{fmt(weighted.c+offsetDb)} {unit}</b><span>C-weighted live</span></article>\n      <article><small>LAF · FAST 125 ms</small><b>{fmt(timeWeighted.af+offsetDb)} {unit}</b><span>A-weighted Fast</span></article>\n      <article><small>LAS · SLOW 1 s</small><b>{fmt(timeWeighted.as+offsetDb)} {unit}</b><span>A-weighted Slow</span></article>\n      <article><small>LCF · FAST 125 ms</small><b>{fmt(timeWeighted.cf+offsetDb)} {unit}</b><span>C-weighted Fast</span></article>\n      <article><small>LCS · SLOW 1 s</small><b>{fmt(timeWeighted.cs+offsetDb)} {unit}</b><span>C-weighted Slow</span></article>
      <article><small>PEAK SAMPLE · RAW</small><b>{fmt(peakDbfs)} dBFS</b><span>Unweighted sample peak</span></article>
    </div>
    <div className="spl-meter-foot"><span><Activity/> {running?"Measurement running":"Start microphone to integrate Leq"} · {calibrated?"ONE-POINT OFFSET":"NOT CALIBRATED"}</span><span><Volume2/> Duration {Math.floor(durationSeconds/60).toString().padStart(2,"0")}:{Math.floor(durationSeconds%60).toString().padStart(2,"0")}</span></div>
    <p className="warning">Leq được tích phân từ FFT mic stream; Fast 125 ms và Slow 1 s dùng exponential energy smoothing theo frame. Đây là ước tính phần mềm, chưa qua kiểm tra dung sai IEC 61672, true-peak oversampling, linearity, self-noise hoặc class 1/2 validation. Không dùng làm máy đo SPL chứng nhận.</p>
  </section>;
}
