import { useState } from "react";
import { usePersistentState } from "./audio/usePersistentState";
import { micCorrectionAt, type MicCalibrationFile, type MicCalibrationPoint } from "./audio/micCalibration";
import { Activity, AudioWaveform, Mic, Radio, Volume2, Waves, RefreshCw, Square, Layers3, CheckCircle2, AlertCircle, LayoutDashboard, SlidersHorizontal, ShieldCheck, Box, Settings2, Ruler, Speaker } from "lucide-react";
import { useAudioAnalyzer } from "./audio/useAudioAnalyzer";
import { useToneGenerator } from "./audio/useToneGenerator";
import { equipment } from "./data/equipment";
import MeasurementPlanner from "./audio/MeasurementPlanner";
import TransferFunctionPanel from "./audio/TransferFunctionPanel";
import FeedbackMonitor from "./audio/FeedbackMonitor";
import TuningAdvisor from "./audio/TuningAdvisor";
import RoomPlanner3D from "./audio/RoomPlanner3D";
import RT60MeasurementPanel from "./audio/RT60MeasurementPanel";
import MeasurementCalibrationPanel from "./audio/MeasurementCalibrationPanel";
import CBTCalculator from "./audio/CBTCalculator";
import PolarDataStudio from "./audio/PolarDataStudio";
import SPLMeterPanel from "./audio/SPLMeterPanel";
import MicCalibrationPanel from "./audio/MicCalibrationPanel";
import ProjectBackupPanel from "./audio/ProjectBackupPanel";

