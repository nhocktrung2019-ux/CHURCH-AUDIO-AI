import { useMemo, useState } from "react";
import { Download, SlidersHorizontal, ShieldAlert } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { createCD48PresetDraft, validateCD48PresetDraft, type CD48PresetDraft } from "./cd48Preset";

function saveJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CD48PresetEditor() {
  const [draft, setDraft] = usePersistentState<CD48PresetDraft>("church-audio-cd48-preset-draft-v1", createCD48PresetDraft);
  const [selectedId, setSelectedId] = useState("OUT1");
  const [peqIndex, setPeqIndex] = useState(0);
  const channel = [...draft.inputs, ...draft.outputs].find((item) => item.id === selectedId)!;
  const issues = useMemo(() => validateCD48PresetDraft(draft), [draft]);
  const updateChannel = (patch: Partial<typeof channel>) => setDraft((current) => ({
    ...current,
    inputs: current.inputs.map((item) => item.id === selectedId ? { ...item, ...patch } : item),
    outputs: current.outputs.map((item) => item.id === selectedId ? { ...item, ...patch } : item),
  }));
  const band = channel.peq[peqIndex];
  const updateBand = (patch: Partial<NonNullable<typeof band>>) => {
    const peq = channel.peq.map((item, index) => index === peqIndex
      ? { ...(item ?? { frequencyHz: 1000, gainDb: 0, q: 1 }), ...patch }
      : item);
    updateChannel({ peq });
  };
  const toggleRoute = (input: number, output: number, checked: boolean) => setDraft((current) => ({
    ...current,
    matrix: current.matrix.map((row, rowIndex) => row.map((value, colIndex) =>
      rowIndex === input && colIndex === output ? checked : value)),
  }));
  return <article className="panel cd48-preset-editor">
    <div className="heading"><SlidersHorizontal /><h3>CD48 · Cấu hình 4 IN / 8 OUT</h3><span>LOCAL DRAFT</span></div>
    <p className="muted">Tạo và lưu bản nháp cấu hình trên điện thoại. Thông số chưa được gửi tới DSP; dải giới hạn chi tiết của firmware cần xác nhận bằng tài liệu hãng.</p>
    <div className="form-grid">
      <div><label htmlFor="cd48-scene">SCENE DỰ KIẾN (1–128)</label><input id="cd48-scene" type="number" min="1" max="128" value={draft.sceneSlot} onChange={(event) => setDraft((current) => ({ ...current, sceneSlot: Number(event.target.value) }))} /></div>
      <div><label htmlFor="cd48-fw">FIRMWARE / GHI CHÚ PHIÊN BẢN</label><input id="cd48-fw" value={draft.firmwareLabel} onChange={(event) => setDraft((current) => ({ ...current, firmwareLabel: event.target.value }))} /></div>
    </div>
    <div className="form-grid">
      <div><label htmlFor="cd48-channel">KÊNH ĐANG CHỈNH</label><select id="cd48-channel" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{draft.inputs.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}{draft.outputs.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select></div>
      <div><label htmlFor="cd48-gain">GAIN (dB) · BẢN NHÁP</label><input id="cd48-gain" type="number" step="0.1" value={channel.gainDb} onChange={(event) => updateChannel({ gainDb: Number(event.target.value) })} /></div>
      <div><label htmlFor="cd48-delay">DELAY (ms) · TỐI ĐA 2000</label><input id="cd48-delay" type="number" min="0" max="2000" step="0.01" value={channel.delayMs} onChange={(event) => updateChannel({ delayMs: Number(event.target.value) })} /></div>
      <div className="measurement-evidence-list"><label><input type="checkbox" checked={channel.polarityInverted} onChange={(event) => updateChannel({ polarityInverted: event.target.checked })} /><span>Đảo cực / polarity</span></label><label><input type="checkbox" checked={channel.muted} onChange={(event) => updateChannel({ muted: event.target.checked })} /><span>Mute kênh</span></label></div>
    </div>
    <div className="peq-editor">
      <b>PEQ · 11 band / kênh</b>
      <div className="form-grid">
        <div><label htmlFor="cd48-peq-index">BAND</label><select id="cd48-peq-index" value={peqIndex} onChange={(event) => setPeqIndex(Number(event.target.value))}>{Array.from({ length: 11 }, (_, index) => <option key={index} value={index}>Band {index + 1}</option>)}</select></div>
        <div><label htmlFor="cd48-peq-freq">FREQUENCY (Hz)</label><input id="cd48-peq-freq" type="number" min="20" max="20000" value={band?.frequencyHz ?? 1000} onChange={(event) => updateBand({ frequencyHz: Number(event.target.value) })} /></div>
        <div><label htmlFor="cd48-peq-gain">GAIN (dB)</label><input id="cd48-peq-gain" type="number" step="0.1" value={band?.gainDb ?? 0} onChange={(event) => updateBand({ gainDb: Number(event.target.value) })} /></div>
        <div><label htmlFor="cd48-peq-q">Q</label><input id="cd48-peq-q" type="number" min="0.01" step="0.01" value={band?.q ?? 1} onChange={(event) => updateBand({ q: Number(event.target.value) })} /></div>
      </div>
      <button className="secondary" onClick={() => updateChannel({ peq: channel.peq.map((item, index) => index === peqIndex ? null : item) })}>Xóa band đang chọn</button>
    </div>
    <div className="cd48-matrix-wrap">
      <b>MATRIX · INPUT → OUTPUT</b>
      <div className="cd48-matrix" role="group" aria-label="CD48 routing matrix">
        <span></span>{draft.outputs.map((output) => <span key={output.id}>{output.id}</span>)}
        {draft.inputs.map((input, row) => <div className="cd48-matrix-row" key={input.id}><b>{input.id}</b>{draft.outputs.map((output, col) => <label key={output.id} title={input.id + " to " + output.id}><input type="checkbox" checked={draft.matrix[row][col]} onChange={(event) => toggleRoute(row, col, event.target.checked)} aria-label={input.id + " to " + output.id} /></label>)}</div>)}
      </div>
    </div>
    <div className={issues.length ? "readiness-item limited" : "readiness-item ready"}>
      <b>{issues.length ? "Cấu hình còn lỗi cần sửa" : "Bản nháp hợp lệ về cấu trúc"}</b>
      <p>{issues.length ? issues.map((issue) => issue.path + ": " + issue.message).join(" · ") : "Đủ 4 input, 8 output, matrix 4×8, 11 band/kênh và delay trong giới hạn tài liệu."}</p>
    </div>
    <button disabled={issues.length > 0} onClick={() => saveJson("cd48-scene-" + draft.sceneSlot + "-draft.json", draft)}><Download /> Xuất Scene JSON</button>
    <p className="warning"><ShieldAlert /> Đây chỉ là Scene bản nháp để lưu/chia sẻ. Không nạp vào thiết bị, không tự bật loa, không thay đổi limiter hoặc routing thật.</p>
  </article>;
}
