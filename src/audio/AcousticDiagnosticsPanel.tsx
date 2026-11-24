import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { analyzeAcousticSnapshot } from "./acousticDiagnostics";
import { rtaBandFrequency } from "./rtaFrequency";

type Props = { spectrumDbfs: number[]; running: boolean };

export default function AcousticDiagnosticsPanel({ spectrumDbfs, running }: Props) {
  const report = useMemo(() => analyzeAcousticSnapshot({
    spectrum: running ? spectrumDbfs.map((levelDb, index) => ({
      frequencyHz: rtaBandFrequency(index, spectrumDbfs.length || 64),
      levelDb,
      evidence: "measured" as const,
    })).filter((bin) => bin.levelDb > -99) : [],
  }), [spectrumDbfs, running]);

  return <section className="panel acoustic-diagnostics-panel">
    <div className="heading"><ClipboardList /><h2>Acoustic Intelligence · Phân tích tổng hợp</h2><span>{report.status.toUpperCase()}</span></div>
    <p className="muted">Bản phân tích phổ trực tiếp từ RTA. Hiện chưa gộp kết quả RT60 và Transfer Function vào cùng phiên báo cáo; các mục đó chỉ được xác nhận sau khi có phép đo riêng đạt chất lượng.</p>
    <div className="metrics">
      <article><small>RTA BINS HỢP LỆ</small><strong>{report.measuredBinCount} / 64</strong></article>
      <article><small>CHÊNH LỆCH PHỔ</small><strong>{report.spectralSpreadDb === null ? "—" : report.spectralSpreadDb.toFixed(1) + " dB"}</strong></article>
      <article><small>TRẠNG THÁI SPL</small><strong>{report.splStatus === "calibrated" ? "ĐÃ HIỆU CHUẨN" : "dBFS / CHƯA XÁC NHẬN"}</strong></article>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Dải tần</th><th>Khoảng</th><th>Số bin</th><th>Mức năng lượng tương đối</th></tr></thead>
      <tbody>{report.spectrumBands.map((band) => <tr key={band.name}><td>{band.name}</td><td>{band.lowHz}–{band.highHz >= 1000 ? (band.highHz / 1000) + " kHz" : band.highHz + " Hz"}</td><td>{band.binCount}</td><td>{band.energyAverageDb === null ? "—" : band.energyAverageDb.toFixed(1) + " dBFS"}</td></tr>)}</tbody>
    </table></div>
    <div className="diagnostic-findings">
      {report.findings.length ? report.findings.map((item) => <article className={item.severity === "critical" ? "diagnostic-item critical" : item.severity === "warning" ? "diagnostic-item warning" : "diagnostic-item"} key={item.code}>
        <div>{item.severity === "critical" || item.severity === "warning" ? <AlertTriangle /> : <Activity />}</div>
        <section><b>{item.title}</b><p>{item.detail}</p><small>Đề xuất: {item.action}</small></section>
      </article>) : <p><CheckCircle2 /> Chưa phát hiện cảnh báo từ dữ liệu RTA hiện tại.</p>}
    </div>
    <p className="warning">Mức phổ đang hiển thị là dBFS tương đối, không phải dB SPL. Phân tích phổ không tự xác định nguyên nhân âm học; hãy xác minh bằng đo lặp, vị trí micro và dữ liệu đáp tuyến/RT60 trước khi chỉnh EQ.</p>
  </section>;
}