type TabId = "overview" | "rta" | "room" | "align" | "system" | "design" | "tools";
const EMPTY_MIC_CALIBRATION_POINTS: MicCalibrationPoint[] = [];
const tabs: { id: TabId; label: string; short: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Tổng quan", short: "HOME", icon: LayoutDashboard },
  { id: "rta", label: "Phân tích tín hiệu", short: "RTA", icon: Activity },
  { id: "room", label: "Đo âm học phòng", short: "ROOM", icon: Ruler },
  { id: "align", label: "Căn chỉnh hệ thống", short: "ALIGN", icon: SlidersHorizontal },
  { id: "system", label: "Chống hú & tối ưu", short: "SYSTEM", icon: ShieldCheck },
  { id: "design", label: "Thiết kế phủ âm 3D", short: "3D", icon: Box },
  { id: "tools", label: "Generator & thiết bị", short: "TOOLS", icon: Settings2 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [calibrationOffsetDb, setCalibrationOffsetDb] = usePersistentState("church-audio-mic-offset-db",0);
  const [micCalibration, setMicCalibration] = usePersistentState<MicCalibrationFile | null>("church-audio-mic-calibration-file",null);
  const calibrationPoints = micCalibration?.points ?? EMPTY_MIC_CALIBRATION_POINTS;
  const a = useAudioAnalyzer(calibrationPoints);
  const t = useToneGenerator();
  const inputs = a.devices.filter((device) => device.kind === "audioinput");
  const outputs = a.devices.filter((device) => device.kind === "audiooutput");
  const micStatus = a.running ? "MICRO ĐANG HOẠT ĐỘNG" : a.connecting ? "ĐANG XIN QUYỀN / KẾT NỐI" : a.permissionState === "denied" ? "CHƯA CÓ QUYỀN MICRO" : "SẴN SÀNG KIỂM TRA";
  const micStatusClass = a.running ? "online" : a.connecting ? "pending" : a.permissionState === "denied" ? "failed" : "standby";

  const DevicePanel = () => <article className="panel device-panel">
    <div className="heading"><Radio /><h2>Thiết bị âm thanh</h2></div>
    <div className={`mic-status ${micStatusClass}`}><span className="mic-status-icon">{a.running ? <CheckCircle2 /> : a.error ? <AlertCircle /> : <Mic />}</span><div><b>{micStatus}</b><small>{a.trackInfo || (a.permissionState === "denied" ? "Mở Cài đặt Android và cho phép Microphone." : "Nhấn Bắt đầu đo để yêu cầu quyền truy cập micro.")}</small></div></div>
    <label htmlFor="mic-input">MICROPHONE INPUT</label>
    <select id="mic-input" value={a.selectedInput} disabled={a.running || a.connecting} onChange={(event) => a.setSelectedInput(event.target.value)}>
      <option value="">Micro mặc định hệ thống</option>{inputs.map((device, index) => <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
    </select>
    <p className="muted">{a.running ? "Đang dùng micro hiện tại. Dừng đo trước khi đổi thiết bị." : "Tên thiết bị có thể hiển thị đầy đủ hơn sau khi cấp quyền micro."}</p>
    <label htmlFor="audio-output">OUTPUT DEVICE</label>
    <select id="audio-output" value={t.outputDevice} disabled={!t.supportsOutputSelection || outputs.length === 0} onChange={(event) => void t.selectOutput(event.target.value)}>
      <option value="">Đầu ra mặc định của hệ thống</option>{outputs.map((device, index) => <option key={device.deviceId || `out-${index}`} value={device.deviceId}>{device.label || `Thiết bị đầu ra ${index + 1}`}</option>)}
    </select>
    <p className="muted">{!t.supportsOutputSelection ? "Trình duyệt không hỗ trợ chọn đầu ra riêng." : outputs.length ? "Chọn đầu ra cho tín hiệu thử." : "Đang dùng đầu ra mặc định hoặc chưa có thiết bị được liệt kê."}</p>
    {t.outputError && <p className="error">{t.outputError}</p>}{a.fallbackNotice && <p className="device-notice">{a.fallbackNotice}</p>}
    <button disabled={a.connecting} onClick={() => (a.running ? a.stop() : void a.start())}>{a.running ? <Square /> : <Mic />}{a.running ? "Dừng đo microphone" : a.connecting ? "Đang kết nối micro…" : "Bắt đầu đo microphone"}</button>
    <button className="secondary" onClick={() => void a.refreshDevices()}><RefreshCw /> Làm mới thiết bị</button>
    <div className="permission-help"><b>Android không nhận micro?</b><span>Vào Cài đặt → Ứng dụng → Church Audio Analyzer → Quyền → Microphone → Cho phép, sau đó quay lại ứng dụng.</span></div>
    {a.error && <p className="error">{a.error}</p>}
  </article>;

  const RtaPanel = () => <article className="panel">
    <div className="heading"><Activity /><h2>RTA · Real-time Analyzer</h2><span>{a.running ? "LIVE" : "WAITING"}</span></div>
    <div className="chart">{a.spectrum.map((value, index) => <i key={index} style={{ height: `${Math.max(2, (value + 100) * .98)}%` }} />)}</div>
    <div className="axis"><span>20 Hz</span><span>100 Hz</span><span>1 kHz</span><span>5 kHz</span><span>20 kHz</span></div>
    <small className="muted">FFT 8192 · 64 LOG BANDS · dBFS POWER AVERAGE · 20 Hz–20 kHz</small><p className="calibrated-inline">INPUT RMS {a.rmsDbfs <= -99 ? "—" : (a.rmsDbfs + calibrationOffsetDb).toFixed(1) + " dB SPL"} · {calibrationOffsetDb === 0 ? "NO CALIBRATION OFFSET" : "ONE-POINT OFFSET ACTIVE"}</p>
  </article>;

  const SpectrogramPanel = () => <article className="panel">
    <div className="heading"><Layers3 /><h2>Spectrogram · Waterfall</h2><span>{a.history.length} FRAMES</span></div>
    <div className="spectrogram">{a.history.slice(-32).map((row, index) => <div className="spectro-row" key={index}>{row.map((value, column) => <i key={column} style={{ opacity: Math.max(.08, Math.min(1, (value + 100) / 100)) }} />)}</div>)}</div>
    <small className="muted">Trục ngang: tần số log · Trục dọc: thời gian · Độ sáng: mức tương đối</small>
  </article>;

  const GeneratorPanel = () => <article className="panel generator-panel">
    <div className="heading"><Waves /><h2>Signal Generator</h2><span>{t.active ? "OUTPUT ON" : "STANDBY"}</span></div>
    <label htmlFor="signal-type">SIGNAL TYPE</label>
    <select id="signal-type" value={t.signalType} onChange={event=>t.setSignalType(event.target.value as typeof t.signalType)}>
      <option value="sine">Sine wave · Pure tone</option>
      <option value="white">White noise</option>
      <option value="pink">Pink noise</option>
      <option value="sweep">Log sweep · 20 Hz–20 kHz</option>
    </select>
    <div className="value"><label>{t.signalType==="sine"?"Tần số sine":"Tần số sine (chỉ áp dụng khi chọn sine)"}</label><b>{t.signalType==="sine"?t.frequency.toLocaleString("vi-VN")+" Hz":t.signalType==="sweep"?"20 Hz → 20 kHz":t.signalType.toUpperCase()+" NOISE"}</b></div>
    <input type="range" min="20" max="20000" step="10" value={t.frequency} disabled={t.signalType!=="sine"} onChange={(event) => t.setFrequency(+event.target.value)} />
    <div className="value"><label>Mức phát</label><b>{t.volume} dB</b></div>
    <input type="range" min="-60" max="0" value={t.volume} onChange={(event) => t.setVolume(+event.target.value)} />
    <button onClick={() => (t.active ? t.stop() : void t.start())}><Volume2 />{t.active ? "Dừng tín hiệu" : "Phát tín hiệu thử"}</button>
    <p className="muted">Pink noise phù hợp kiểm tra đáp tuyến/RTA; white noise dùng kiểm tra phổ; log sweep dùng để kích thích hệ thống. Đây là bộ phát độc lập, chưa có đồng bộ timestamp/loopback reference với phép đo.</p>
    <p className="warning">Bắt đầu ở mức thấp, giảm âm lượng ampli trước khi thử. Tránh phát tín hiệu lớn vào tai nghe hoặc loa và tuyệt đối không phát sweep ở mức cao khi đang đeo tai nghe.</p>
  </article>;

  return <main className="shell">
    <header><div className="brand"><AudioWaveform /><div><b>CHURCH AUDIO</b><small>ACOUSTIC MEASUREMENT SUITE</small></div></div><span className={a.running ? "live" : a.connecting ? "pending-text" : "idle"}>{a.running ? "● ĐANG ĐO" : a.connecting ? "● KẾT NỐI..." : "● SẴN SÀNG"}</span></header>
    <section className="hero compact-hero"><small>PROFESSIONAL SOUND SYSTEM WORKSPACE</small><h1>Church Audio <em>Workbench.</em></h1><p>Bộ công cụ khảo sát âm học, phân tích hệ thống loa và căn chỉnh âm thanh nhà thờ trên Android và máy tính.</p></section>
    <nav className="workspace-tabs" aria-label="Các phân hệ phần mềm">{tabs.map(({id,label,short,icon:Icon}) => <button key={id} className={activeTab === id ? "workspace-tab active" : "workspace-tab"} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? "page" : undefined}><Icon /><span>{label}</span><small>{short}</small></button>)}</nav>
    <div className="workspace-title"><div><small>WORKSPACE / {tabs.find(x => x.id === activeTab)?.short}</small><h2>{tabs.find(x => x.id === activeTab)?.label}</h2></div><span className={a.running ? "live" : "idle"}>{a.running ? "● INPUT LIVE" : "● INPUT IDLE"}</span></div>

    {activeTab === "overview" && <>
      <section className="metrics overview-metrics"><article><small>INPUT PEAK</small><strong>{a.level <= -99 ? "−∞" : a.level.toFixed(1)} <small>dBFS</small></strong><div className="meter"><i style={{width:`${Math.max(0,Math.min(100,((a.level+60)/60)*100))}%`}} /></div></article><article><small>INPUT RMS</small><strong>{a.rmsDbfs <= -99 ? "—" : a.rmsDbfs.toFixed(1)} <small>dBFS</small></strong></article><article><small>INPUT DEVICES</small><strong>{inputs.length} <small>MIC</small></strong></article><article><small>OUTPUT DEVICES</small><strong>{outputs.length} <small>OUT</small></strong></article></section>
      <section className="grid overview-grid"><RtaPanel /><DevicePanel /><article className="panel overview-guide"><div className="heading"><AudioWaveform /><h2>Quy trình đo đề xuất</h2></div><ol><li>Chọn đúng micro đo và đầu ra tín hiệu.</li><li>Kiểm tra mức tín hiệu đầu vào, tránh clipping.</li><li>Đo phổ, đáp ứng phòng và thời gian vang.</li><li>Căn chỉnh delay/phase rồi kiểm tra lại.</li><li>Lưu kết quả và ghi chú điều kiện đo.</li></ol><p className="warning">Số đo điện thoại chưa hiệu chuẩn chỉ dùng tham khảo tương đối.</p></article></section>
    </>}
    {activeTab === "rta" && <section className="tab-stack"><section className="grid"><RtaPanel /><SpectrogramPanel /><DevicePanel /></section><SPLMeterPanel weighted={a.weightedLevels} leq={a.leqLevels} peakDbfs={a.level} offsetDb={calibrationOffsetDb} durationSeconds={a.measurementSeconds} running={a.running} /><MeasurementCalibrationPanel inputDbfs={a.rmsDbfs + micCorrectionAt(calibrationPoints,1000)} offsetDb={calibrationOffsetDb} onOffsetChange={setCalibrationOffsetDb} /><MicCalibrationPanel value={micCalibration} onChange={setMicCalibration} /></section>}
    {activeTab === "room" && <section className="tab-stack"><RT60MeasurementPanel selectedInput={a.selectedInput} running={a.running} /><MeasurementPlanner running={a.running} spectrum={a.spectrum} /><SpectrogramPanel /></section>}
    {activeTab === "align" && <section className="tab-stack"><TransferFunctionPanel selectedInput={a.selectedInput} running={a.running} calibrationPoints={calibrationPoints} /><MeasurementPlanner running={a.running} spectrum={a.spectrum} /></section>}
    {activeTab === "system" && <section className="tab-stack"><FeedbackMonitor history={a.history} /><TuningAdvisor history={a.history} /></section>}
    {activeTab === "design" && <section className="tab-stack"><CBTCalculator /><PolarDataStudio /><RoomPlanner3D /></section>}
    {activeTab === "tools" && <section className="tab-stack"><section className="grid"><GeneratorPanel /><DevicePanel /><article className="panel"><div className="heading"><Speaker /><h2>Thư viện thiết bị</h2><span>{equipment.length} ITEMS</span></div>{equipment.map(item => <div className="item" key={item.name}><b>{item.name}</b><small>{item.type} · Cần xác minh thông số hãng</small></div>)}</article></section><ProjectBackupPanel /></section>}
    <section className="roadmap"><small>PHƯƠNG PHÁP / WORKFLOW</small><p>01 KHẢO SÁT <b>→</b> 02 ĐO LƯỜNG <b>→</b> 03 CĂN CHỈNH <b>→</b> 04 KIỂM SOÁT HỆ THỐNG <b>→</b> 05 THIẾT KẾ PHỦ ÂM</p></section>
    <footer>CHURCH AUDIO ANALYZER <span>PRO MEASUREMENT BETA · BUILD 0.11.0</span></footer>
  </main>;
}
