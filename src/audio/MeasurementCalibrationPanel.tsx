import { useState } from "react";
import { Activity, Save, RotateCcw, Gauge } from "lucide-react";

type Props = {
  inputDbfs: number;
  offsetDb: number;
  onOffsetChange: (value: number) => void;
};

export default function MeasurementCalibrationPanel({ inputDbfs, offsetDb, onOffsetChange }: Props) {
  const [referenceDb, setReferenceDb] = useState(94);
  const [manualOffset, setManualOffset] = useState(String(offsetDb));
  const calibrated = inputDbfs > -99 ? inputDbfs + offsetDb : null;
  const applyCalibration = () => {
    if (!Number.isFinite(inputDbfs) || inputDbfs <= -90) return;
    const next = Math.max(-80, Math.min(160, referenceDb - inputDbfs));
    onOffsetChange(next);
    setManualOffset(next.toFixed(2));
  };
  const applyManual = () => {
    const parsed = Number(manualOffset);
    if (Number.isFinite(parsed) && parsed >= -80 && parsed <= 160) onOffsetChange(parsed);
  };
  return <section className="panel calibration-panel">
    <div className="heading"><Gauge /><h2>Measurement Calibration · SPL reference</h2><span>{offsetDb === 0 ? "UNREFERENCED" : "OFFSET ACTIVE"}</span></div>
    <div className="calibration-reading">
      <div><small>LIVE RMS · 1 kHz CORRECTION</small><strong>{inputDbfs <= -99 ? "—" : inputDbfs.toFixed(1)} <small>dBFS</small></strong></div>
      <div><small>CALIBRATED LEVEL</small><strong>{calibrated === null ? "—" : calibrated.toFixed(1)} <small>dB SPL</small></strong></div>
      <div><small>MIC OFFSET</small><strong>{offsetDb.toFixed(1)} <small>dB</small></strong></div>
    </div>
    <div className="form-grid">
      <div><label>CALIBRATOR REFERENCE LEVEL</label><select value={referenceDb} onChange={e=>setReferenceDb(+e.target.value)}><option value={94}>94.0 dB SPL · 1 kHz calibrator</option><option value={114}>114.0 dB SPL · 1 kHz calibrator</option></select></div>
      <div><label>MANUAL OFFSET (dB)</label><input type="number" step=".1" value={manualOffset} onChange={e=>setManualOffset(e.target.value)}/></div>
    </div>
    <div className="calibration-actions"><button disabled={inputDbfs <= -90} onClick={applyCalibration}><Save/> Calibrate from live tone</button><button className="secondary" onClick={applyManual}><Activity/> Apply offset</button><button className="secondary" onClick={()=>{onOffsetChange(0);setManualOffset("0");}}><RotateCcw/> Reset</button></div>
    <p className="warning">Chỉ hiệu chuẩn bằng acoustic calibrator thực (thường 94 dB hoặc 114 dB tại 1 kHz) gắn đúng coupler cho micro. Đặt calibrator hoạt động trong lúc nhấn Calibrate. Offset một điểm không thay thế calibration file đáp tuyến/từng tần số; số này là mức RMS tại đầu vào dùng để hiệu chuẩn 1 kHz; chưa phải LAeq/LAF hoặc phép đo class 1/2.</p>
  </section>;
}
