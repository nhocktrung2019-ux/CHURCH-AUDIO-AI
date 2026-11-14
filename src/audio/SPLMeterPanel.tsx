import { Activity, Gauge, Volume2 } from "lucide-react";
type Levels={z:number;a:number;c:number};
type Props={weighted:Levels;leq:Levels;peakDbfs:number;offsetDb:number;durationSeconds:number;running:boolean};
const fmt=(value:number)=>Number.isFinite(value)&&value> -99?value.toFixed(1):"—";
export default function SPLMeterPanel({weighted,leq,peakDbfs,offsetDb,durationSeconds,running}:Props){
  const calibrated = Math.abs(offsetDb) > 0.001;
  const unit = calibrated ? "dB SPL" : "dBFS";
  return <section className="panel spl-meter-panel">
    <div className="heading"><Gauge/><h2>Sound Level Meter · Z / A / C Weighting</h2><span>{running?"INTEGRATING":"STOPPED"}</span></div>
    <div className="spl-live-readings">
      <article className="spl-main-reading"><small>LA · INSTANTANEOUS</small><strong>{fmt(weighted.a+offsetDb)} <small>{unit}</small></strong><span>{calibrated ? "A-weighted, offset active" : "Uncalibrated A-weighted dBFS"}</span></article>
      <article><small>LZeq · INTEGRATED</small><b>{fmt(leq.z+offsetDb)} {unit}</b><span>Z-weighted</span></article>
      <article><small>LAeq · INTEGRATED</small><b>{fmt(leq.a+offsetDb)} {unit}</b><span>A-weighted</span></article>
      <article><small>LCeq · INTEGRATED</small><b>{fmt(leq.c+offsetDb)} {unit}</b><span>C-weighted</span></article>
      <article><small>LC · LIVE</small><b>{fmt(weighted.c+offsetDb)} {unit}</b><span>C-weighted live</span></article>
      <article><small>PEAK SAMPLE</small><b>{fmt(peakDbfs+offsetDb)} {unit}</b><span>Unweighted sample peak</span></article>
    </div>
    <div className="spl-meter-foot"><span><Activity/> {running?"Measurement running":"Start microphone to integrate Leq"} · {calibrated?"ONE-POINT OFFSET":"NOT CALIBRATED"}</span><span><Volume2/> Duration {Math.floor(durationSeconds/60).toString().padStart(2,"0")}:{Math.floor(durationSeconds%60).toString().padStart(2,"0")}</span></div>
    <p className="warning">Leq được tích phân từ FFT mic stream theo weighting curves, chỉ là Z/A/C-weighted estimate hiện tại. Chưa có time-weighted Fast/Slow detector theo IEC, true-peak oversampling, class 1/2 validation hoặc calibration frequency-response correction. Không dùng làm máy đo SPL chứng nhận.</p>
  </section>;
}
