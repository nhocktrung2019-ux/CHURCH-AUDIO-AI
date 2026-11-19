import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeftRight, Ruler, ShieldAlert } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import {
  analyzeMeasuredDistanceAttenuation, analyzeSeatRowUniformity, buildZoneTrimAdvisory,
  compareMeasuredZonePair, type SpeakerReference,
} from "./spatialSurveyAnalysis";
import type { ZoneSplRecord } from "./zoneSplUniformity";

export default function SpatialSurveyAnalysisPanel() {
  const [records, setRecords] = usePersistentState<ZoneSplRecord[]>("church-audio-zone-spl-records-v1", []);
  const [speakers] = usePersistentState<SpeakerReference[]>("church-audio-room-speakers", []);
  const [zoneA, setZoneA] = useState("");
  const [zoneB, setZoneB] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [earHeight, setEarHeight] = useState(1.2);

  useEffect(() => {
    const refresh = () => {
      try {
        const stored = window.localStorage.getItem("church-audio-zone-spl-records-v1");
        if (stored !== null) setRecords(JSON.parse(stored) as ZoneSplRecord[]);
      } catch { /* keep last valid in-memory survey */ }
    };
    window.addEventListener("church-audio-zone-spl-records-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("church-audio-zone-spl-records-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [setRecords]);

  const zones = useMemo(() => [...new Set(records.map(record => record.zone.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [records]);
  const selectedA = zoneA || zones[0] || "";
  const selectedB = zoneB || zones.find(zone => zone !== selectedA) || "";
  const comparison = useMemo(() => compareMeasuredZonePair(records, selectedA, selectedB), [records, selectedA, selectedB]);
  const trim = useMemo(() => buildZoneTrimAdvisory(comparison), [comparison]);
  const rowSummaries = useMemo(() => analyzeSeatRowUniformity(records), [records]);
  const selectedSpeaker = speakers.find(speaker => String(speaker.id) === speakerId) ?? speakers[0];
  const attenuation = useMemo(() => selectedSpeaker
    ? analyzeMeasuredDistanceAttenuation(records, selectedSpeaker, earHeight)
    : null, [records, selectedSpeaker, earHeight]);

  return <section className="panel spatial-analysis-panel">
    <div className="heading"><Activity /><h2>Phân tích SPL đa vùng · v0.81–v0.85</h2><span>READ ONLY</span></div>
    <p className="muted">Bản đồ đo 3D dùng overlay trên mặt sàn mô hình hiện có. Các phép so sánh bên dưới chỉ dùng bản ghi dB SPL đã hiệu chuẩn cùng đầu vào và offset; không trộn dBFS, mô phỏng hay dữ liệu thiếu tọa độ.</p>

    <div className="spatial-analysis-block">
      <div className="heading"><ArrowLeftRight /><h3>So sánh hai vùng đo · Main L/R hoặc bất kỳ cặp vùng nào</h3></div>
      <div className="spatial-analysis-controls">
        <label>VÙNG THAM CHIẾU
          <select value={selectedA} onChange={event => setZoneA(event.target.value)}>
            {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </label>
        <label>VÙNG ĐỐI CHIẾU
          <select value={selectedB} onChange={event => setZoneB(event.target.value)}>
            {zones.filter(zone => zone !== selectedA).map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </label>
      </div>
      {comparison.status === "ready" ? <>
        <div className="spatial-analysis-stats">
          <article><small>ĐIỂM NGHE KHỚP</small><b>{comparison.matchedPositionCount}</b></article>
          <article><small>TRUNG BÌNH {selectedA}</small><b>{comparison.zoneAMeanDb?.toFixed(1)} dB SPL</b></article>
          <article><small>TRUNG BÌNH {selectedB}</small><b>{comparison.zoneBMeanDb?.toFixed(1)} dB SPL</b></article>
          <article><small>CHÊNH LỆCH A − B</small><b>{comparison.deltaDb?.toFixed(1)} dB</b></article>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Vị trí nghe khớp</th><th>{selectedA}</th><th>{selectedB}</th><th>A − B</th></tr></thead><tbody>
          {comparison.points.map(point => <tr key={point.position}><td>{point.position}</td><td>{point.zoneADb.toFixed(1)}</td><td>{point.zoneBDb.toFixed(1)}</td><td>{point.deltaDb > 0 ? "+" : ""}{point.deltaDb.toFixed(1)} dB</td></tr>)}
        </tbody></table></div>
      </> : <p className="warning">{comparison.reason} Hiện có {comparison.matchedPositionCount} vị trí nghe khớp.</p>}
      <p className="muted">Chỉ so khớp theo tên vị trí. Kỹ thuật viên cần bảo đảm hai nhãn cùng đại diện cho vị trí nghe tương đương trước khi kết luận.</p>
    </div>

    <div className="spatial-analysis-block">
      <div className="heading"><Ruler /><h3>Độ đồng đều theo hàng ghế</h3></div>
      {rowSummaries.length ? <div className="table-wrap"><table><thead><tr><th>Vùng</th><th>Hàng ghế</th><th>Điểm vị trí</th><th>Trung bình</th><th>Dao động</th><th>Độ lệch chuẩn</th></tr></thead><tbody>
        {rowSummaries.map(row => <tr key={row.zone + "|" + row.row}><td>{row.zone}</td><td>{row.row}</td><td>{row.positionCount}</td><td>{row.meanDb.toFixed(1)} dB</td><td>{row.spreadDb.toFixed(1)} dB</td><td>{row.standardDeviationDb.toFixed(1)} dB</td></tr>)}
      </tbody></table></div> : <p className="muted">Chưa có dữ liệu dB SPL cùng chuỗi hiệu chuẩn, hoặc nhãn vị trí chưa theo định dạng “Hàng ghế 1 · Giữa”.</p>}
    </div>

    <div className="spatial-analysis-block">
      <div className="heading"><Activity /><h3>Suy hao theo khoảng cách · phân tích thực nghiệm</h3></div>
      <div className="spatial-analysis-controls">
        <label>LOA THAM CHIẾU
          <select value={selectedSpeaker ? String(selectedSpeaker.id) : ""} onChange={event => setSpeakerId(event.target.value)}>
            {speakers.map(speaker => <option key={speaker.id} value={speaker.id}>{speaker.name} · {speaker.zone}</option>)}
          </select>
        </label>
        <label>CAO ĐỘ TAI NGHE (m)
          <input type="number" min="0.5" max="2" step="0.05" value={earHeight} onChange={event => setEarHeight(Math.max(0.5, Math.min(2, Number(event.target.value) || 1.2)))}/>
        </label>
      </div>
      {attenuation?.status === "ready" ? <>
        <div className="spatial-analysis-stats">
          <article><small>ĐIỂM CÓ TỌA ĐỘ</small><b>{attenuation.pointCount}</b></article>
          <article><small>ĐỘ DỐC THỰC NGHIỆM</small><b>{attenuation.slopeDbPerDecade?.toFixed(1)} dB/decade</b></article>
          <article><small>R² HỒI QUY</small><b>{attenuation.rSquared === null ? "—" : attenuation.rSquared.toFixed(3)}</b></article>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Vị trí</th><th>Khoảng cách</th><th>Đo được</th><th>Đường hồi quy</th></tr></thead><tbody>
          {attenuation.points.map(point => <tr key={point.position}><td>{point.position}</td><td>{point.distanceM.toFixed(2)} m</td><td>{point.measuredDb.toFixed(1)} dB</td><td>{point.fittedDb.toFixed(1)} dB</td></tr>)}
        </tbody></table></div>
      </> : <p className="muted">{attenuation?.reason ?? "Chưa có loa tham chiếu. Hãy thêm loa trong mô hình 3D."}</p>}
      <p className="warning">{attenuation?.reason ?? "Đây là hồi quy trên dữ liệu đo thực tế, không phải mô hình suy hao trường tự do."} Không suy ra trực tiếp công suất ampli hoặc mức SPL tại vị trí chưa đo.</p>
    </div>

    <div className="spatial-analysis-advisory">
      <div className="heading"><ShieldAlert /><h3>Đề xuất Gain sơ bộ · cần kỹ thuật viên duyệt</h3></div>
      {trim.status === "review-only" ? <p>Để đưa {selectedB} gần mức trung bình của {selectedA}: <b>{trim.suggestedTrimDb! > 0 ? "+" : ""}{trim.suggestedTrimDb!.toFixed(1)} dB</b> (đã giới hạn ±3 dB). Chênh lệch chưa giới hạn: {trim.rawDifferenceDb?.toFixed(1)} dB.</p> : <p>{trim.reason}</p>}
      <p className="warning">Chỉ là điểm khởi đầu tham khảo dựa trên tối thiểu ba vị trí cùng tên và cùng chuỗi hiệu chuẩn. Phải kiểm tra headroom, limiter, phase, crossover và nghe thử. Phần mềm không gửi lệnh, không ghi Gain/Delay/EQ và không điều khiển DSP/LAN. writeEnabled = false.</p>
    </div>
  </section>;
}
