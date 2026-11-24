import { useMemo } from "react";
import { Plus, RotateCcw, Target, Volume2 } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { analyzeSplUniformity, type SplCalibrationState, type SplWeighting } from "./splUniformity";

type SPLZone = {
  id: number;
  name: string;
  x: number;
  y: number;
  splDb: number | null;
  note: string;
  calibration?: SplCalibrationState;
  weighting?: SplWeighting;
};

const initialZones: SPLZone[] = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1,
  name: `Vùng ${index + 1}`,
  x: index % 3,
  y: Math.floor(index / 3),
  splDb: null,
  note: "",
  calibration: "uncalibrated",
  weighting: "A",
}));

const zoneTone = (zone: SPLZone, target: number) => {
  if (zone.splDb === null) return "unmeasured";
  // Older saved readings have no provenance and must not be assumed calibrated.
  if (zone.calibration !== "calibrated") return "uncalibrated";
  const delta = zone.splDb - target;
  if (delta < -6) return "low";
  if (delta > 6) return "high";
  return "balanced";
};

export default function SPLZoneMapPanel() {
  const [zones, setZones] = usePersistentState<SPLZone[]>("church-audio-spl-zones-v076", initialZones);
  const [target, setTarget] = usePersistentState<number>("church-audio-spl-target-v076", 85);
  const measured = zones.filter((zone) => zone.splDb !== null && Number.isFinite(zone.splDb));
  const analysis = useMemo(
    () =>
      analyzeSplUniformity(
        zones.map((zone) => ({
          splDb: zone.splDb,
          calibration: zone.calibration === "calibrated" ? "calibrated" : "uncalibrated",
          weighting: zone.weighting ?? "A",
        })),
        target,
      ),
    [zones, target],
  );

  const updateZone = (id: number, patch: Partial<SPLZone>) =>
    setZones((current) => current.map((zone) => zone.id === id ? { ...zone, ...patch } : zone));
  const addZone = () => {
    const id = Math.max(0, ...zones.map((zone) => zone.id)) + 1;
    setZones((current) => [
      ...current,
      {
        id,
        name: `Vùng ${id}`,
        x: (id - 1) % 3,
        y: Math.floor((id - 1) / 3),
        splDb: null,
        note: "",
        calibration: "uncalibrated",
        weighting: "A",
      },
    ]);
  };
  const resetReadings = () =>
    setZones((current) =>
      current.map((zone) => ({
        ...zone,
        splDb: null,
        note: "",
        calibration: "uncalibrated",
      })),
    );

  return (
    <section className="panel spl-zone-panel">
      <div className="heading"><Volume2 /><h2>Bản đồ SPL từng vùng · v1.02</h2><span>INTELLIGENT SPL MAPPING</span></div>
      <p className="muted">Nhập số đo tại từng vị trí nghe. Chỉ các bản ghi được người vận hành xác nhận đã hiệu chuẩn mới tham gia thống kê độ đồng đều. Dữ liệu cũ chưa có thông tin hiệu chuẩn được xem là chưa xác minh.</p>
      <div className="spl-zone-toolbar">
        <label>MỨC MỤC TIÊU (dB SPL)
          <input type="number" min="40" max="120" step="0.5" value={target} onChange={(event) => setTarget(Math.max(40, Math.min(120, Number(event.target.value) || 85)))} />
        </label>
        <div className="spl-zone-actions">
          <button type="button" onClick={addZone}><Plus /> Thêm vùng</button>
          <button type="button" className="secondary" onClick={resetReadings}><RotateCcw /> Xóa số đo</button>
        </div>
      </div>
      <div className="spl-zone-legend">
        <span><i className="low" /> Thấp hơn mục tiêu &gt; 6 dB</span>
        <span><i className="balanced" /> Trong khoảng ±6 dB</span>
        <span><i className="high" /> Cao hơn mục tiêu &gt; 6 dB</span>
        <span><i className="uncalibrated" /> Chưa xác minh hiệu chuẩn</span>
        <span><i className="unmeasured" /> Chưa đo</span>
      </div>
      <div className="spl-zone-map" aria-label="Bản đồ vị trí đo SPL theo vùng">
        {zones.map((zone) => (
          <article className={`spl-zone-card ${zoneTone(zone, target)}`} key={zone.id}>
            <div className="spl-zone-card-head">
              <label>TÊN VÙNG<input aria-label={`Tên vùng ${zone.id}`} value={zone.name} onChange={(event) => updateZone(zone.id, { name: event.target.value })} /></label>
              <span>{zone.splDb === null ? "CHƯA ĐO" : `${zone.splDb.toFixed(1)} dB`}</span>
            </div>
            <label>MỨC ĐO (dB SPL)
              <input type="number" min="30" max="140" step="0.1" placeholder="Nhập số đo" value={zone.splDb ?? ""} onChange={(event) => updateZone(zone.id, { splDb: event.target.value === "" ? null : Math.max(30, Math.min(140, Number(event.target.value))) })} />
            </label>
            <div className="spl-zone-meta">
              <label>TRẠNG THÁI HIỆU CHUẨN
                <select value={zone.calibration ?? "uncalibrated"} onChange={(event) => updateZone(zone.id, { calibration: event.target.value as SplCalibrationState })}>
                  <option value="uncalibrated">Chưa xác minh</option>
                  <option value="calibrated">Đã hiệu chuẩn</option>
                </select>
              </label>
              <label>WEIGHTING
                <select value={zone.weighting ?? "A"} onChange={(event) => updateZone(zone.id, { weighting: event.target.value as SplWeighting })}>
                  <option value="A">A-weighting</option>
                  <option value="C">C-weighting</option>
                  <option value="Z">Z / Flat</option>
                </select>
              </label>
            </div>
            <label>GHI CHÚ
              <input value={zone.note} placeholder="Vị trí / điều kiện đo" onChange={(event) => updateZone(zone.id, { note: event.target.value })} />
            </label>
            <small>Chênh mục tiêu: {zone.splDb === null ? "—" : `${zone.splDb - target > 0 ? "+" : ""}${(zone.splDb - target).toFixed(1)} dB`} · {zone.calibration === "calibrated" ? "ĐÃ XÁC NHẬN" : "CHƯA XÁC MINH"}</small>
          </article>
        ))}
      </div>
      <div className="spl-zone-summary">
        <article><small>ĐÃ NHẬP / ĐÃ HIỆU CHUẨN</small><strong>{measured.length}/{analysis.count}</strong></article>
        <article><small>TRUNG BÌNH NĂNG LƯỢNG</small><strong>{analysis.energyAverageDb === null ? "—" : `${analysis.energyAverageDb.toFixed(1)} dB`}</strong></article>
        <article><small>THẤP NHẤT / CAO NHẤT</small><strong>{analysis.minimumDb === null ? "—" : `${analysis.minimumDb.toFixed(1)} / ${analysis.maximumDb?.toFixed(1)}`}</strong></article>
        <article><small>ĐỘ CHÊNH MIN–MAX</small><strong>{analysis.spreadDb === null ? "—" : `${analysis.spreadDb.toFixed(1)} dB`}</strong></article>
        <article><small>ĐỘ LỆCH CHUẨN</small><strong>{analysis.standardDeviationDb === null ? "—" : `${analysis.standardDeviationDb.toFixed(2)} dB`}</strong></article>
        <article><small>TRONG ±3 dB / ±6 dB</small><strong>{analysis.count ? `${analysis.within3Db}/${analysis.count} · ${analysis.within6Db}/${analysis.count}` : "—"}</strong></article>
      </div>
      {analysis.count > 0 && !analysis.comparable && (
        <div className="spl-zone-result warning">
          <Target />
          <div><b>Không thể gộp thống kê độ đồng đều</b><small>Các vùng đang dùng weighting khác nhau. Hãy đo lại hoặc chọn cùng weighting cho toàn bộ phiên đo.</small></div>
        </div>
      )}
      {analysis.count > 0 && analysis.comparable && analysis.spreadDb !== null && (
        <div className={analysis.spreadDb <= 6 ? "spl-zone-result good" : "spl-zone-result warning"}>
          <Target />
          <div>
            <b>{analysis.spreadDb <= 6 ? "Độ chênh min–max không vượt 6 dB" : "Cần kiểm tra độ đồng đều giữa các vùng"}</b>
            <small>{analysis.count} vùng đã hiệu chuẩn · Weighting {analysis.weighting} · Lệch trung bình năng lượng so với mục tiêu: {analysis.targetOffsetDb?.toFixed(1)} dB</small>
          </div>
        </div>
      )}
      <p className="warning">Chỉ số ±3/±6 dB và độ lệch chuẩn là công cụ sàng lọc, không phải chứng nhận tiêu chuẩn phủ âm. Trạng thái hiệu chuẩn do người vận hành xác nhận; phiên bản này chưa tự thu SPL theo từng vùng từ microphone và chưa tạo heatmap SPL 3D.</p>
    </section>
  );
}
