import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Mic, MicOff, ShieldAlert, ShieldCheck, Volume2, VolumeX, BookmarkPlus, Trash2, FileJson2 } from "lucide-react";
import { detectNarrowPeaks, type FeedbackCandidate } from "./feedback";
import { usePersistentState } from "./usePersistentState";

type SavedFeedbackPoint = {
  id: string;
  frequencyHz: number;
  prominenceDb: number;
  recommendedCutDb: number;
  q: number;
  confidence: "medium" | "high";
  savedAt: string;
};

type RecognitionResult = { 0?: { transcript?: string } };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => RecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

function speakVietnamese(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}

function normalizeCommand(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function sameFrequency(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(15, b * 0.02);
}

export default function FeedbackMonitor({ history }: { history: number[][] }) {
  const [voiceEnabled, setVoiceEnabled] = usePersistentState("church-audio-feedback-voice", true);
  const [autoGuardEnabled, setAutoGuardEnabled] = usePersistentState("church-audio-feedback-guard", true);
  const [minimumProminence, setMinimumProminence] = usePersistentState("church-audio-feedback-sensitivity", 6);
  const [savedPoints, setSavedPoints] = usePersistentState<SavedFeedbackPoint[]>("church-audio-feedback-saved-points", []);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Trợ lý giọng nói đang chờ lệnh.");
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const announcedRef = useRef<string[]>([]);

  const peaks = useMemo(
    () => autoGuardEnabled
      ? detectNarrowPeaks(history, { minimumProminenceDb: minimumProminence, minimumLevelDb: -65, minimumStableRatio: 0.65 })
      : [],
    [history, autoGuardEnabled, minimumProminence],
  );

  const saveCandidates = useCallback((items: FeedbackCandidate[]) => {
    if (!items.length) {
      setNotice("Chưa có đỉnh nghi hú đủ ổn định để lưu.");
      return;
    }
    const now = new Date().toISOString();
    const incoming: SavedFeedbackPoint[] = items.map((point, index) => ({
      id: String(Math.round(point.frequencyHz)) + "-" + Date.now() + "-" + index,
      frequencyHz: point.frequencyHz,
      prominenceDb: point.prominenceDb,
      recommendedCutDb: point.recommendedCutDb,
      q: point.q,
      confidence: point.confidence,
      savedAt: now,
    }));
    setSavedPoints((current) => {
      const previous = Array.isArray(current) ? current : [];
      const uniqueIncoming = incoming.filter((item) => !previous.some((saved) => sameFrequency(saved.frequencyHz, item.frequencyHz)));
      return [...uniqueIncoming, ...previous].slice(0, 40);
    });
    setNotice("Đã lưu " + incoming.length + " điểm/đề xuất. Hãy kiểm tra lại tại cùng vị trí đo trước khi áp dụng.");
  }, [setSavedPoints]);

  const speakCurrentStatus = useCallback(() => {
    if (!autoGuardEnabled) {
      speakVietnamese("Chế độ phân tích chống hú đang tắt.");
      return;
    }
    if (!peaks.length) {
      speakVietnamese("Chưa phát hiện đỉnh phổ nghi hú ổn định. Tiếp tục quan sát khi hệ thống đang hoạt động.");
      return;
    }
    const first = peaks[0];
    speakVietnamese(
      "Cảnh báo. Phát hiện " + peaks.length + " đỉnh phổ nghi hú. Đỉnh nổi bật nhất khoảng " +
      first.frequencyHz + " héc, độ nổi " + first.prominenceDb.toFixed(1) +
      " đề bê. Hãy giảm gain micro hoặc master trước, sau đó xác minh bằng tai và phép đo.",
    );
  }, [autoGuardEnabled, peaks]);

  useEffect(() => {
    if (!voiceEnabled || !autoGuardEnabled || !peaks.length) return;
    const fresh = peaks.filter((point) => !announcedRef.current.includes(String(point.frequencyHz)));
    if (!fresh.length) return;
    const point = fresh[0];
    const key = String(point.frequencyHz);
    announcedRef.current = [...announcedRef.current, key].slice(-24);
    speakVietnamese(
      "Cảnh báo nghi hú tại " + point.frequencyHz + " héc. Độ ổn định " +
      point.stabilityPercent + " phần trăm. Hãy giảm gain và kiểm tra vị trí micro.",
    );
  }, [peaks, voiceEnabled, autoGuardEnabled]);

  const handleVoiceCommand = useCallback((transcript: string) => {
    const command = normalizeCommand(transcript);
    setVoiceStatus("Đã nghe: " + transcript);
    if (command.includes("tat chong hu")) {
      setAutoGuardEnabled(false);
      speakVietnamese("Đã tắt phân tích tự động. Không thay đổi thiết lập mixer.");
    } else if (command.includes("bat chong hu")) {
      setAutoGuardEnabled(true);
      speakVietnamese("Đã bật phân tích chống hú tự động.");
    } else if (command.includes("tat doc") || command.includes("tat giong noi")) {
      setVoiceEnabled(false);
      speakVietnamese("Đã tắt cảnh báo giọng nói.");
    } else if (command.includes("bat doc") || command.includes("bat giong noi")) {
      setVoiceEnabled(true);
      speakVietnamese("Đã bật cảnh báo giọng nói.");
    } else if (command.includes("luu tat ca") || command.includes("luu cac diem")) {
      saveCandidates(peaks);
      speakVietnamese("Đã lưu danh sách điểm nghi hú hiện tại.");
    } else if (command.includes("luu diem") || command.includes("luu tan so")) {
      saveCandidates(peaks.slice(0, 1));
      speakVietnamese("Đã lưu đỉnh nghi hú nổi bật nhất.");
    } else if (command.includes("doc huong dan")) {
      speakVietnamese("Khi có tiếng hú, giảm gain micro hoặc master trước. Xoay micro tránh hướng loa. Sau đó kiểm tra tần số nổi bật bằng R T A. Chỉ áp dụng notch cắt nhẹ trên đúng kênh sau khi xác minh. Không tăng gain để bù lại.");
    } else {
      speakVietnamese("Lệnh chưa được nhận diện. Hãy nói: đọc cảnh báo, lưu điểm hú, lưu tất cả điểm, bật chống hú, tắt chống hú hoặc đọc hướng dẫn.");
    }
  }, [peaks, saveCandidates, setAutoGuardEnabled, setVoiceEnabled]);

  const startVoiceCommand = () => {
    const voiceWindow = window as SpeechWindow;
    const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus("Thiết bị chưa hỗ trợ nhận lệnh giọng nói. Cảnh báo đọc thành tiếng vẫn dùng được nếu có Speech Synthesis.");
      setNotice("Android WebView/trình duyệt này chưa cung cấp Speech Recognition.");
      return;
    }
    try {
      recognitionRef.current?.stop();
      const recognition = new Recognition();
      recognition.lang = "vi-VN";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript ?? "";
        if (transcript) handleVoiceCommand(transcript);
      };
      recognition.onerror = (event) => {
        setVoiceStatus("Không nhận được giọng nói: " + (event.error ?? "lỗi không xác định"));
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setVoiceStatus("Đang nghe một lệnh tiếng Việt. Micro sẽ dừng sau khi nhận lệnh.");
      setNotice("");
    } catch (error) {
      setListening(false);
      setVoiceStatus(error instanceof Error ? error.message : "Không thể bật micro nhận lệnh.");
    }
  };

  const stopVoiceCommand = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setVoiceStatus("Đã dừng nghe lệnh.");
  };

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const exportFilterPlan = () => {
    if (!peaks.length) {
      setNotice("Chưa có filter đủ điều kiện để xuất.");
      return;
    }
    const payload = {
      format: "Church Audio Feedback Guard — PEQ Advisory",
      status: "advisory-not-applied",
      generatedAt: new Date().toISOString(),
      safety: "No filter is written to a mixer or DSP. Verify the feedback frequency and affected channel before applying.",
      filters: peaks.map((point, index) => ({
        band: index + 1,
        type: "PEQ notch",
        frequencyHz: point.frequencyHz,
        gainDb: point.recommendedCutDb,
        q: point.q,
        confidence: point.confidence,
        stabilityPercent: point.stabilityPercent,
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "church-audio-feedback-notch-advisory.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("Đã xuất bộ lọc notch dạng JSON. Đây là cấu hình đề xuất, chưa được ghi vào DSP.");
  };

  return (
    <section className="panel feedback-guard-panel" id="feedback">
      <div className="heading"><ShieldAlert /><h2>Auto Feedback Guard · Phát hiện hú rít</h2><span>{autoGuardEnabled ? "AUTO SCAN" : "PAUSED"}</span></div>
      <p className="muted">Tự động theo dõi các đỉnh phổ hẹp ổn định qua nhiều khung RTA, xếp hạng độ tin cậy, lưu tần số nghi hú và tạo gợi ý notch PEQ có giới hạn.</p>

      <div className="feedback-guard-controls">
        <label className="feedback-switch"><input type="checkbox" checked={autoGuardEnabled} onChange={(event) => setAutoGuardEnabled(event.target.checked)} /> Quét và phân tích tự động</label>
        <label className="feedback-switch"><input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} /> Đọc cảnh báo bằng tiếng Việt</label>
        <label className="feedback-sensitivity">ĐỘ NHẠY PHÁT HIỆN <b>{minimumProminence} dB</b><input type="range" min="5" max="12" step="1" value={minimumProminence} onChange={(event) => setMinimumProminence(Number(event.target.value))} /></label>
      </div>

      <div className="feedback-voice-console">
        <div className="feedback-voice-copy"><b><Volume2 /> Trợ lý giọng nói tiếng Việt</b><small>{voiceStatus}</small></div>
        <div className="feedback-voice-actions">
          <button onClick={speakCurrentStatus}><Volume2 /> Đọc cảnh báo</button>
          <button className="secondary" onClick={listening ? stopVoiceCommand : startVoiceCommand} aria-pressed={listening}>
            {listening ? <MicOff /> : <Mic />} {listening ? "Dừng nghe lệnh" : "Ra lệnh bằng giọng nói"}
          </button>
        </div>
        <small className="muted">Lệnh hỗ trợ: “đọc cảnh báo”, “lưu điểm hú”, “lưu tất cả điểm”, “bật/tắt chống hú”, “bật/tắt giọng nói”, “đọc hướng dẫn”. Nhận dạng giọng nói chỉ bật sau khi bạn nhấn nút.</small>
      </div>

      {autoGuardEnabled && peaks.length > 0 ? (
        <>
          <div className="feedback-alert"><VolumeX /><b>Phát hiện {peaks.length} đỉnh phổ nghi hú — cần xác minh</b></div>
          <div className="table-wrap"><table><thead><tr><th>Tần số</th><th>Độ nổi</th><th>Ổn định</th><th>Độ tin cậy</th><th>Notch PEQ</th><th>Q</th></tr></thead><tbody>
            {peaks.map((point) => <tr key={point.index}>
              <td><b>{point.frequencyHz.toLocaleString("vi-VN")} Hz</b></td>
              <td>{point.prominenceDb.toFixed(1)} dB</td>
              <td>{point.stabilityPercent}%</td>
              <td><span className={point.confidence === "high" ? "feedback-confidence high" : "feedback-confidence medium"}>{point.confidence === "high" ? "CAO" : "TRUNG BÌNH"}</span></td>
              <td>{point.recommendedCutDb} dB</td><td>{point.q.toFixed(1)}</td>
            </tr>)}
          </tbody></table></div>
          <div className="feedback-guard-actions">
            <button onClick={() => saveCandidates(peaks)}><BookmarkPlus /> Lưu tất cả điểm hú</button>
            <button className="secondary" onClick={() => saveCandidates(peaks.slice(0, 1))}><BookmarkPlus /> Lưu điểm nổi bật</button>
            <button className="secondary" onClick={exportFilterPlan}><FileJson2 /> Xuất notch PEQ JSON</button>
          </div>
        </>
      ) : (
        <div className="feedback-clear"><ShieldCheck /><span>{autoGuardEnabled ? "Chưa có đỉnh hẹp ổn định theo ngưỡng. Cần chạy RTA và thu đủ dữ liệu." : "Đang tạm dừng phân tích tự động."}</span></div>
      )}

      <div className="saved-feedback-section">
        <div className="heading"><BookmarkPlus /><h3>Nhật ký tần số nghi hú đã lưu</h3><span>{savedPoints.length} ĐIỂM</span></div>
        {savedPoints.length ? (
          <div className="table-wrap"><table><thead><tr><th>Tần số</th><th>Notch gợi ý</th><th>Q</th><th>Lưu lúc</th><th></th></tr></thead><tbody>
            {savedPoints.map((point) => <tr key={point.id}>
              <td><b>{point.frequencyHz.toLocaleString("vi-VN")} Hz</b></td><td>{point.recommendedCutDb} dB</td><td>{point.q}</td><td>{new Date(point.savedAt).toLocaleString("vi-VN")}</td>
              <td><button className="icon-button" aria-label={"Xóa điểm " + point.frequencyHz + " Hz"} onClick={() => setSavedPoints((current) => current.filter((saved) => saved.id !== point.id))}><Trash2 size={15} /></button></td>
            </tr>)}
          </tbody></table></div>
        ) : <p className="muted">Chưa lưu điểm nào. Có thể lưu bằng nút trên hoặc dùng lệnh giọng nói.</p>}
      </div>

      {notice && <p className="device-notice" role="status">{notice}</p>}
      <p className="warning">Giới hạn an toàn: ứng dụng hiện chưa kết nối mixer/DSP nên không thể tự cắt EQ trên hệ thống loa. Auto Guard tự phân tích, đọc cảnh báo, ghi nhật ký và tạo notch đề xuất; không tự sửa gain, không tự mute micro và không tự ghi filter. Khi hú thật, ưu tiên giảm gain, hướng micro tránh loa và xác minh đúng kênh trước khi cắt notch.</p>
    </section>
  );
}
