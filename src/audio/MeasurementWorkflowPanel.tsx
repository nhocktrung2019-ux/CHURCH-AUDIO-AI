import { useMemo, useState } from "react";
import { Download, MapPin, Plus, ShieldCheck, Timer } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { upsertMeasurementPosition, validateRoomDimensions, type MeasurementPosition, type RoomDimensions } from "./measurementPositions";
import { assessCalibration, type CalibrationRecord } from "./calibrationRecords";
import { calculateDelayRecommendations, type AlignmentMeasurement } from "./delayPhaseAnalysis";
import { buildAcousticReport } from "./acousticReport";

const DEFAULT_ROOM: RoomDimensions = { lengthM: 28, widthM: 16, heightM: 7 };
export default function MeasurementWorkflowPanel() {
  const [room, setRoom] = usePersistentState<RoomDimensions>("church-audio-room-dimensions-v120", DEFAULT_ROOM);
  const [roomId, setRoomId] = usePersistentState("church-audio-room-id-v120", "SANCTUARY");
  const [positions, setPositions] = usePersistentState<MeasurementPosition[]>("church-audio-measurement-positions-v120", []);
  const [calibrations, setCalibrations] = usePersistentState<CalibrationRecord[]>("church-audio-calibration-records-v121", []);
  const [label, setLabel] = useState("Vị trí đo mới"), [zoneId, setZoneId] = useState("ZONE-1");
  const [coords, setCoords] = useState({ xM: 8, yM: 8, zM: 1.2 });
  const [micId, setMicId] = useState("measurement-mic"), [serial, setSerial] = useState(""), [measured, setMeasured] = useState(93.8), [refLevel, setRefLevel] = useState<94|114>(94);
  const [alignments, setAlignments] = useState<AlignmentMeasurement[]>([]);
  const roomCheck = useMemo(() => validateRoomDimensions(room), [room]);
  const calibrationStatus = calibrations.map((item) => ({ item, assessment: assessCalibration(item) }));
  const addPosition = () => {
    const position: MeasurementPosition = { id: `pos-${Date.now()}`, roomId, zoneId, label, ...coords, createdAt: new Date().toISOString() };
    try { setPositions((old) => upsertMeasurementPosition(old, position, room)); } catch (error) { window.alert(error instanceof Error ? error.message : "Vị trí không hợp lệ."); }
  };
  const addCalibration = () => {
    const now = new Date(), record: CalibrationRecord = { id: `cal-${Date.now()}`, microphoneId: micId, serialNumber: serial, referenceLevelDbSpl: refLevel, measuredLevelDbSpl: measured, correctionDb: refLevel-measured, calibratedAt: now.toISOString(), expiresAt: new Date(now.getTime()+365*86400000).toISOString() };
    const result = assessCalibration(record);
    if (result.status !== "valid") { window.alert(result.reason); return; }
    setCalibrations((old) => [...old, record]);
  };
  const exportReport = () => {
    const report = buildAcousticReport({ reportId: `report-${Date.now()}`, roomId, sessionId: "POSITION-CALIBRATION-REGISTER", createdAt: new Date().toISOString(), positions, calibrations, readings: [] });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = "church-audio-measurement-register.json"; anchor.click(); URL.revokeObjectURL(url);
  };
  const delayRows = alignments.length ? calculateDelayRecommendations(alignments, alignments[0].speakerId) : [];
  return <section className="panel measurement-workflow-panel">
    <div className="heading"><MapPin/><h2>Measurement Workflow · v1.20–v1.24</h2><span>POSITION / CAL / ALIGN</span></div>
    <p className="muted">Quản lý tọa độ khảo sát, hồ sơ hiệu chuẩn và phép tính căn chỉnh. Dữ liệu đăng ký không tự biến thành phép đo SPL thực; vị trí 3D và số đo phải được xác nhận tại hiện trường.</p>
    <div className="form-grid">
      <label>MÃ PHÒNG<input value={roomId} onChange={e=>setRoomId(e.target.value)} /></label>
      <label>CHIỀU DÀI (m)<input type="number" min="2" max="200" value={room.lengthM} onChange={e=>setRoom(v=>({...v,lengthM:+e.target.value}))}/></label>
      <label>CHIỀU RỘNG (m)<input type="number" min="2" max="120" value={room.widthM} onChange={e=>setRoom(v=>({...v,widthM:+e.target.value}))}/></label>
      <label>CHIỀU CAO (m)<input type="number" min="2" max="50" value={room.heightM} onChange={e=>setRoom(v=>({...v,heightM:+e.target.value}))}/></label>
    </div>
    {!roomCheck.valid && <p className="warning">{roomCheck.errors.join(" ")}</p>}
    <div className="heading"><MapPin/><h3>v1.20 · Vị trí đo theo tọa độ X/Y/Z</h3></div>
    <div className="form-grid">
      <label>TÊN VỊ TRÍ<input value={label} onChange={e=>setLabel(e.target.value)}/></label><label>MÃ VÙNG<input value={zoneId} onChange={e=>setZoneId(e.target.value)}/></label>
      {(["xM","yM","zM"] as const).map(key=><label>{key.toUpperCase()} (m)<input type="number" step="0.1" value={coords[key]} onChange={e=>setCoords(v=>({...v,[key]:+e.target.value}))}/></label>)}
    </div>
    <button type="button" disabled={!roomCheck.valid} onClick={addPosition}><Plus/> Lưu vị trí</button>
    {positions.length>0&&<div className="table-wrap"><table><thead><tr><th>Vị trí</th><th>Vùng</th><th>X/Y/Z (m)</th><th></th></tr></thead><tbody>{positions.map(p=><tr key={p.id}><td>{p.label}</td><td>{p.zoneId}</td><td>{p.xM.toFixed(1)} / {p.yM.toFixed(1)} / {p.zM.toFixed(1)}</td><td><button className="secondary" onClick={()=>setPositions(old=>old.filter(x=>x.id!==p.id))}>Xóa</button></td></tr>)}</tbody></table></div>}
    <div className="heading"><ShieldCheck/><h3>v1.21 · Hồ sơ hiệu chuẩn microphone</h3></div>
    <div className="form-grid"><label>MÃ MICRO<input value={micId} onChange={e=>setMicId(e.target.value)}/></label><label>SỐ SERIAL<input value={serial} onChange={e=>setSerial(e.target.value)}/></label><label>MỨC THAM CHIẾU<select value={refLevel} onChange={e=>setRefLevel(+e.target.value as 94|114)}><option value={94}>94 dB SPL</option><option value={114}>114 dB SPL</option></select></label><label>MỨC ĐỌC (dB SPL)<input type="number" value={measured} onChange={e=>setMeasured(+e.target.value)}/></label></div>
    <button type="button" onClick={addCalibration}><Plus/> Lưu hồ sơ kiểm tra</button>
    {calibrationStatus.map(({item,assessment})=><p className="device-notice" key={item.id}>{item.microphoneId} · {item.serialNumber} · offset {item.correctionDb.toFixed(2)} dB · {assessment.status.toUpperCase()} — {assessment.reason}</p>)}
    <div className="heading"><Timer/><h3>v1.23 · Căn chỉnh delay / phase</h3></div>
    <p className="muted">Bảng tính hiện có API tính delay hình học và kiểm tra điều kiện so sánh pha cùng phiên, thiết bị vào và tần số. Chưa tự lấy impulse response từ phần cứng trong màn hình này.</p>
    <div className="form-grid"><label>ID LOA<input id="align-speaker" placeholder="MAIN-L"/></label><label>Khoảng cách (m)<input id="align-distance" type="number" min="0" step="0.1" defaultValue="10"/></label><button type="button" onClick={()=>{const id=(document.getElementById("align-speaker") as HTMLInputElement)?.value.trim(),distance=+(document.getElementById("align-distance") as HTMLInputElement)?.value;if(id&&Number.isFinite(distance)&&distance>=0)setAlignments(old=>[...old,{speakerId:id,distanceM:distance,sessionId:"GEOMETRIC-DRAFT"}]);}}>Thêm loa</button></div>
    {delayRows.length>0&&<div className="table-wrap"><table><thead><tr><th>Loa</th><th>Delay hình học</th><th>Trạng thái</th></tr></thead><tbody>{delayRows.map(row=><tr key={row.speakerId}><td>{row.speakerId}</td><td>{row.geometricDelayMs.toFixed(2)} ms</td><td>{row.status}</td></tr>)}</tbody></table></div>}
    <div className="actions"><button type="button" className="secondary" onClick={exportReport}><Download/> Xuất hồ sơ JSON</button></div>
    <p className="warning">v1.22: dữ liệu tọa độ sẵn sàng cho bước ánh xạ điểm đo lên scene 3D; chưa tự động đọc tọa độ từ đối tượng kéo-thả trong RoomPlanner3D. v1.24: xuất hồ sơ đăng ký JSON, chưa phải báo cáo nghiệm thu PDF hoặc giao thức ghi DSP.</p>
  </section>;
}
