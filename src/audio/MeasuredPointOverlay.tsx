import { useMemo, useState } from "react";
import { MapPin, Plus, Trash2, ShieldCheck } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { getVerifiedMeasuredPoints, isMeasuredPointInsideRoom, isValidMeasuredSpl, type MeasuredPoint, type CalibrationState, type Weighting } from "./measuredPointModel";


export default function MeasuredPointOverlay() {
  const [length] = usePersistentState("church-audio-room-length", 28);
  const [width] = usePersistentState("church-audio-room-width", 16);
  const [height] = usePersistentState("church-audio-room-height", 7);
  const [refX] = usePersistentState("church-audio-room-ref-x", 22);
  const [refY] = usePersistentState("church-audio-room-ref-y", 8);
  const [points, setPoints] = usePersistentState<MeasuredPoint[]>("church-audio-measured-points-v103", []);
  const [label, setLabel] = useState("");
  const [x, setX] = useState(refX);
  const [y, setY] = useState(refY);
  const [z, setZ] = useState(1.2);
  const [splDb, setSplDb] = useState("");
  const [calibration, setCalibration] = useState<CalibrationState>("uncalibrated");
  const [weighting, setWeighting] = useState<Weighting>("A");
  const [inputLabel, setInputLabel] = useState("");
  const [note, setNote] = useState("");

  const validPoints = useMemo(
    () => points.filter((point) => isMeasuredPointInsideRoom(point, { length, width, height })),
    [points, length, width, height],
  );
  const verified = getVerifiedMeasuredPoints(points, { length, width, height });

  const parsedSplDb = splDb === "" ? null : Number(splDb);

  const addPoint = () => {
    if (!isValidMeasuredSpl(parsedSplDb)) return;
    const next: MeasuredPoint = {
      id: `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: label.trim() || `Điểm đo ${points.length + 1}`,
      x, y, z, splDb: parsedSplDb, calibration, weighting,
      inputLabel: inputLabel.trim(), note: note.trim(), capturedAt: new Date().toISOString(),
    };
    setPoints((current) => [...current, next]);
    setLabel("");
    setSplDb("");
    setNote("");
  };

  const removePoint = (id: string) => setPoints((current) => current.filter((point) => point.id !== id));

  return <section className="panel measured-point-panel">
    <div className="heading"><MapPin /><h2>Điểm đo thực tế liên kết mô hình phòng · v1.03</h2><span>MEASURED POINTS</span></div>
    <p className="muted">Mỗi bản ghi có ID ổn định và tọa độ X/Y/Z theo mét trong phòng hiện tại. Đây là nhập số đo thủ công có lưu nguồn; chưa tự thu microphone. Chỉ bản ghi được xác nhận hiệu chuẩn mới được đánh dấu là SPL đã xác minh.</p>
    <div className="measured-point-summary">
      <article><small>TỔNG ĐIỂM LƯU</small><b>{points.length}</b></article>
      <article><small>TRONG KÍCH THƯỚC PHÒNG</small><b>{validPoints.length}</b></article>
      <article><small>ĐÃ HIỆU CHUẨN · CÓ SPL</small><b>{verified.length}</b></article>
    </div>
    <div className="measured-point-map" role="img" aria-label="Bản đồ mặt bằng vị trí các điểm đo đã lưu">
      <svg viewBox="0 0 640 280" preserveAspectRatio="xMidYMid meet">
        <rect x="24" y="18" width="592" height="244" rx="5" fill="#10232d" stroke="#77a99f" strokeWidth="2" />
        {Array.from({ length: 5 }, (_, index) => <line key={`gx-${index}`} x1={24 + (592 * (index + 1)) / 6} y1="18" x2={24 + (592 * (index + 1)) / 6} y2="262" stroke="#29434d" strokeDasharray="4 5" />)}
        {Array.from({ length: 3 }, (_, index) => <line key={`gy-${index}`} x1="24" y1={18 + (244 * (index + 1)) / 4} x2="616" y2={18 + (244 * (index + 1)) / 4} stroke="#29434d" strokeDasharray="4 5" />)}
        {validPoints.map((point) => {
          const px = 24 + (point.x / Math.max(1, length)) * 592;
          const py = 18 + (point.y / Math.max(1, width)) * 244;
          const confirmed = point.calibration === "calibrated" && point.splDb !== null;
          return <g key={point.id}>
            <circle cx={px} cy={py} r="9" fill={confirmed ? "#35b58c" : "#c18b48"} stroke="#f2f7f5" strokeWidth="1.5" />
            <text x={px + 12} y={py - 8} fill="#e7f0ed" fontSize="11">{point.label.slice(0, 18)}</text>
          </g>;
        })}
      </svg>
      <div className="measured-point-axis"><span>X: 0–{length} m</span><span>Y: 0–{width} m</span><span>Z: 0–{height} m</span></div>
    </div>
    <div className="measured-point-form">
      <label>TÊN / VỊ TRÍ ĐO<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ví dụ: Hàng ghế giữa – trái" /></label>
      <label>GIÁ TRỊ ĐO (dB SPL)<input type="number" min="0" max="160" step="0.1" value={splDb} onChange={(event) => setSplDb(event.target.value)} placeholder="Nhập số đo" /></label>
      <label>TỌA ĐỘ X (m)<input type="number" min="0" step="0.1" value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
      <label>TỌA ĐỘ Y (m)<input type="number" min="0" step="0.1" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
      <label>CAO ĐỘ MICRO Z (m)<input type="number" min="0" step="0.1" value={z} onChange={(event) => setZ(Number(event.target.value))} /></label>
      <label>HIỆU CHUẨN<select value={calibration} onChange={(event) => setCalibration(event.target.value as CalibrationState)}><option value="uncalibrated">Chưa xác minh</option><option value="calibrated">Đã hiệu chuẩn chuỗi đo</option></select></label>
      <label>WEIGHTING<select value={weighting} onChange={(event) => setWeighting(event.target.value as Weighting)}><option value="A">A-weighting</option><option value="C">C-weighting</option><option value="Z">Z / Flat</option></select></label>
      <label>MIC / INPUT LABEL<input value={inputLabel} onChange={(event) => setInputLabel(event.target.value)} placeholder="Tên micro / interface" /></label>
      <label className="measured-point-note">GHI CHÚ<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Điều kiện đo, vị trí ghế, mức phát..." /></label>
    </div>
    <button type="button" onClick={addPoint} disabled={!isValidMeasuredSpl(parsedSplDb) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || x < 0 || x > length || y < 0 || y > width || z < 0 || z > height}><Plus /> Lưu điểm đo vào mô hình</button>
    <div className="measured-point-records">
      {points.length === 0 ? <p className="muted">Chưa có điểm đo. Hãy nhập tọa độ và số đo tại hiện trường để tạo bản đồ.</p> : points.map((point) => {
        const inBounds = isMeasuredPointInsideRoom(point, { length, width, height });
        return <article key={point.id} className="measured-point-record">
          <div><b>{point.label}</b><small>{point.id} · X {point.x.toFixed(1)} / Y {point.y.toFixed(1)} / Z {point.z.toFixed(1)} m</small><small>{point.inputLabel || "Chưa ghi nguồn input"} · {point.weighting}-weighting · {new Date(point.capturedAt).toLocaleString("vi-VN")}</small></div>
          <div className="measured-point-value"><b>{point.splDb === null ? "—" : point.splDb.toFixed(1) + " dB"}</b><small>{point.calibration === "calibrated" ? "ĐÃ XÁC NHẬN" : "CHƯA XÁC MINH"}{!inBounds ? " · NGOÀI PHÒNG" : ""}</small></div>
          <button type="button" className="secondary" aria-label={`Xóa ${point.label}`} onClick={() => removePoint(point.id)}><Trash2 /></button>
        </article>;
      })}
    </div>
    <p className="warning"><ShieldCheck /> Tọa độ ngoài giới hạn phòng không được vẽ hoặc tính thống kê. Không tự chuyển dBFS sang dB SPL. Trạng thái hiệu chuẩn do kỹ thuật viên xác nhận, không phải phép xác minh tự động. Dữ liệu điểm đo được lưu riêng, không ghi đè vị trí loa hay các phép đo cũ.</p>
  </section>;
}
