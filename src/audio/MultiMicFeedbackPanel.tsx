import { useEffect, useRef, useState } from "react";
import { Activity, Mic2, ShieldCheck, Square, VolumeX, Radio, Brain, Volume2, MessageSquareText } from "lucide-react";
import { detectNarrowPeaks } from "./feedback";

type InputDevice = { deviceId: string; label: string };
type ChannelState = { id: string; label: string; history: number[][]; error?: string };
type Session = { id: string; label: string; stream: MediaStream; analyser: AnalyserNode; data: Float32Array };
type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function toLogBands(data: Float32Array, sampleRate: number): number[] {
  const nyquist = sampleRate / 2, minHz = 20, maxHz = Math.min(20000, nyquist);
  const result: number[] = [];
  for (let band = 0; band < 64; band++) {
    const low = minHz * Math.pow(maxHz / minHz, band / 64);
    const high = minHz * Math.pow(maxHz / minHz, (band + 1) / 64);
    const first = Math.max(1, Math.floor(low / nyquist * data.length));
    const last = Math.min(data.length - 1, Math.max(first + 1, Math.ceil(high / nyquist * data.length)));
    let power = 0, count = 0;
    for (let i = first; i <= last; i++) {
      const amplitude = Math.pow(10, (data[i] ?? -120) / 20);
      power += amplitude * amplitude;
      count++;
    }
    result.push(20 * Math.log10(Math.max(1e-6, Math.sqrt(power / Math.max(1, count)))));
  }
  return result;
}

