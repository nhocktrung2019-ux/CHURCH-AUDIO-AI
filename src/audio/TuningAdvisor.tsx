import { useMemo, useState } from "react";
import { AudioLines, Mic2, SlidersHorizontal, Volume2, ShieldCheck } from "lucide-react";
import { detectNarrowPeaks } from "./feedback";

type Props = { history: number[][] };

export default function TuningAdvisor({ history }: Props) {
  const [mic, setMic] = useState("dynamic");
  const [speaker, setSpeaker] = useState("fullrange");
  const peaks = useMemo(() => detectNarrowPeaks(history), [history]);
  const noiseFloor = useMemo(() => {
    const tail = history.slice(-20);
    if (!tail.length) return -90;
    const values = tail.flat().filter(Number.isFinite).sort((a, b) => a - b);
    return values[Math.floor(values.length * 0.2)] ?? -90;
  }, [history]);
  const hpf = mic === "gooseneck" ? 100 : mic === "wireless" ? 110 : 80;
  const gateThreshold = Math.max(-55, Math.min(-30, Math.round(noiseFloor + 8)));
  const comp = mic === "gooseneck"
    ? "2:1 · threshold −18 dB · attack 15 ms · release 120 ms"
    : "2.5:1 · threshold −18 dB · attack 10 ms · release 100 ms";

  const speakTuningGuide = () => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      return;
    }
    const message = peaks.length
      ? "Đang có " + peaks.length + " đỉnh phổ cần kiểm tra. " +
        "Ưu tiên giảm gain đầu vào, xoay micro tránh hướng loa, sau đó xác minh tần số và kênh. " +
        "Không tự động tăng gain hoặc cắt EQ khi chưa nghe và đo xác nhận."
      : "Bắt đầu với micro phù hợp, bật lọc thông cao ở mức vừa phải, giữ gain trước hú. " +
        "Đo lại tại vị trí người nói và khu vực khán giả. Tăng gain từng bước nhỏ và dừng khi xuất hiện dấu hiệu hú.";
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "vi-VN";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section className="panel">
      <div className="heading"><SlidersHorizontal /><h2>AI Tuning Advisor · Cân chỉnh có kiểm soát</h2><span>ADVISORY ONLY</span></div>
      <p className="muted">Gợi ý điểm bắt đầu từ mức ồn nền và phổ RTA. Luôn nghe/đo xác minh; không tự ghi tham số vào mixer hoặc DSP.</p>
      <div className="form-grid">
        <div><label>LOẠI MICROPHONE</label><select value={mic} onChange={(event) => setMic(event.target.value)}>
          <option value="dynamic">Shure dynamic / handheld (generic)</option>
          <option value="gooseneck">Microphone cổ ngỗng (generic)</option>
          <option value="wireless">Microphone không dây (generic)</option>
        </select></div>
        <div><label>NHÓM LOA</label><select value={speaker} onChange={(event) => setSpeaker(event.target.value)}>
          <option value="fullrange">Full-range / point source</option>
          <option value="column">Column / distributed</option>
          <option value="sub">Subwoofer</option>
        </select></div>
      </div>
      <div className="advisor-grid">
        <article><Mic2 /><small>HPF START</small><b>{speaker === "sub" ? "80–120 Hz" : hpf + " Hz"}</b><span>Điểm bắt đầu; tùy giọng nói, proximity và crossover.</span></article>
        <article><AudioLines /><small>GATE THRESHOLD</small><b>{gateThreshold} dBFS</b><span>Ước lượng noise floor + 8 dB; chỉnh release để tránh cụt chữ.</span></article>
        <article><SlidersHorizontal /><small>COMPRESSOR</small><b>{comp}</b><span>Preset khởi điểm, không phải thông số tối ưu cho mọi giọng.</span></article>
        <article><ShieldCheck /><small>FEEDBACK RISK</small><b>{peaks.length ? peaks.length + " peaks" : "No stable peak"}</b><span>Đỉnh phổ là dấu hiệu cần nghe và kiểm tra, không tự chứng minh feedback.</span></article>
      </div>
      <div className="voice-row">
        <div><b><Volume2 /> Trợ lý giọng nói · hướng dẫn căn chỉnh</b><small>Đọc checklist thao tác an toàn bằng tiếng Việt.</small></div>
        <button className="secondary voice-guide-button" onClick={speakTuningGuide}><Volume2 /> Đọc hướng dẫn</button>
      </div>
      <p className="warning">Các preset không đại diện thông số chính thức của hãng. Không dùng mức dBFS làm giới hạn công suất loa khi chưa hiệu chuẩn gain DSP/ampli.</p>
    </section>
  );
}
