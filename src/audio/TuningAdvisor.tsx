import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Mic2, SlidersHorizontal, Volume2, ShieldCheck } from "lucide-react";
import { detectNarrowPeaks } from "./feedback";

type Props = { history: number[][] };
export default function TuningAdvisor({ history }: Props) {
  const [voice, setVoice] = useState(true);
  const [mic, setMic] = useState("dynamic");
  const [speaker, setSpeaker] = useState("fullrange");
  const [program, setProgram] = useState<"speech" | "music">("speech");
  const lastSpoken = useRef("");
  const peaks = useMemo(() => detectNarrowPeaks(history), [history]);
  const noiseFloor = useMemo(() => {
    const tail = history.slice(-20);
    if (!tail.length) return -90;
    const vals = tail.flat().filter(Number.isFinite).sort((a, b) => a - b);
    return vals[Math.floor(vals.length * 0.2)] ?? -90;
  }, [history]);
  const hpf = speaker === "sub" ? "80–120 Hz" : mic === "gooseneck" ? "90–110 Hz" : mic === "wireless" ? "90–120 Hz" : "70–100 Hz";
  const gateThreshold = Math.max(-55, Math.min(-30, Math.round(noiseFloor + 8)));
  const comp = program === "speech" ? "2:1 · threshold −18 dB · attack 15 ms · release 120 ms" : "1.5:1 · threshold −20 dB · attack 25 ms · release 180 ms";
  useEffect(() => {
    if (!voice || !peaks.length || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const p = peaks[0], key = Math.round(p.frequencyHz / 10) * 10;
    if (lastSpoken.current === String(key)) return;
    lastSpoken.current = String(key);
    const utterance = new SpeechSynthesisUtterance("Cảnh báo. Có đỉnh tần số nghi hú tại " + p.frequencyHz + " héc. Hãy giảm gain, kiểm tra từng micro và hướng loa.");
    utterance.lang = "vi-VN"; utterance.rate = 0.92;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  }, [peaks, voice]);
  return <section className="panel">
    <div className="heading"><SlidersHorizontal /><h2>Natural Sound & AI Tuning · Giữ chất âm tự nhiên</h2><span>ADVISORY ONLY</span></div>
    <p className="muted">Ưu tiên xử lý nguyên nhân cộng hưởng và chỉ cắt hẹp các đỉnh được xác minh. Không dùng EQ để bù mọi điểm lõm/null do triệt tiêu pha hoặc phản xạ.</p>
    <div className="form-grid">
      <div><label>LOẠI MICROPHONE</label><select value={mic} onChange={e => setMic(e.target.value)}><option value="dynamic">Dynamic / handheld</option><option value="gooseneck">Cổ ngỗng / podium</option><option value="wireless">Không dây</option></select></div>
      <div><label>NHÓM LOA</label><select value={speaker} onChange={e => setSpeaker(e.target.value)}><option value="fullrange">Full-range / point source</option><option value="column">Column / distributed</option><option value="sub">Subwoofer</option></select></div>
      <div><label>CHƯƠNG TRÌNH</label><select value={program} onChange={e => setProgram(e.target.value as "speech" | "music")}><option value="speech">Giọng nói / bài giảng</option><option value="music">Nhạc / worship</option></select></div>
    </div>
    <div className="advisor-grid">
      <article><Mic2 /><small>HPF START</small><b>{hpf}</b><span>Điểm bắt đầu bảo vệ headroom; điều chỉnh theo giọng, khoảng cách và proximity.</span></article>
      <article><AudioLines /><small>GATE THRESHOLD</small><b>{gateThreshold} dBFS</b><span>Noise floor + 8 dB; đặt thấp vừa đủ, tránh cắt đầu/cuối câu.</span></article>
      <article><SlidersHorizontal /><small>COMPRESSOR</small><b>{comp}</b><span>Preset nhẹ để giữ dynamics; giảm compression nếu hệ thống dễ hú.</span></article>
      <article><ShieldCheck /><small>EQ STRATEGY</small><b>Cut nhỏ, Q hẹp</b><span>Ưu tiên −1.5 đến −4 dB cho peak đã xác minh; không boost sâu các điểm lõm.</span></article>
    </div>
    {peaks.length > 0 && <div className="table-wrap"><table><thead><tr><th>EQ đề xuất (chưa áp dụng)</th><th>Gain</th><th>Q</th><th>Độ tin cậy</th></tr></thead><tbody>{peaks.slice(0, 4).map(p => <tr key={p.index}><td>{p.frequencyHz.toLocaleString("vi-VN")} Hz</td><td>{p.recommendedCutDb.toFixed(1)} dB</td><td>{p.q.toFixed(1)}</td><td>{p.confidence === "high" ? "Cao" : "Trung bình"}</td></tr>)}</tbody></table></div>}
    <div className="voice-row"><div><b><Volume2 /> Cảnh báo hú bằng giọng nói</b><small>Đọc tần số nghi vấn mới xuất hiện; cảnh báo không thay thế người vận hành.</small></div><label className="switch-label"><input type="checkbox" checked={voice} onChange={e => setVoice(e.target.checked)} /> {voice ? "Bật" : "Tắt"}</label></div>
    <div className="feedback-clear"><ShieldCheck /><span>Chế độ bảo toàn chất âm: không tự động ghi EQ, không tự tăng gain và không cắt quá 4 dB trong gợi ý ban đầu.</span></div>
    <p className="warning">Các giá trị HPF/gate/comp là preset khởi điểm, không phải thông số cố định. Nhiều micro mở cùng lúc làm giảm gain-before-feedback; dùng mixer/DSP để quản lý từng kênh, bật HPF phù hợp và cân nhắc automix/ducker có kiểm soát.</p>
  </section>;
}
