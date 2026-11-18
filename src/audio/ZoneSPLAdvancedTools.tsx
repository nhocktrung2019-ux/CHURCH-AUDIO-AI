import { useMemo, useState } from "react";
import { FileJson, Ruler } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { buildSurveyReport, calculateGeometricDelayRecommendations, type SpeakerGeometry, type SurveyPoint } from "./zoneSPLWorkflow";
import type { ZoneSplRecord } from "./zoneSplUniformity";

export default function ZoneSPLAdvancedTools() {
  const [records] = usePersistentState<ZoneSplRecord[]>("church-audio-zone-spl-records-v1", []);
  const [speakers] = usePersistentState<SpeakerGeometry[]>("church-audio-room-speakers", []);
  const [length] = usePersistentState("church-audio-room-length", 28);
  const [width] = usePersistentState("church-audio-room-width", 16);
  const [height] = usePersistentState("church-audio-room-height", 7);
  const [listenerX, setListenerX] = useState("14");
  const [listenerY, setListenerY] = useState("8");
  const [earHeight, setEarHeight] = useState("1.2");
  const [speed, setSpeed] = useState("343");
  const [notice, setNotice] = useState("");
  const recommendations = useMemo(() => calculateGeometricDelayRecommendations(
    speakers,
    { x: Number(listenerX), y: Number(listenerY), earHeightM: Number(earHeight) },
    Number(speed),
  ), [speakers, listenerX, listenerY, earHeight, speed]);
  const measured = records.filter((record): record is ZoneSplRecord & {xM?:number;yM?:number} => Number.isFinite(record.levelDb));
  const exportReport = () => {
    const report = buildSurveyReport(measured as SurveyPoint[], { roomLengthM: length, roomWidthM: width, roomHeightM: height });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "church-audio-survey-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Đã tạo báo cáo JSON từ dữ liệu đo đã lưu.");
  };
  return <section className="panel zone-advanced-panel">
    <div className="heading"><Ruler/><h2>Phân tích chuyên sâu · Delay & báo cáo</h2><span>ADVISORY ONLY</span></div>
    <p className="muted">Các khuyến nghị dưới đây chỉ dựa trên hình học vị trí loa và điểm nghe. Không gửi lệnh đến mixer/DSP và không tự thay đổi EQ, Gain, Delay hoặc routing.</p>
    <div className="zone-advanced-grid">
      <label>ĐIỂM NGHE X (m)<input type="number" min="0" max={length} step="0.1" inputMode="decimal" value={listenerX} onChange={event=>setListenerX(event.target.value)}/></label>
      <label>ĐIỂM NGHE Y (m)<input type="number" min="0" max={width} step="0.1" inputMode="decimal" value={listenerY} onChange={event=>setListenerY(event.target.value)}/></label>
      <label>CAO ĐỘ TAI (m)<input type="number" min="0" max="3" step="0.1" inputMode="decimal" value={earHeight} onChange={event=>setEarHeight(event.target.value)}/></label>
      <label>TỐC ĐỘ ÂM THANH (m/s)<input type="number" min="300" max="360" step="0.1" inputMode="decimal" value={speed} onChange={event=>setSpeed(event.target.value)}/></label>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Loa / vùng</th><th>Khoảng cách</th><th>Delay hình học</th></tr></thead><tbody>
      {recommendations?.map(row=><tr key={row.speakerId}><td>{row.speakerName} · {row.zone}</td><td>{row.distanceM.toFixed(2)} m</td><td><b>{row.relativeDelayMs.toFixed(2)} ms</b></td></tr>)}
      {!recommendations?.length && <tr><td colSpan={3}>Chưa có dữ liệu loa hợp lệ để tính khuyến nghị.</td></tr>}
    </tbody></table></div>
    <p className="zone-delay-note">Đây là thời gian bù tương đối theo khoảng cách đến điểm nghe, không phải giá trị delay cuối cùng để nạp DSP. Cần đo impulse response/loopback, xác minh cực tính, latency, crossover và nghe kiểm tra trước khi kỹ thuật viên quyết định.</p>
    <div className="zone-advanced-actions"><button onClick={exportReport} disabled={!records.length}><FileJson/> Xuất báo cáo khảo sát JSON</button></div>
    {notice && <p className="device-notice" role="status">{notice}</p>}
    <p className="muted">Báo cáo chỉ gồm {records.length} bản ghi đo đã lưu. Dữ liệu mô phỏng 3D không được đưa vào báo cáo đo thực tế.</p>
  </section>;
}
