import { useMemo } from "react";
import { usePersistentState } from "./usePersistentState";
import { analyzeMultiZoneCoverage } from "./multiZoneCoverage";
import type { ZoneSplRecord } from "./zoneSplUniformity";

export default function MultiZoneSPLCoveragePanel() {
  const [records] = usePersistentState<ZoneSplRecord[]>("church-audio-zone-spl-records-v1", []);
  const [referenceZone, setReferenceZone] = usePersistentState("church-audio-multizone-reference", "");
  const analysis = useMemo(() => analyzeMultiZoneCoverage(records, referenceZone), [records, referenceZone]);
  const exportReport = () => {
    const report = { schema: "church-audio-multizone-survey-v1", generatedAt: new Date().toISOString(),
      evidence: "measured-calibrated-dB-SPL-only", ...analysis,
      limitations: ["No interpolation or simulated values", "Position labels must represent equivalent listening locations", "No DSP writes"] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json;charset=utf-8"}));
    const a=document.createElement("a"); a.href=url; a.download="church-audio-multizone-spl-report.json"; a.click(); URL.revokeObjectURL(url);
  };
  return <section className="panel spatial-analysis-block">
    <div className="heading"><h3>v0.86–v0.90 · Bản đồ SPL nhiều vùng & độ phủ</h3><span>MEASURED / READ ONLY</span></div>
    <p className="muted">Tổng hợp đồng thời các vùng loa từ cùng đầu vào và cùng offset hiệu chuẩn. Mỗi vị trí chỉ được tính một lần sau khi năng lượng các lần đo lặp được trung bình. Không nội suy vùng chưa đo.</p>
    {analysis.zones.length > 0 && <label>VÙNG THAM CHIẾU CHÊNH LỆCH
      <select value={analysis.referenceZone} onChange={e=>setReferenceZone(e.target.value)}>{analysis.zones.map(z=><option key={z} value={z}>{z}</option>)}</select>
    </label>}
    {analysis.status === "blocked" || analysis.status === "insufficient" ? <p className="warning">{analysis.reason}</p> : <>
      <div className="spatial-analysis-stats">
        <article><small>SỐ VÙNG</small><b>{analysis.zones.length}</b></article>
        <article><small>VỊ TRÍ ĐO CHUNG</small><b>{analysis.commonPositionCount}/{analysis.unionPositionCount}</b></article>
        <article><small>ĐỘ CHỒNG PHỦ</small><b>{analysis.overlapPercent.toFixed(1)}%</b></article>
        <article><small>ĐẦU VÀO</small><b>{analysis.inputLabel}</b></article>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Vùng</th><th>Điểm đo</th><th>Độ phủ</th><th>Trung bình</th><th>Min–Max</th><th>Spread</th></tr></thead><tbody>
        {analysis.summaries.map(s=><tr key={s.zone}><td>{s.zone}</td><td>{s.measuredPoints}/{s.totalPositions}</td><td>{s.coveragePercent.toFixed(1)}%</td><td>{s.meanDb?.toFixed(1) ?? "—"} dB SPL</td><td>{s.minDb?.toFixed(1) ?? "—"} / {s.maxDb?.toFixed(1) ?? "—"}</td><td>{s.spreadDb?.toFixed(1) ?? "—"} dB</td></tr>)}
      </tbody></table></div>
      <div className="table-wrap"><table><thead><tr><th>Vị trí nghe</th>{analysis.zones.map(z=><th key={z}>{z}</th>)}</tr></thead><tbody>
        {analysis.points.map(p=><tr key={p.position}><td>{p.position}</td>{analysis.zones.map(z=><td key={z}>{p.levels[z] === undefined ? "Chưa đo" : <>{p.levels[z].toFixed(1)} <small>({p.deltas[z] === null ? "—" : (p.deltas[z]!>0?"+":"")+p.deltas[z]!.toFixed(1)+" dB"})</small></>}</td>)}</tr>)}
      </tbody></table></div>
      <p className="muted">Độ chồng phủ = số nhãn vị trí được đo ở tất cả vùng / tổng số nhãn vị trí xuất hiện. Chênh lệch trong ngoặc tính so với vùng tham chiếu. Không thay thế bản đồ 3D; bảng tọa độ chỉ hiển thị dữ liệu đã đo.</p>
      <button type="button" onClick={exportReport}>Xuất báo cáo nhiều vùng JSON</button>
    </>}
    <p className="warning">Chỉ kết luận khi vị trí đo tương ứng thực sự tương đương. Dữ liệu dBFS, sai đầu vào hoặc sai offset không được trộn. Không gửi lệnh Gain/Delay/EQ/DSP/LAN.</p>
  </section>;
}
