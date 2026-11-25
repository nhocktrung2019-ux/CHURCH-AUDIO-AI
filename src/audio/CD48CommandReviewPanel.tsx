import { useMemo, useState } from "react";
import { AlertTriangle, Clipboard, ShieldCheck } from "lucide-react";
import { cd48Rs232, type Cd48Command } from "./cd48Rs232";

type Action =
  | "global-mute" | "input-mute" | "input-gain-step" | "output-mute"
  | "output-gain-step" | "scene-recall" | "input-group-mute"
  | "input-group-volume-step" | "output-group-mute" | "output-group-volume-step";

const actionLabels: Record<Action, string> = {
  "global-mute": "Mute toàn bộ output",
  "input-mute": "Mute / Unmute input",
  "input-gain-step": "Tăng / giảm gain input 1 dB",
  "output-mute": "Mute / Unmute output",
  "output-gain-step": "Tăng / giảm gain output 1 dB",
  "scene-recall": "Gọi Scene 1–8",
  "input-group-mute": "Mute / Unmute nhóm input",
  "input-group-volume-step": "Tăng / giảm volume nhóm input 1%",
  "output-group-mute": "Mute / Unmute nhóm output",
  "output-group-volume-step": "Tăng / giảm volume nhóm output 1%",
};

function buildCommand(action: Action, channel: number, enabled: boolean, direction: "up" | "down", scene: number): Cd48Command {
  switch (action) {
    case "global-mute": return cd48Rs232.globalMute(enabled);
    case "input-mute": return cd48Rs232.inputMute(channel, enabled);
    case "input-gain-step": return cd48Rs232.inputGainStep(channel, direction);
    case "output-mute": return cd48Rs232.outputMute(channel, enabled);
    case "output-gain-step": return cd48Rs232.outputGainStep(channel, direction);
    case "scene-recall": return cd48Rs232.recallScene(scene);
    case "input-group-mute": return cd48Rs232.inputGroupMute(channel, enabled);
    case "input-group-volume-step": return cd48Rs232.inputGroupVolumeStep(channel, direction);
    case "output-group-mute": return cd48Rs232.outputGroupMute(channel, enabled);
    case "output-group-volume-step": return cd48Rs232.outputGroupVolumeStep(channel, direction);
  }
}

export default function CD48CommandReviewPanel() {
  const [action, setAction] = useState<Action>("output-mute");
  const [channel, setChannel] = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [scene, setScene] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState("");
  const command = useMemo(() => buildCommand(action, channel, enabled, direction, scene), [action, channel, enabled, direction, scene]);
  const phraseMatches = typedPhrase.trim() === "REVIEW CD48 COMMAND";
  const reviewReady = acknowledged && phraseMatches;
  const isScene = action === "scene-recall";
  const isGlobal = action === "global-mute";
  const channelMax = action.startsWith("input-") ? (action.includes("group") ? 4 : 4) : action.startsWith("output-") ? (action.includes("group") ? 4 : 8) : 8;

  return <article className="panel cd48-command-review">
    <div className="heading"><ShieldCheck /><h3>CD48 · Command Review</h3><span>v0.34 · PREVIEW ONLY</span></div>
    <p className="muted">Chọn thao tác để xem chính xác câu lệnh theo bảng RS232 do người vận hành cung cấp. Màn hình này không mở cổng COM, không gửi dữ liệu và không điều khiển DSP.</p>
    <div className="form-grid">
      <div><label htmlFor="cd48-command-action">THAO TÁC</label><select id="cd48-command-action" value={action} onChange={event => { setAction(event.target.value as Action); setAcknowledged(false); setTypedPhrase(""); setChannel(1); }}>{
        (Object.keys(actionLabels) as Action[]).map(key => <option key={key} value={key}>{actionLabels[key]}</option>)
      }</select></div>
      {!isGlobal && !isScene && <div><label htmlFor="cd48-command-channel">{action.includes("group") ? "NHÓM" : "KÊNH"}</label><select id="cd48-command-channel" value={channel} onChange={event => setChannel(Number(event.target.value))}>{Array.from({length: channelMax}, (_, index) => index + 1).map(value => <option key={value} value={value}>{action.includes("group") ? "Group" : action.startsWith("input-") ? "Input" : "Output"} {value}</option>)}</select></div>}
      {isScene && <div><label htmlFor="cd48-command-scene">SCENE</label><select id="cd48-command-scene" value={scene} onChange={event => setScene(Number(event.target.value))}>{Array.from({length: 8}, (_, index) => index + 1).map(value => <option key={value} value={value}>Scene {value}</option>)}</select></div>}
      {(action.endsWith("mute") || isGlobal) && <div><label htmlFor="cd48-command-mute">TRẠNG THÁI</label><select id="cd48-command-mute" value={String(enabled)} onChange={event => setEnabled(event.target.value === "true")}><option value="true">Mute · bật tắt tiếng</option><option value="false">Unmute · mở tiếng</option></select></div>}
      {action.endsWith("step") && <div><label htmlFor="cd48-command-direction">ĐIỀU CHỈNH</label><select id="cd48-command-direction" value={direction} onChange={event => setDirection(event.target.value as "up" | "down")}><option value="up">Tăng (+)</option><option value="down">Giảm (−)</option></select></div>}
    </div>
    <div className="permission-help"><b>Lệnh ASCII</b><code>{command.command}</code><b>HEX ASCII</b><code>{command.asciiHex}</code><span>RS232 · 115200 baud theo bảng lệnh. Framing, parity, stop bit, flow control, tốc độ gửi và phản hồi chưa được tài liệu hóa.</span></div>
    <div className="readiness-item limited"><b><AlertTriangle /> Lệnh có tác động trực tiếp đến âm thanh</b><p>Đặc biệt cẩn trọng với Global Mute và Recall Scene. Hãy kiểm tra đúng thiết bị, đúng kênh và thời điểm không ảnh hưởng buổi lễ trước khi vận hành qua giao diện được kiểm định.</p></div>
    <label className="measurement-evidence-list"><span><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /> Tôi đã kiểm tra thiết bị, thao tác, kênh/nhóm và hiểu ảnh hưởng của lệnh.</span></label>
    <div><label htmlFor="cd48-review-phrase">NHẬP ĐỂ XÁC NHẬN XEM LẠI LỆNH: REVIEW CD48 COMMAND</label><input id="cd48-review-phrase" value={typedPhrase} onChange={event => setTypedPhrase(event.target.value)} placeholder="REVIEW CD48 COMMAND" autoComplete="off" /></div>
    <p className={reviewReady ? "readiness-item ready" : "readiness-item limited"}>{reviewReady ? "Đã xác nhận bước xem lại lệnh. Không có dữ liệu nào được gửi tới thiết bị." : "Chưa xác nhận xem lại. Đây chỉ là bản xem trước, không thể thực thi."}</p>
    <button type="button" className="secondary" onClick={() => { setAcknowledged(false); setTypedPhrase(""); }}>Đặt lại xác nhận</button>
    <p className="warning">Không có nút Gửi/Apply trong phiên bản này. Chưa được phép kết nối RS232 hoặc Ethernet cho đến khi xác minh điện áp/cáp, framing và quy trình phản hồi bằng tài liệu hãng và thử nghiệm có kiểm soát.</p>
  </article>;
}
