import { useMemo, useState } from "react";
import { Download, SlidersHorizontal } from "lucide-react";
import { calculateDynamicsStartingPoint, type MicrophoneUse } from "./dspStartingPoints";

export default function DSPDynamicsAdvisor() {
  const [microphone, setMicrophone] = useState<MicrophoneUse>("dynamic-handheld");
  const [noiseFloor, setNoiseFloor] = useState(-55);
  const [speechPeak, setSpeechPeak] = useState(-18);
  const settings = useMemo(() => calculateDynamicsStartingPoint({
    microphone, noiseFloorDbfs: noiseFloor, speechPeakDbfs: speechPeak,
  }), [microphone, noiseFloor, speechPeak]);
  const exportSettings = () => {
    const blob = new Blob([JSON.stringify({
      schema: "church-audio-dynamics-starting-point/v1",
      exportedAt: new Date().toISOString(),
      microphone, measuredNoiseFloorDbfs: noiseFloor, measuredSpeechPeakDbfs: speechPeak,
      settings, safety: "Offline reference only. Confirm units and ranges on the exact mixer/DSP. No hardware writes.",
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "church-audio-dynamics-starting-point.json";
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  return <article className="panel dsp-dynamics-advisor">
    <div className="heading"><SlidersHorizontal /><h2>Gate · Compressor · Limiter</h2><span>STARTING POINT</span></div>
    <p className="muted">Tính điểm khởi đầu từ mức nền ồn và đỉnh tiếng nói đo được. Chỉ là tham khảo dBFS, không phải thông số mặc định cho mọi mixer.</p>
    <div className="form-grid">
      <div><label htmlFor="dynamics-mic">LOẠI MICRO</label><select id="dynamics-mic" value={microphone} onChange={event => setMicrophone(event.target.value as MicrophoneUse)}><option value="dynamic-handheld">Micro dynamic cầm tay</option><option value="gooseneck">Micro cổ ngỗng</option></select></div>
      <div><label htmlFor="dynamics-noise">NỀN ỒN KHI KHÔNG NÓI (dBFS)</label><input id="dynamics-noise" type="number" min="-90" max="-10" value={noiseFloor} onChange={event => setNoiseFloor(Math.max(-90, Math.min(-10, Number(event.target.value))))} /></div>
      <div><label htmlFor="dynamics-peak">ĐỈNH TIẾNG NÓI (dBFS)</label><input id="dynamics-peak" type="number" min="-40" max="-1" value={speechPeak} onChange={event => setSpeechPeak(Math.max(-40, Math.min(-1, Number(event.target.value))))} /></div>
    </div>
    <div className="dsp-device-summary">
      <div><small>GATE · SOFT EXPANDER</small><b>{settings.gate.thresholdDbfs} dBFS</b><small>Range {settings.gate.rangeDb} dB · Attack {settings.gate.attackMs} ms · Hold {settings.gate.holdMs} ms · Release {settings.gate.releaseMs} ms</small></div>
      <div><small>COMPRESSOR</small><b>{settings.compressor.thresholdDbfs} dBFS · {settings.compressor.ratio}:1</b><small>Attack {settings.compressor.attackMs} ms · Release {settings.compressor.releaseMs} ms · Knee {settings.compressor.kneeDb} dB</small></div>
      <div><small>LIMITER</small><b>{settings.limiter.ceilingDbfs} dBFS</b><small>Attack {settings.limiter.attackMs} ms · Release {settings.limiter.releaseMs} ms</small></div>
    </div>
    {settings.warnings.map(warning => <p className="warning" key={warning}>{warning}</p>)}
    <p className="muted">Bắt đầu với makeup gain = 0 dB. Nghe thử từng bước, kiểm tra gain reduction và peak meter; không dùng gate để chữa hú rít. Ngưỡng dBFS phải quy đổi/đối chiếu theo thang meter của thiết bị.</p>
    <button onClick={exportSettings}><Download /> Xuất thông số tham khảo JSON</button>
  </article>;
}
