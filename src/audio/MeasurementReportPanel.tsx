import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, Printer, RefreshCw, ShieldCheck } from "lucide-react";
import { APP_VERSION } from "../appVersion";
import { usePersistentState } from "./usePersistentState";
import { buildMeasurementReport, measurementReportCsv, type MeasurementReport } from "./measurementReport";

function readStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function makeReport(project: { name: string; site: string; operator: string; notes: string }): MeasurementReport {
  return buildMeasurementReport({
    appVersion: APP_VERSION,
    project,
    zoneStorage: readStorage("church-audio-spl-zones-v076"),
    rt60Storage: readStorage("church-audio-rt60-report-v109"),
    transferStorage: readStorage("church-audio-transfer-latest"),
    offsetStorage: readStorage("church-audio-mic-offset-db"),
    micCalibrationStorage: readStorage("church-audio-mic-calibration-file"),
    roomStorage: {
      length: readStorage("church-audio-room-length"),
      width: readStorage("church-audio-room-width"),
      height: readStorage("church-audio-room-height"),
    },
  });
}
function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
export default function MeasurementReportPanel() {
  const [projectName,setProjectName] = usePersistentState("church-audio-report-project-name","Khảo sát âm học nhà thờ");
  const [site,setSite] = usePersistentState("church-audio-report-site","");
  const [operator,setOperator] = usePersistentState("church-audio-report-operator","");
  const [notes,setNotes] = usePersistentState("church-audio-report-notes","");
  const [report,setReport] = useState<MeasurementReport|null>(null);
  const [error,setError] = useState("");
  const refresh = () => {
    setError("");
    try { setReport(makeReport({name:projectName,site,operator,notes})); }
    catch { setError("Không thể đọc dữ liệu dự án trên thiết bị này."); }
  };
  const exportJson = () => {
    const current=report??makeReport({name:projectName,site,operator,notes});
    setReport(current);
    downloadFile("church-audio-measurement-report-v1.json",JSON.stringify(current,null,2),"application/json;charset=utf-8");
  };
  const exportCsv = () => {
    const current=report??makeReport({name:projectName,site,operator,notes});
    setReport(current);
    downloadFile("church-audio-measurement-data-v1.csv",measurementReportCsv(current),"text/csv;charset=utf-8");
  };
  const printPdf = () => {
    const current=report??makeReport({name:projectName,site,operator,notes});
    setReport(current);
    window.setTimeout(()=>window.print(),100);
  };
  return <section className="tab-stack measurement-report-workspace">
    <section className="panel report-setup no-print">
      <div className="heading"><FileText/><h2>Professional Measurement Report</h2><span>SCHEMA 1.0.0</span></div>
      <p className="muted">Tạo báo cáo từ dữ liệu đang lưu trên thiết bị. Báo cáo chỉ đưa vào các nguồn có dữ liệu; các mục thiếu sẽ để trống hoặc ghi rõ chưa có.</p>
      <div className="form-grid">
        <label>TÊN DỰ ÁN<input value={projectName} onChange={e=>setProjectName(e.target.value)} maxLength={160}/></label>
        <label>ĐỊA ĐIỂM / NHÀ THỜ<input value={site} onChange={e=>setSite(e.target.value)} maxLength={160} placeholder="Tên nhà thờ / địa điểm"/></label>
        <label>NGƯỜI THỰC HIỆN<input value={operator} onChange={e=>setOperator(e.target.value)} maxLength={120} placeholder="Kỹ thuật viên"/></label>
        <label>GHI CHÚ KHẢO SÁT<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} maxLength={2000} placeholder="Điều kiện đo, cấu hình hệ thống, thời tiết..."/></label>
      </div>
      <div className="report-actions">
        <button onClick={refresh}><RefreshCw/>Làm mới dữ liệu báo cáo</button>
        <button className="secondary" onClick={exportJson}><FileJson/>Xuất JSON</button>
        <button className="secondary" onClick={exportCsv}><FileSpreadsheet/>Xuất CSV</button>
        <button className="secondary" onClick={printPdf}><Printer/>In / Lưu PDF</button>
      </div>
      {error&&<p className="error">{error}</p>}
      <p className="warning">PDF được tạo qua hộp thoại In của trình duyệt/Android: chọn “Lưu dưới dạng PDF”. Đây không phải PDF có chữ ký số.</p>
    </section>
    {report&&<div className="report-print-area">
      <header className="report-document-header">
        <div><small>CHURCH AUDIO AI · ACOUSTIC MEASUREMENT SUITE</small><h1>BÁO CÁO KHẢO SÁT ÂM HỌC</h1><p>Professional Measurement Report · Schema {report.schemaVersion}</p></div>
        <div className="report-doc-meta"><b>{report.project.name}</b><span>{report.project.site||"Chưa ghi địa điểm"}</span><span>{new Date(report.generatedAt).toLocaleString()}</span><span>Build {report.application.version}</span></div>
      </header>
      <section className="report-document-section">
        <h2>01 · Thông tin khảo sát</h2>
        <div className="report-meta-grid"><div><small>ĐƠN VỊ / ĐỊA ĐIỂM</small><b>{report.project.site||"Chưa cung cấp"}</b></div><div><small>NGƯỜI THỰC HIỆN</small><b>{report.project.operator||"Chưa cung cấp"}</b></div><div><small>KÍCH THƯỚC PHÒNG MÔ HÌNH</small><b>{report.room.lengthM&&report.room.widthM&&report.room.heightM?report.room.lengthM+" × "+report.room.widthM+" × "+report.room.heightM+" m":"Chưa có dữ liệu"}</b></div><div><small>GHI CHÚ</small><b>{report.project.notes||"—"}</b></div></div>
      </section>
      <section className="report-document-section">
        <h2>02 · Hiệu chuẩn và tính toàn vẹn</h2>
        <div className="report-meta-grid"><div><small>OFFSET MỘT ĐIỂM</small><b>{report.calibration.onePointOffsetDb===null?"Chưa có":report.calibration.onePointOffsetDb.toFixed(2)+" dB"}</b></div><div><small>MIC CORRECTION FILE</small><b>{report.calibration.microphoneCorrectionProfileName||"Chưa có"}</b></div><div><small>ĐIỂM HIỆU CHỈNH MIC</small><b>{report.calibration.microphoneCorrectionPointCount}</b></div><div><small>SPL VÙNG ĐÃ XÁC MINH</small><b>{report.integrity.measuredSPLZoneEntries}</b></div></div>
        <p className="report-integrity-note"><ShieldCheck/> {report.calibration.note}</p>
      </section>
      <section className="report-document-section">
        <h2>03 · Bản ghi SPL từng vùng</h2>
        {report.zoneEntries.length?<div className="table-wrap"><table><thead><tr><th>Vùng</th><th>Mức nhập</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>{report.zoneEntries.map(z=><tr key={z.id}><td>{z.name}</td><td>{z.splDb===null?"Chưa đo":z.splDb.toFixed(1)+" dB SPL (nhập tay)"}</td><td>Chưa xác minh</td><td>{z.note||"—"}</td></tr>)}</tbody></table></div>:<p>Chưa có bản ghi vùng loa.</p>}
        <p className="report-integrity-note">Các giá trị SPL vùng hiện tại là số nhập tay, chưa có provenance hiệu chuẩn cho từng bản ghi. Không tính chúng thành kết quả SPL đã xác minh.</p>
      </section>
      <section className="report-document-section">
        <h2>04 · RT60 / Impulse Response</h2>
        {report.rt60?<><div className="report-meta-grid"><div><small>RT60 KHUYẾN NGHỊ</small><b>{report.rt60.recommendedRt60===null?"—":report.rt60.recommendedRt60.toFixed(2)+" s"}</b></div><div><small>CHẤT LƯỢNG PHÂN TÍCH</small><b>{report.rt60.quality.toUpperCase()}</b></div><div><small>PEAK / NOISE</small><b>{report.rt60.peakToNoiseDb.toFixed(1)+" dB"}</b></div><div><small>VỊ TRÍ ĐO</small><b>{report.rt60.zone+" · "+report.rt60.position}</b></div></div><div className="table-wrap"><table><thead><tr><th>Octave band</th><th>RT20</th><th>RT30</th><th>RT60</th><th>Fit R²</th></tr></thead><tbody>{report.rt60.bands.map(b=><tr key={b.centerHz}><td>{b.centerHz>=1000?b.centerHz/1000+" kHz":b.centerHz+" Hz"}</td><td>{b.rt20Seconds===null?"—":b.rt20Seconds.toFixed(2)+" s"}</td><td>{b.rt30Seconds===null?"—":b.rt30Seconds.toFixed(2)+" s"}</td><td>{b.rt60Seconds===null?"—":b.rt60Seconds.toFixed(2)+" s"}</td><td>{b.fitR2===null?"—":b.fitR2.toFixed(3)}</td></tr>)}</tbody></table></div><p className="report-integrity-note">RT60 là ước tính in-situ. Hiệu chỉnh đáp tuyến micro chưa được áp dụng trong quy trình sweep hiện tại.</p></>:<p>Chưa có kết quả RT60 được lưu. Thực hiện phép đo tại mục Đo âm học phòng để bổ sung.</p>}
      </section>
      <section className="report-document-section">
        <h2>05 · Transfer Function / Phase</h2>
        {report.transferResponse?<><p>{report.transferResponse.pointCount} điểm đáp tuyến · Sample rate {report.transferResponse.sampleRate??"—"} Hz · Mức tương đối, không phải dB SPL tuyệt đối.</p><div className="table-wrap"><table><thead><tr><th>Frequency</th><th>Magnitude</th><th>Phase</th><th>Coherence</th></tr></thead><tbody>{report.transferResponse.points.filter((_,i)=>i%Math.max(1,Math.ceil(report.transferResponse!.points.length/30))===0).map(p=><tr key={p.frequencyHz}><td>{p.frequencyHz.toFixed(1)} Hz</td><td>{p.magnitudeDb.toFixed(2)} dB</td><td>{p.phaseDeg.toFixed(1)}°</td><td>{(p.coherence*100).toFixed(1)}%</td></tr>)}</tbody></table></div></>:<p>Chưa có đáp tuyến Transfer Function được lưu.</p>}
      </section>
      <section className="report-document-section">
        <h2>06 · Giới hạn và ghi chú kỹ thuật</h2>
        <ul>{report.limitations.map(item=><li key={item}>{item}</li>)}</ul>
        <p className="report-footnote">Báo cáo được tạo tự động từ dữ liệu cục bộ đang có trên thiết bị. Ngày kết xuất: {new Date(report.generatedAt).toLocaleString()}.</p>
      </section>
    </div>}
  </section>;
}
