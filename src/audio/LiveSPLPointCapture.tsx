import { useMemo, useState } from "react";
import { Activity, MapPin, Save } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { isMeasuredPointInsideRoom, isValidMeasuredSpl, type MeasuredPoint, type Weighting } from "./measuredPointModel";

type Props = { running: boolean; weightedLevels: { a: number; c: number; z: number }; offsetDb: number; peakDbfs: number; inputLabel: string; };

export default function LiveSPLPointCapture({ running, weightedLevels, offsetDb, peakDbfs, inputLabel }: Props) {
  const [length] = usePersistentState("church-audio-room-length", 28);
  const [width] = usePersistentState("church-audio-room-width", 16);
  const [height] = usePersistentState("church-audio-room-height", 7);
  const [, setPoints] = usePersistentState<MeasuredPoint[]>("church-audio-measured-points-v103", []);
  const [label, setLabel] = useState("");
  const [x, setX] = useState(14); const [y, setY] = useState(8); const [z, setZ] = useState(1.2);
  const [weighting, setWeighting] = useState<Weighting>("A"); const [note, setNote] = useState("");
  const liveDbfs = weightedLevels[weighting.toLowerCase() as "a" | "c" | "z"];
  const calibrated = Number.isFinite(offsetDb) && Math.abs(offsetDb) > 0.001;
  const clipped = Number.isFinite(peakDbfs) && peakDbfs >= -0.1;
  const splDb = Number.isFinite(liveDbfs) && liveDbfs > -99 && calibrated && !clipped ? liveDbfs + offsetDb : null;
  const candidate: MeasuredPoint = useMemo(() => ({ id: "live-candidate", label: label.trim() || "Live SPL point", x, y, z, splDb, calibration: calibrated ? "calibrated" : "uncalibrated", weighting, inputLabel, note, capturedAt: new Date().toISOString() }), [label, x, y, z, splDb, calibrated, weighting, inputLabel, note]);
  const inBounds = isMeasuredPointInsideRoom(candidate, { length, width, height });
  const canSave = running && calibrated && !clipped && isValidMeasuredSpl(splDb) && inBounds;
  const savePoint = () => {
    if (!canSave || splDb === null) return;
    const record: MeasuredPoint = { ...candidate, id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, splDb: Math.round(splDb * 10) / 10, capturedAt: new Date().toISOString(), note: [note.trim(), "Captured from live microphone stream; SPL uses active one-point calibration offset."].filter(Boolean).join(" ") };
    setPoints(current => [...current, record]); setLabel(""); setNote("");
  };
  return <section className="panel live-spl-point-capture">
    <div className="heading"><MapPin /><h2>Live SPL → 3D Measurement Point · v1.11</h2><span>{running ? "LIVE INPUT" : "MIC STOPPED"}</span></div>
    <p className="muted">Chụp mức âm hiện tại từ microphone đang chạy và lưu vào kho điểm đo của mô hình phòng 3D. Tọa độ do kỹ thuật viên nhập, không tự suy đoán.</p>
    <div className="measured-point-summary"><article><small>LIVE LEVEL</small><b>{splDb === null ? "—" : splDb.toFixed(1) + " dB SPL"}</b></article><article><small>CALIBRATION</small><b>{calibrated ? "OFFSET ACTIVE" : "NOT CALIBRATED"}</b></article><article><small>INPUT PEAK</small><b>{Number.isFinite(peakDbfs) && peakDbfs > -99 ? peakDbfs.toFixed(1) + " dBFS" : "—"}</b></article></div>
    <div className="measured-point-form">
      <label>VÙNG / VỊ TRÍ<input value={label} onChange={event => setLabel(event.target.value)} placeholder="Ví dụ: Zone 1 – hàng ghế giữa" /></label>
      <label>WEIGHTING<select value={weighting} onChange={event => setWeighting(event.target.value as Weighting)}><option value="A">A-weighting</option><option value="C">C-weighting</option><option value="Z">Z / Flat</option></select></label>
      <label>TỌA ĐỘ X (m)<input type="number" min="0" max={length} step="0.1" value={x} onChange={event => setX(Number(event.target.value))} /></label>
      <label>TỌA ĐỘ Y (m)<input type="number" min="0" max={width} step="0.1" value={y} onChange={event => setY(Number(event.target.value))} /></label>
      <label>CAO ĐỘ MICRO Z (m)<input type="number" min="0" max={height} step="0.1" value={z} onChange={event => setZ(Number(event.target.value))} /></label>
      <label>GHI CHÚ<input value={note} onChange={event => setNote(event.target.value)} placeholder="Mức phát, điều kiện đo..." /></label>
    </div>
    <button type="button" disabled={!canSave} onClick={savePoint}><Save /> Lưu số đo live vào bản đồ 3D</button>
    {!running && <p className="warning"><Activity /> Hãy bật microphone trước khi chụp điểm đo.</p>}
    {running && !calibrated && <p className="warning">Chưa có offset hiệu chuẩn. Kết quả không được lưu thành dB SPL đã hiệu chuẩn.</p>}
    {clipped && <p className="warning">Đầu vào gần 0 dBFS, có nguy cơ clipping. Giảm gain và đo lại.</p>}
    {running && calibrated && !clipped && !inBounds && <p className="warning">Tọa độ phải nằm trong kích thước phòng hiện tại.</p>}
    <p className="muted">Nguồn: {inputLabel || "Microphone mặc định"} · Điểm đo mới được thêm, không ghi đè dữ liệu cũ.</p>
  </section>;
}