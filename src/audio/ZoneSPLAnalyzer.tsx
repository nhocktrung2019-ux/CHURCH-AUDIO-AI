import { useMemo, useState } from "react";
import { Activity, MapPin, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { summarizeSPLZones, type SPLZoneReading } from "./splZones";

type Props = { liveLevelDb: number; offsetDb: number; running: boolean };
const DEFAULT_ZONES = ["Khu vực 1", "Khu vực 2", "Khu vực 3", "Khu vực 4", "Khu vực 5", "Khu vực 6", "Khu vực 7", "Khu vực 8", "Khu vực 9"];

export default function ZoneSPLAnalyzer({ liveLevelDb, offsetDb, running }: Props) {
  const [zones, setZones] = useState(DEFAULT_ZONES);
  const [selectedZone, setSelectedZone] = useState(DEFAULT_ZONES[0]);
  const [customZone, setCustomZone] = useState("");
  const [readings, setReadings] = useState<SPLZoneReading[]>([]);
  const calibrated = Math.abs(offsetDb) > 0.001;
  const level = Number.isFinite(liveLevelDb) ? liveLevelDb + offsetDb : Number.NaN;
  const summary = useMemo(() => summarizeSPLZones(readings), [readings]);

  const capture = () => {
    if (!running || !Number.isFinite(level) || level <= -99) return;
    setReadings((current) => [
      ...current.filter((item) => item.zone !== selectedZone),
      {
        id: `${selectedZone}-${Date.now()}`,
        zone: selectedZone,
        levelDb: level,
        capturedAt: new Date().toISOString(),
        calibrated,
      },
    ]);
  };

  const addZone = () => {
    const name = customZone.trim();
    if (!name || zones.some((zone) => zone.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    setZones((current) => [...current, name]);
    setSelectedZone(name);
    setCustomZone("");
  };

  return <section className="panel zone-spl-panel">
    <div className="heading"><MapPin /><h2>Smart SPL Zone Analyzer · Đo từng vùng loa</h2><span>{readings.length}/{zones.length} ZONES</span></div>
    <p className="muted">Đặt micro tại một vị trí cố định trong từng vùng, chờ mức tín hiệu ổn định rồi ghi nhận. Mỗi vùng lưu một kết quả gần nhất trong phiên hiện tại.</p>
    <div className="zone-capture-grid">
      <label>VÙNG ĐANG ĐO
        <select value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)}>
          {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </select>
      </label>
      <div className="zone-live-value"><small>MỨC ĐANG ĐỌC</small><strong>{Number.isFinite(level) && level > -99 ? level.toFixed(1) : "—"} <small>{calibrated ? "dB SPL" : "dBFS"}</small></strong></div>
    </div>
    <div className="zone-actions">
      <button type="button" disabled={!running || !Number.isFinite(level) || level <= -99} onClick={capture}><Save /> Ghi nhận vùng này</button>
      <button type="button" className="secondary" onClick={() => setReadings([])} disabled={!readings.length}><RotateCcw /> Xóa phiên đo</button>
    </div>
    <div className="zone-add-row">
      <input value={customZone} onChange={(event) => setCustomZone(event.target.value)} placeholder="Thêm vùng: ban công, cánh trái..." aria-label="Tên vùng mới" />
      <button type="button" className="secondary" onClick={addZone} disabled={!customZone.trim()}><Plus /> Thêm vùng</button>
    </div>
    {summary && <div className="zone-summary-grid">
      <article><small>SỐ VÙNG ĐÃ ĐO</small><b>{summary.count}</b></article>
      <article><small>THẤP NHẤT</small><b>{summary.minimumDb.toFixed(1)} dB</b></article>
      <article><small>CAO NHẤT</small><b>{summary.maximumDb.toFixed(1)} dB</b></article>
      <article><small>CHÊNH LỆCH</small><b>{summary.spreadDb.toFixed(1)} dB</b></article>
    </div>}
    <div className="table-wrap"><table>
      <thead><tr><th>KHU VỰC</th><th>MỨC ĐO</th><th>GỢI Ý GAIN</th><th>TRẠNG THÁI</th><th></th></tr></thead>
      <tbody>{zones.map((zone) => {
        const reading = readings.find((item) => item.zone === zone);
        const recommendation = summary?.recommendations.find((item) => item.zone === zone);
        return <tr key={zone}>
          <td>{zone}</td>
          <td>{reading ? `${reading.levelDb.toFixed(1)} ${reading.calibrated ? "dB SPL" : "dBFS"}` : "—"}</td>
          <td>{recommendation ? `${recommendation.gainSuggestionDb > 0 ? "+" : ""}${recommendation.gainSuggestionDb.toFixed(1)} dB` : "—"}</td>
          <td>{reading ? "Đã ghi nhận" : "Chưa đo"}</td>
          <td>{reading && <button type="button" className="icon-button" aria-label={`Xóa ${zone}`} onClick={() => setReadings((current) => current.filter((item) => item.zone !== zone))}><Trash2 /></button>}</td>
        </tr>;
      })}</tbody>
    </table></div>
    {summary && <div className="zone-balance-note"><Activity /> Trung vị mục tiêu: <b>{summary.targetDb.toFixed(1)} dB</b> · Trung bình năng lượng: <b>{summary.energyAverageDb.toFixed(1)} dB</b></div>}
    <p className="warning">{calibrated ? "Đang dùng hiệu chỉnh offset một điểm; cần xác nhận toàn bộ chuỗi microphone và calibrator trước khi coi là SPL tham chiếu." : "Chưa có hiệu chỉnh SPL: các kết quả đang hiển thị dBFS tương đối, không phải dB SPL. Gợi ý Gain chỉ mang tính tham khảo, giới hạn ±6 dB và không tự ghi vào DSP."} Đo lần lượt tại các vị trí; không di chuyển micro trong khi ghi nhận.</p>
  </section>;
}
