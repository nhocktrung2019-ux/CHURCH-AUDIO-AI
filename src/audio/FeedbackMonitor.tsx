import { useMemo } from "react";
import { ShieldAlert, ShieldCheck, VolumeX, Save, Trash2, Crosshair } from "lucide-react";
import { detectNarrowPeaks } from "./feedback";
import { usePersistentState } from "./usePersistentState";

type SavedFeedbackPoint = {
  id: string;
  frequencyHz: number;
  prominenceDb: number;
  levelDb: number;
  recommendedCutDb: number;
  q: number;
  savedAt: string;
  note: string;
};

export default function FeedbackMonitor({ history }: { history: number[][] }) {
  const peaks = useMemo(() => detectNarrowPeaks(history), [history]);
  const [saved, setSaved] = usePersistentState<SavedFeedbackPoint[]>("church-audio-saved-feedback-points", []);
  const [, setSelectedIndex] = usePersistentState("church-audio-rta-selected-index", 20);
  const savePeak = (peak: typeof peaks[number]) => {
    setSaved(old => [{
      id: `${Date.now()}-${peak.index}`,
      frequencyHz: peak.frequencyHz,
      prominenceDb: peak.prominenceDb,
      levelDb: peak.levelDb,
      recommendedCutDb: peak.recommendedCutDb,
      q: peak.q,
      savedAt: new Date().toISOString(),
      note: "Đỉnh phổ nghi hú; cần xác minh thực địa",
    }, ...old.filter(item => Math.abs(item.frequencyHz - peak.frequencyHz) / peak.frequencyHz > 0.015)].slice(0, 100));
  };
  return <section className="panel" id="feedback">
    <div className="heading"><ShieldAlert/><h2>Feedback Watch · Phát hiện hú rít</h2><span>LIVE ADVISORY</span></div>
    <p className="muted">Theo dõi đỉnh phổ hẹp ổn định qua nhiều frame RTA. Chọn tần số để chuyển con trỏ về đúng dải, hoặc lưu lại làm điểm cần xử lý.</p>
    {peaks.length === 0 ? <div className="feedback-clear"><ShieldCheck/><span>Chưa phát hiện đỉnh hẹp ổn định theo ngưỡng hiện tại.</span></div> : <>
      <div className="feedback-alert"><VolumeX/><b>Phát hiện {peaks.length} đỉnh phổ cần kiểm tra</b></div>
      <div className="table-wrap"><table><thead><tr><th>Tần số</th><th>Độ nổi</th><th>Filter khởi điểm</th><th>Q</th><th>Thao tác</th></tr></thead><tbody>{peaks.map(p => <tr key={p.index}><td><b>{p.frequencyHz.toLocaleString("vi-VN")} Hz</b></td><td>{p.prominenceDb.toFixed(1)} dB</td><td>{p.recommendedCutDb} dB</td><td>{p.q}</td><td><div className="feedback-actions"><button className="secondary" onClick={() => setSelectedIndex(p.index)}><Crosshair/> Chọn</button><button onClick={() => savePeak(p)}><Save/> Lưu</button></div></td></tr>)}</tbody></table></div>
    </>}
    <div className="rta-saved-list">
      <div className="room-toolbar"><b><Save/> Điểm hú đã lưu ({saved.length})</b><button className="secondary" disabled={!saved.length} onClick={() => setSaved([])}><Trash2/> Xóa tất cả</button></div>
      {saved.length === 0 ? <p className="muted">Chưa có điểm hú được lưu.</p> : <div className="table-wrap"><table><thead><tr><th>Tần số</th><th>Độ nổi</th><th>Filter gợi ý</th><th>Ghi chú</th><th></th></tr></thead><tbody>{saved.map(item => <tr key={item.id}><td><b>{item.frequencyHz.toLocaleString("vi-VN")} Hz</b></td><td>{item.prominenceDb.toFixed(1)} dB</td><td>{item.recommendedCutDb} dB · Q {item.q}</td><td>{item.note}</td><td><button className="secondary rta-inline-button" onClick={() => setSaved(old => old.filter(row => row.id !== item.id))}><Trash2/></button></td></tr>)}</tbody></table></div>}
    </div>
    <p className="warning">Đây là cảnh báo nghi vấn hú, không phải xác nhận vòng lặp feedback. Không tự động cắt EQ; cần kiểm tra gain-before-feedback, hướng micro, vị trí loa, phản xạ phòng và xác nhận bằng nghe/đo.</p>
  </section>;
}
