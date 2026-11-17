import { useMemo, type CSSProperties } from "react";
import { Activity, Crosshair, Save, Trash2 } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { logBandFrequency } from "./acoustics";

type SavedFrequency = {
  id: string;
  frequencyHz: number;
  levelDb: number;
  savedAt: string;
  note: string;
};

export default function RTAWorkbench({ spectrum, history }: { spectrum: number[]; history: number[][] }) {
  const [selectedIndex, setSelectedIndex] = usePersistentState("church-audio-rta-selected-index", 20);
  const [saved, setSaved] = usePersistentState<SavedFrequency[]>("church-audio-rta-saved-frequencies", []);
  const [note, setNote] = usePersistentState("church-audio-rta-frequency-note", "");
  const safeIndex = Math.max(0, Math.min(Math.max(0, spectrum.length - 1), selectedIndex));
  const frequencyHz = useMemo(() => logBandFrequency(safeIndex, Math.max(1, spectrum.length)), [safeIndex, spectrum.length]);
  const levelDb = Number.isFinite(spectrum[safeIndex]) ? spectrum[safeIndex] : -100;
  const peakHold = useMemo(() => spectrum.map((_, index) => Math.max(-100, ...history.slice(-24).map(frame => Number.isFinite(frame[index]) ? frame[index] : -100))), [spectrum, history]);
  const savePoint = () => {
    const entry: SavedFrequency = {
      id: `${Date.now()}-${safeIndex}`,
      frequencyHz: Math.round(frequencyHz),
      levelDb: Math.round(levelDb * 10) / 10,
      savedAt: new Date().toISOString(),
      note: note.trim(),
    };
    setSaved(old => [entry, ...old.filter(item => Math.abs(item.frequencyHz - entry.frequencyHz) / entry.frequencyHz > 0.015)].slice(0, 100));
  };
  const formatFrequency = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} kHz` : `${Math.round(value)} Hz`;

  return <section className="panel rta-workbench" id="rta-cursor">
    <div className="heading"><Crosshair/><h2>RTA · Con trỏ tần số & Peak Hold</h2><span>{history.length} FRAMES</span></div>
    <p className="muted">Chọn trực tiếp một dải FFT bằng cột phổ hoặc thanh tần số. Tần số hiển thị là tâm dải log gần nhất, không phải độ phân giải FFT hẹp.</p>
    <div className="rta-spectrum-bars" role="group" aria-label="Chọn dải tần số RTA">
      {spectrum.map((value, index) => {
        const height = Math.max(2, Math.min(100, (value + 100) * 0.98));
        const held = Math.max(height, (peakHold[index] + 100) * 0.98);
        return <button key={index} type="button" className={index === safeIndex ? "rta-bar selected" : "rta-bar"} style={{ height: `${height}%`, "--peak-height": `${Math.max(2, Math.min(100, held))}%` } as CSSProperties} onClick={() => setSelectedIndex(index)} aria-label={`Chọn ${formatFrequency(logBandFrequency(index, spectrum.length))}, ${value.toFixed(1)} dBFS`} title={`${formatFrequency(logBandFrequency(index, spectrum.length))} · ${value.toFixed(1)} dBFS`} />
      })}
    </div>
    <div className="axis"><span>20 Hz</span><span>100 Hz</span><span>1 kHz</span><span>5 kHz</span><span>20 kHz</span></div>
    <div className="rta-cursor-readout"><div><small>SELECTED FREQUENCY</small><strong>{formatFrequency(frequencyHz)}</strong></div><div><small>LIVE LEVEL</small><strong>{levelDb.toFixed(1)} <small>dBFS</small></strong></div><div><small>FFT BAND</small><strong>{safeIndex + 1}/{spectrum.length}</strong></div></div>
    <label>CHỌN TẦN SỐ (THANG LOGARITHMIC)</label>
    <input type="range" min="0" max={Math.max(0, spectrum.length - 1)} step="1" value={safeIndex} onChange={event => setSelectedIndex(+event.target.value)} />
    <div className="value"><span>20 Hz</span><b>{formatFrequency(frequencyHz)}</b><span>20 kHz</span></div>
    <label>GHI CHÚ ĐIỂM ĐO / NGHI HÚ</label>
    <input value={note} maxLength={120} placeholder="Ví dụ: Mic bục giảng, hú khi mở monitor..." onChange={event => setNote(event.target.value)} />
    <button onClick={savePoint}><Save/> Lưu điểm tần số đang chọn</button>
    <div className="rta-saved-list">
      <div className="room-toolbar"><b><Activity/> Điểm tần số đã lưu ({saved.length})</b><button className="secondary" disabled={!saved.length} onClick={() => setSaved([])}><Trash2/> Xóa tất cả</button></div>
      {saved.length === 0 ? <p className="muted">Chưa lưu điểm nào. Chọn cột phổ hoặc tần số, sau đó nhấn Lưu điểm.</p> : <div className="table-wrap"><table><thead><tr><th>Tần số</th><th>Mức</th><th>Ghi chú</th><th>Thao tác</th></tr></thead><tbody>{saved.map(item => <tr key={item.id}><td><b>{formatFrequency(item.frequencyHz)}</b></td><td>{item.levelDb.toFixed(1)} dBFS</td><td>{item.note || "—"}</td><td><button className="secondary rta-inline-button" onClick={() => setSaved(old => old.filter(row => row.id !== item.id))}><Trash2/></button></td></tr>)}</tbody></table></div>}
    </div>
    <p className="warning">Peak Hold chỉ lưu mức cao nhất trong 24 frame đang giữ. Mức dBFS và tần số dải không phải SPL đã hiệu chuẩn; hãy xác nhận bằng phép đo lặp và nghe thực tế trước khi chỉnh EQ.</p>
  </section>;
}