function normalizeCommand(value: string): string {
  return value.toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

export default function MultiMicFeedbackPanel() {
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [channels, setChannels] = useState<ChannelState[]>([]);
  const [combinedSpectrum, setCombinedSpectrum] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("Trợ lý sẵn sàng. Có thể dùng giọng nói hoặc nhập lệnh.");
  const [listening, setListening] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const sessionsRef = useRef<Session[]>([]);
  const frameRef = useRef<number>(0);
  const historiesRef = useRef<Map<string, number[][]>>(new Map());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speechWindow = window as SpeechWindow;
  const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  const speechSupported = Boolean(SpeechRecognitionCtor);

  const speak = (message: string) => {
    setVoiceStatus(message);
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "vi-VN";
    const vietnameseVoice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("vi"));
    if (vietnameseVoice) utterance.voice = vietnameseVoice;
    utterance.rate = 0.96;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    sessionsRef.current.forEach(s => {
      try { s.stream.getTracks().forEach(t => t.stop()); } catch { /* device may already be closed */ }
    });
    sessionsRef.current = [];
    void audioRef.current?.close();
    audioRef.current = null;
    setRunning(false);
  };

  useEffect(() => () => {
    recognitionRef.current?.stop();
    stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const refresh = async () => {
    setError("");
    try {
      if (!navigator.mediaDevices?.enumerateDevices) throw new Error("Trình duyệt không hỗ trợ liệt kê thiết bị âm thanh.");
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      permission.getTracks().forEach(track => track.stop());
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
      const next = list.map((d, i) => ({ deviceId: d.deviceId, label: d.label || "Microphone " + (i + 1) }));
      setDevices(next);
      setSelected(current => {
        const retained = current.filter(id => next.some(d => d.deviceId === id));
        return retained.length ? retained : next.slice(0, Math.min(4, next.length)).map(d => d.deviceId);
      });
      if (!next.length) setNotice("Không tìm thấy audio input. Kiểm tra quyền micro và kết nối USB/OTG.");
      else setNotice("Tìm thấy " + next.length + " đầu vào. Chọn các nguồn cần dùng trong cùng phép đo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể liệt kê micro.");
    }
  };

  const start = async () => {
    if (!selected.length) {
      setError("Hãy chọn ít nhất một đầu vào micro.");
      speak("Bạn hãy chọn ít nhất một nguồn micro trước khi bắt đầu đo.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const audio = new AudioContext();
    audioRef.current = audio;
    const opened: Session[] = [];
    const failed: string[] = [];
    try {
      await audio.resume();
      for (const id of selected) {
        const device = devices.find(d => d.deviceId === id);
        if (!device) continue;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: id },
              channelCount: { ideal: 1 },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            },
            video: false
          });
          const analyser = audio.createAnalyser();
          analyser.fftSize = 8192;
          analyser.smoothingTimeConstant = 0.35;
          audio.createMediaStreamSource(stream).connect(analyser);
          opened.push({
            id,
            label: device.label,
            stream,
            analyser,
            data: new Float32Array(analyser.frequencyBinCount)
          });
          historiesRef.current.set(id, []);
        } catch (e) {
          failed.push(device.label + ": " + (e instanceof Error ? e.message : "không mở được"));
        }
      }
      if (!opened.length) throw new Error("Không mở được nguồn nào. Android/WebView hoặc driver có thể giới hạn luồng thu đồng thời.");
      sessionsRef.current = opened;
      setChannels(opened.map(s => ({ id: s.id, label: s.label, history: [] })));
      setCombinedSpectrum([]);
      setRunning(true);
      setNotice(
        failed.length
          ? "Đang đo " + opened.length + " nguồn; không mở được: " + failed.join(" · ")
          : "Đang đo đồng thời " + opened.length + " nguồn trong cùng phiên. Mỗi nguồn vẫn có phổ riêng."
      );
      let lastTick = 0;
      const tick = (time: number) => {
        if (time - lastTick >= 250) {
          lastTick = time;
          const next: ChannelState[] = sessionsRef.current.map(s => {
            s.analyser.getFloatFrequencyData(s.data);
            const bands = toLogBands(s.data, audio.sampleRate);
            const history = [...(historiesRef.current.get(s.id) ?? []), bands].slice(-24);
            historiesRef.current.set(s.id, history);
            return { id: s.id, label: s.label, history };
          });
          setChannels(next);

          // Composite view uses a linear-power average per band, not an arithmetic average of dB.
          // It is only a relative overview because microphone sensitivities and clocks may differ.
          const latestFrames = next.map(channel => channel.history[channel.history.length - 1] ?? []);
          const combined = Array.from({ length: 64 }, (_, band) => {
            const values = latestFrames.map(frame => frame[band] ?? -120);
            const meanPower = values.reduce((sum, db) => sum + Math.pow(10, db / 10), 0) / Math.max(1, values.length);
            return 10 * Math.log10(Math.max(1e-12, meanPower));
          });
          setCombinedSpectrum(combined);
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
      speak("Bắt đầu đo thành công. Có " + opened.length + " nguồn âm thanh đang hoạt động.");
    } catch (e) {
      opened.forEach(s => s.stream.getTracks().forEach(t => t.stop()));
      await audio.close().catch(() => undefined);
      audioRef.current = null;
      setError(e instanceof Error ? e.message : "Không thể khởi động giám sát.");
      speak("Không thể bắt đầu phép đo. Hãy kiểm tra quyền micro và thiết bị đầu vào.");
    } finally {
      setBusy(false);
    }
  };

  const readReport = () => {
    if (!channels.length) {
      speak("Chưa có dữ liệu đo. Hãy quét thiết bị, chọn các nguồn và bắt đầu đo.");
      return;
    }
    const lines = channels.map(channel => {
      const latest = channel.history[channel.history.length - 1] ?? [];
      const level = latest.length ? Math.max(...latest) : -100;
      const peaks = detectNarrowPeaks(channel.history);
      const peakText = peaks.length
        ? peaks.slice(0, 2).map(p => Math.round(p.frequencyHz) + " héc").join(" và ")
        : "chưa có đỉnh hẹp ổn định";
      return channel.label + ": mức phổ lớn nhất " + level.toFixed(1) + " đề bê ép ét, " + peakText + ".";
    });
    speak("Báo cáo phép đo đa nguồn. Đang có " + channels.length + " nguồn. " + lines.join(" "));
  };

  const executeCommand = async (rawCommand: string) => {
    const command = normalizeCommand(rawCommand);
    if (!command) return;
    setVoiceText(rawCommand);
    if (/(dung do|dung phep do|stop|ket thuc do)/.test(command)) {
      stop();
      speak("Đã dừng phép đo.");
    } else if (/(quet micro|quet thiet bi|tim micro|tim thiet bi|refresh)/.test(command)) {
      await refresh();
      speak("Đã quét xong thiết bị. Chọn các nguồn cần đo trên màn hình.");
    } else if (/(bat dau do|do da nguon|do nhieu nguon|start measurement|bat dau phep do)/.test(command)) {
      await start();
    } else if (/(doc ket qua|bao cao|phan tich ket qua|tong quan phep do|doc so do)/.test(command)) {
      readReport();
    } else if (/(tro giup|huong dan|lenh nao)/.test(command)) {
      speak("Bạn có thể nói: quét micro, bắt đầu đo đa nguồn, dừng đo, hoặc đọc kết quả.");
    } else {
      speak("Tôi chưa nhận diện lệnh này. Hãy nói: quét micro, bắt đầu đo đa nguồn, dừng đo, hoặc đọc kết quả.");
    }
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (!SpeechRecognitionCtor) {
      speak("Thiết bị này chưa hỗ trợ nhận dạng giọng nói trong ứng dụng. Bạn có thể nhập lệnh ở ô bên dưới.");
      return;
    }
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "vi-VN";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = event => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? "";
        setVoiceText(transcript);
        void executeCommand(transcript);
      };
      recognition.onerror = event => {
        setVoiceStatus("Nhận dạng giọng nói lỗi: " + (event.error || "không xác định") + ". Có thể dùng ô nhập lệnh.");
      };
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setVoiceStatus("Đang nghe tiếng Việt…");
    } catch (e) {
      setListening(false);
      setVoiceStatus(e instanceof Error ? e.message : "Không khởi động được micro giọng nói.");
    }
  };

  return <section className="panel multi-mic-panel" id="multi-mic">
    <div className="heading"><Activity /><h2>Multi-Source Measurement · Đo đa nguồn</h2><span>{running ? "LIVE SESSION" : "STANDBY"}</span></div>
    <p className="muted">Chọn tối đa 4 đầu vào được hệ điều hành liệt kê riêng. Các nguồn được lấy mẫu trong cùng phiên đo, có RTA riêng và một phổ tổng hợp tham khảo.</p>

    <section className="multi-source-assistant">
      <div className="heading"><Brain /><h3>AI Voice Assistant · Trợ lý giọng nói</h3><span>VIETNAMESE</span></div>
      <p>Điều khiển bằng giọng nói: “Quét micro”, “Bắt đầu đo đa nguồn”, “Dừng đo”, “Đọc kết quả”. Trợ lý có thể đọc mức phổ và cảnh báo đỉnh nghi vấn theo dữ liệu đang đo. {speechSupported ? "Nhận dạng tiếng Việt được trình duyệt hỗ trợ." : "WebView này chưa hỗ trợ nhận dạng giọng nói; dùng ô nhập lệnh thay thế."}</p>
      <div className="voice-command-actions">
        <button className={listening ? "voice-listening" : "secondary"} onClick={toggleListening}>
          <Radio />{listening ? "Đang nghe · Dừng nghe" : "Nói lệnh tiếng Việt"}
        </button>
        <button className="secondary" onClick={readReport}><Volume2 />Đọc báo cáo đo</button>
      </div>
      <div className="voice-command-row">
        <input value={voiceText} onChange={event => setVoiceText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void executeCommand(voiceText); }} placeholder="Nhập lệnh: bắt đầu đo đa nguồn…" aria-label="Lệnh trợ lý giọng nói" />
        <button onClick={() => void executeCommand(voiceText)}><MessageSquareText />Gửi lệnh</button>
      </div>
      <div className="voice-assistant-status">{voiceStatus}</div>
      <p className="warning">Nhận dạng giọng nói phụ thuộc WebView/trình duyệt và dịch vụ speech trên thiết bị. Phần trợ lý hiện xử lý lệnh và tóm tắt tín hiệu tại máy; chưa kết nối mô hình ngôn ngữ đám mây hoặc gửi dữ liệu đo ra ngoài.</p>
    </section>

    <div className="multi-mic-toolbar">
      <button className="secondary" disabled={busy || running} onClick={() => void refresh()}><Mic2 /> Quét / cấp quyền nguồn</button>
      <button disabled={busy || (!running && !selected.length)} onClick={() => running ? stop() : void start()}>{running ? <Square /> : <Activity />}{busy ? "Đang mở thiết bị…" : running ? "Dừng phép đo" : "Bắt đầu đo cùng lúc"}</button>
    </div>
    {devices.length > 0 && <div className="multi-mic-select"><b>Chọn các nguồn tham gia cùng một phép đo (tối đa 4)</b>{devices.map((d, i) => <label key={d.deviceId}><input type="checkbox" checked={selected.includes(d.deviceId)} disabled={running || (!selected.includes(d.deviceId) && selected.length >= 4)} onChange={e => setSelected(current => e.target.checked ? [...current, d.deviceId] : current.filter(id => id !== d.deviceId))} /><span>{d.label || "Microphone " + (i + 1)}</span></label>)}</div>}
    {notice && <p className="device-notice">{notice}</p>}{error && <p className="error">{error}</p>}

    {channels.length > 0 && <section className="multi-source-composite">
      <div className="multi-mic-channel-head"><b><Activity /> Phổ tổng hợp · {channels.length} nguồn</b><span>POWER AVERAGE</span></div>
      <div className="mini-spectrum composite-spectrum">{combinedSpectrum.map((v, i) => <i key={i} style={{ height: Math.max(3, Math.min(100, (v + 100) * 1.05)) + "%" }} />)}</div>
      <p>Đây là trung bình công suất tuyến tính theo từng dải tần, không phải cộng dB trực tiếp. Phổ tổng hợp chỉ dùng xem xu hướng chung; không đại diện phép cộng pha, không phải SPL đã hiệu chuẩn.</p>
    </section>}

    {channels.map(channel => {
      const peaks = detectNarrowPeaks(channel.history);
      const latest = channel.history[channel.history.length - 1] ?? [];
      const level = latest.length ? Math.max(...latest) : -100;
      return <article className="multi-mic-channel" key={channel.id}>
        <div className="multi-mic-channel-head"><b><Mic2 /> {channel.label}</b><span>{level.toFixed(1)} dBFS</span></div>
        <div className="mini-spectrum">{latest.map((v, i) => <i key={i} style={{ height: Math.max(3, Math.min(100, (v + 100) * 1.05)) + "%" }} />)}</div>
        {peaks.length ? <div className="feedback-alert"><VolumeX /><b>{peaks.length} đỉnh nghi vấn:</b><span>{peaks.slice(0, 3).map(p => p.frequencyHz + " Hz").join(" · ")}</span></div> : <div className="feedback-clear"><ShieldCheck /><span>Chưa phát hiện đỉnh hẹp ổn định theo ngưỡng.</span></div>}
        {peaks.length > 0 && <div className="table-wrap"><table><thead><tr><th>Hz</th><th>Prominence</th><th>Persistence</th><th>Notch gợi ý</th><th>Q</th></tr></thead><tbody>{peaks.slice(0, 4).map(p => <tr key={p.index}><td>{p.frequencyHz}</td><td>{p.prominenceDb.toFixed(1)} dB</td><td>{p.persistence}%</td><td>{p.recommendedCutDb.toFixed(1)} dB</td><td>{p.q.toFixed(1)}</td></tr>)}</tbody></table></div>}
      </article>;
    })}
    <div className="permission-help"><b>Giới hạn đồng bộ và hiệu chuẩn</b><span>Các luồng cùng được cập nhật trong một phiên phần mềm, nhưng không bảo đảm cùng clock phần cứng hoặc cùng thời điểm lấy mẫu tuyệt đối. Độ nhạy/đáp tuyến từng micro khác nhau; cần hiệu chuẩn riêng từng nguồn trước khi so sánh mức SPL. Một interface USB đa kênh xuất hiện thành một device vẫn chưa tách được từng hardware channel trong bản này.</span></div>
    <p className="warning">Nếu Android/WebView chỉ cho phép một capture session hoặc driver không hỗ trợ mở đồng thời, ứng dụng sẽ báo từng nguồn không mở được. Không dùng phổ tổng hợp này để tính phase, delay tuyệt đối, SPL chứng nhận hoặc phản xạ đa kênh. Không tự động mute, tăng/giảm gain hay ghi EQ xuống mixer.</p>
  </section>;
}
