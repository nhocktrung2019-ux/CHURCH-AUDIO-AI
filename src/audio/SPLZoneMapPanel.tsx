import { useMemo } from "react";
import { Plus, RotateCcw, Target, Volume2 } from "lucide-react";
import { usePersistentState } from "./usePersistentState";

type SPLZone = {
  id: number;
  name: string;
  x: number;
  y: number;
  splDb: number | null;
  note: string;
};

const initialZones: SPLZone[] = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1,
  name: `Vùng ${index + 1}`,
  x: index % 3,
  y: Math.floor(index / 3),
  splDb: null,
  note: "",
}));

const energyAverage = (values: number[]) =>
  values.length
    ? 10 * Math.log10(values.reduce((sum, value) => sum + 10 ** (value / 10), 0) / values.length)
    : null;

const zoneTone = (value: number | null, target: number) => {
  if (value === null) return "unmeasured";
  const delta = value - target;
  if (delta < -6) return "low";
  if (delta > 6) return "high";
  return "balanced";
};

export default function SPLZoneMapPanel() {
  const [zones, setZones] = usePersistentState<SPLZone[]>("church-audio-spl-zones-v076", initialZones);
  const [target, setTarget] = usePersistentState<number>("church-audio-spl-target-v076", 85);
  const measured = zones.filter((zone) => zone.splDb !== null && Number.isFinite(zone.splDb));
  const values = measured.map((zone) => zone.splDb as number);
  const stats = useMemo(() => {
    if (!values.length) return { average: null as number | null, min: null as number | null, max: null as number | null, spread: null as number | null };
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { average: energyAverage(values), min, max, spread: max - min };
  }, [zones]);
  const updateZone = (id: number, patch: Partial<SPLZone>) =>
    setZones((current) => current.map((zone) => zone.id === id ? { ...zone, ...patch } : zone));
  const addZone = () => {
    const id = Math.max(0, ...zones.map((zone) => zone.id)) + 1;
    setZones((current) => [...current, { id, name: `Vùng ${id}`, x: (id - 1) % 3, y: Math.floor((id - 1) / 3), splDb: null, note: "" }]);
  };
  const resetReadings = () =>
    setZones((current) => current.map((zone) => ({ ...zone, splDb: null, note: "" })));

  return (
    <section className="panel spl-zone-panel">
      <div className="heading"><Volume2 /><h2>Bản đồ SPL từng vùng · v0.76</h2><span>ZONE ANALYSIS</span></div>
      <p className="muted">Nhập số đo tại từng vị trí nghe sau khi đo bằng microphone và chuỗi đo đã hiệu chuẩn. Bản đồ này tổng hợp số đo thực nhập; không tự suy diễn SPL từ dBFS hoặc thay thế phép đo tại hiện trường.</p>
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
        <span><i className="unmeasured" /> Chưa đo</span>
      </div>
      <div className="spl-zone-map" aria-label="Bản đồ vị trí đo SPL theo vùng">
        {zones.map((zone) => (
          <article className={`spl-zone-card ${zoneTone(zone.splDb, target)}`} key={zone.id}>
            <div className="spl-zone-card-head">
              <label>TÊN VÙNG<input aria-label={`Tên vùng ${zone.id}`} value={zone.name} onChange={(event) => updateZone(zone.id, { name: event.target.value })} /></label>
              <span>{zone.splDb === null ? "CHƯA ĐO" : `${zone.splDb.toFixed(1)} dB`}</span>
            </div>
            <label>MỨC ĐO (dB SPL)
              <input type="number" min="30" max="140" step="0.1" placeholder="Nhập số đo" value={zone.splDb ?? ""} onChange={(event) => updateZone(zone.id, { splDb: event.target.value === "" ? null : Math.max(30, Math.min(140, Number(event.target.value))) })} />
            </label>
            <label>GHI CHÚ
              <input value={zone.note} placeholder="Vị trí / điều kiện đo" onChange={(event) => updateZone(zone.id, { note: event.target.value })} />
            </label>
            <small>Chênh mục tiêu: {zone.splDb === null ? "—" : `${zone.splDb - target > 0 ? "+" : ""}${(zone.splDb - target).toFixed(1)} dB`}</small>
          </article>
        ))}
      </div>
      <div className="spl-zone-summary">
        <article><small>ĐÃ ĐO</small><strong>{measured.length}/{zones.length}</strong></article>
        <article><small>TRUNG BÌNH NĂNG LƯỢNG</small><strong>{stats.average === null ? "—" : `${stats.average.toFixed(1)} dB`}</strong></article>
        <article><small>THẤP NHẤT / CAO NHẤT</small><strong>{stats.min === null ? "—" : `${stats.min.toFixed(1)} / ${stats.max?.toFixed(1)}`}</strong></article>
        <article><small>ĐỘ CHÊNH VÙNG</small><strong>{stats.spread === null ? "—" : `${stats.spread.toFixed(1)} dB`}</strong></article>
      </div>
      {stats.spread !== null && (
        <div className={stats.spread <= 6 ? "spl-zone-result good" : "spl-zone-result warning"}>
          <Target />
          <div><b>{stats.spread <= 6 ? "Độ chênh đang trong ngưỡng tham chiếu 6 dB" : "Cần kiểm tra độ đồng đều giữa các vùng"}</b>
          <small>So sánh chỉ có ý nghĩa khi các vị trí được đo cùng weighting, time weighting, mức phát và cùng chuỗi microphone đã hiệu chuẩn.</small></div>
        </div>
      )}
      <p className="warning">Lưu ý: giá trị trung bình dùng phép cộng năng lượng, không phải trung bình số học. Độ chênh min–max là chỉ số sàng lọc sơ bộ, không phải chứng nhận tiêu chuẩn độ phủ.</p>
    </section>
  );
}
