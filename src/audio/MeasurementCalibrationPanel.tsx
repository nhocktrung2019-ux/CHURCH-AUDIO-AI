import { useEffect, useState } from "react";
import { Activity, Save, RotateCcw, Gauge, Mic } from "lucide-react";
import { usePersistentState } from "./usePersistentState";

type MicProfile = { model: string; sensitivityMvPa: string; preampGainDb: string };
const DEFAULT_PROFILE: MicProfile = { model: "Micro đo chưa khai báo", sensitivityMvPa: "", preampGainDb: "0" };

type Props = {
  inputDbfs: number;
  offsetDb: number;
  onOffsetChange: (value: number) => void;
};

export default function MeasurementCalibrationPanel({ inputDbfs, offsetDb, onOffsetChange }: Props) {
  const [referenceDb, setReferenceDb] = useState(94);
  const [manualOffset, setManualOffset] = useState(String(offsetDb));
  const [profile, setProfile] = usePersistentState<MicProfile>("church-audio-microphone-profile", DEFAULT_PROFILE);
  const calibrated = inputDbfs > -99 ? inputDbfs + offsetDb : null;

  useEffect(() => setManualOffset(offsetDb.toFixed(2)), [offsetDb]);

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
  const sensitivity = Number(profile.sensitivityMvPa);
  const preampGain = Number(profile.preampGainDb);

  return <section className="panel calibration-panel">
    <div className="heading"><Gauge /><h2>Microphone Profile · Độ nhạy & SPL Calibration</h2><span>{offsetDb === 0 ? "UNREFERENCED" : "OFFSET ACTIVE"}</span></div>
    <div className="mic-profile-fields">
      <label><span><Mic/> MODEL / TÊN MICRO</span><input value={profile.model} maxLength={100} onChange={event => setProfile(old => ({ ...old, model: event.target.value }))}/></label>
      <label><span>ĐỘ NHẠY THEO DATASHEET (mV/Pa)</span><input type="number" min="0.01" max="1000" step="0.01" placeholder="Ví dụ: 10" value={profile.sensitivityMvPa} onChange={event => setProfile(old => ({ ...old, sensitivityMvPa: event.target.value }))}/></label>
      <label><span>GAIN PREAMP / INTERFACE (dB)</span><input type="number" min="-60" max="80" step="0.5" value={profile.preampGainDb} onChange={event => setProfile(old => ({ ...old, preampGainDb: event.target.value }))}/></label>
    </div>
    <p className="muted">Hồ sơ micro được lưu trên thiết bị. Độ nhạy mV/Pa và gain là thông số tham chiếu từ datasheet; offset SPL vẫn phải được xác lập bằng acoustic calibrator thực để bù cả chuỗi micro–preamp–ADC.</p>
    {profile.sensitivityMvPa && (!Number.isFinite(sensitivity) || sensitivity <= 0 || sensitivity > 1000) ? <p className="error">Độ nhạy micro phải nằm trong khoảng 0,01–1000 mV/Pa.</p> : null}
    {!Number.isFinite(preampGain) || preampGain < -60 || preampGain > 80 ? <p className="error">Gain preamp phải nằm trong khoảng -60 đến +80 dB.</p> : null}
    <div className="calibration-reading">
      <div><small>LIVE RMS · 1 kHz CORRECTION</small><strong>{inputDbfs <= -99 ? "—" : inputDbfs.toFixed(1)} <small>dBFS</small></strong></div>
      <div><small>CALIBRATED LEVEL</small><strong>{calibrated === null ? "—" : calibrated.toFixed(1)} <small>dB SPL</small></strong></div>
      <div><small>MIC OFFSET</small><strong>{offsetDb.toFixed(1)} <small>dB</small></strong></div>
    </div>
    <div className="form-grid">
      <div><label>CALIBRATOR REFERENCE LEVEL</label><select value={referenceDb} onChange={event => setReferenceDb(+event.target.value)}><option value={94}>94.0 dB SPL · 1 kHz calibrator</option><option value={114}>114.0 dB SPL · 1 kHz calibrator</option></select></div>
      <div><label>MANUAL OFFSET (dB)</label><input type="number" step=".1" value={manualOffset} onChange={event => setManualOffset(event.target.value)}/></div>
    </div>
    <div className="calibration-actions"><button disabled={inputDbfs <= -90} onClick={applyCalibration}><Save/> Calibrate from live tone</button><button className="secondary" onClick={applyManual}><Activity/> Apply offset</button><button className="secondary" onClick={() => { onOffsetChange(0); setManualOffset("0"); }}><RotateCcw/> Reset offset</button></div>
    <p className="warning">Chỉ hiệu chuẩn bằng acoustic calibrator thực (thường 94 dB hoặc 114 dB tại 1 kHz) gắn đúng coupler cho micro. Đặt calibrator hoạt động trong lúc nhấn Calibrate. Độ nhạy mV/Pa không tự chuyển thành SPL nếu chưa biết chính xác gain analog và full-scale ADC. Offset một điểm không thay thế calibration file đáp tuyến, calibration phase hoặc phép đo IEC Class 1/2.</p>
  </section>;
}
