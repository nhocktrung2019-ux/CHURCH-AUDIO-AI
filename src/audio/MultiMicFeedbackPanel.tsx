import { useEffect, useRef, useState } from "react";
import { Activity, Mic2, ShieldCheck, Square, VolumeX } from "lucide-react";
import { detectNarrowPeaks } from "./feedback";
import { assessMultiSourceInput, multiSourceSynchronizationWarning, type MultiSourceInputAssessment } from "./multiSourceDiagnostics";
import { describeVietnameseFeedbackAlert } from "./feedbackAlerts";

type InputDevice = { deviceId: string; label: string };
type ChannelState = { id: string; label: string; history: number[][]; diagnostics: MultiSourceInputAssessment; trackState: "live" | "muted" | "ended" };
type Session = { id: string; label: string; stream: MediaStream; track: MediaStreamTrack; diagnostics: MultiSourceInputAssessment; analyser: AnalyserNode; data: Float32Array };
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

export default function MultiMicFeedbackPanel() {
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [channels, setChannels] = useState<ChannelState[]>([]);
  const [combinedSpectrum, setCombinedSpectrum] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const audioRef = useRef<AudioContext | null>(null);
  const sessionsRef = useRef<Session[]>([]);
  const frameRef = useRef<number>(0);
  const historiesRef = useRef<Map<string, number[][]>>(new Map());
  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    sessionsRef.current.forEach(s => {
      try { s.stream.getTracks().forEach(t => t.stop()); } catch { /* device may already be closed */ }
    });
    sessionsRef.current = [];
    const previousAudio = audioRef.current;
    audioRef.current = null;
    if (previousAudio && previousAudio.state !== "closed") {
      void previousAudio.close().catch(() => undefined);
    }
    setRunning(false);
  };

  useEffect(() => () => {
    stop();
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
    if (running || busy) {
      setNotice("Phép đo đa nguồn đang hoạt động hoặc khởi tạo. Hãy dừng phiên hiện tại trước khi bắt đầu phiên mới.");
      return;
    }
    if (!selected.length) {
      setError("Hãy chọn ít nhất một đầu vào micro trước khi bắt đầu đo.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    let audio: AudioContext | null = null;
    const opened: Session[] = [];
    const failed: string[] = [];
    try {
      const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Thiết bị không hỗ trợ Web Audio API. Hãy cập nhật Android System WebView/Chrome.");
      }
      audio = new AudioContextClass();
      const activeAudio = audio;
      audioRef.current = activeAudio;
      await activeAudio.resume();
      if (activeAudio.state !== "running") {
        throw new Error("Audio engine chưa chạy. Kiểm tra chế độ tiết kiệm pin hoặc chạm Bắt đầu đo lần nữa.");
      }
      for (const id of selected) {
        const device = devices.find(d => d.deviceId === id);
        if (!device) continue;
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: id },
              channelCount: { ideal: 1 },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            },
            video: false
          });
          const track = stream.getAudioTracks()[0];
          if (!track || track.readyState !== "live") {
            throw new Error("Thiết bị không trả về audio track đang hoạt động.");
          }
          const settings = track.getSettings?.() as (MediaTrackSettings & { latency?: number }) | undefined;
          const diagnostics = assessMultiSourceInput({
            requestedDeviceId: id,
            actualDeviceId: settings?.deviceId,
            trackState: track.muted ? "muted" : "live",
            sampleRate: settings?.sampleRate,
            channelCount: settings?.channelCount,
            latencySeconds: settings?.latency,
            echoCancellation: settings?.echoCancellation,
            noiseSuppression: settings?.noiseSuppression,
            autoGainControl: settings?.autoGainControl,
          });
          if (diagnostics.routeState === "mismatch") {
            throw new Error("Android/WebView trả về input khác với thiết bị đã chọn; nguồn này bị loại để tránh đo nhầm.");
          }
          const analyser = activeAudio.createAnalyser();
          analyser.fftSize = 8192;
          analyser.smoothingTimeConstant = 0.35;
          activeAudio.createMediaStreamSource(stream).connect(analyser);
          opened.push({
            id,
            label: device.label,
            stream,
            track,
            diagnostics,
            analyser,
            data: new Float32Array(analyser.frequencyBinCount)
          });
          stream = null; // ownership moves to the session list
          historiesRef.current.set(id, []);
        } catch (e) {
          stream?.getTracks().forEach(track => track.stop());
          failed.push(device.label + ": " + (e instanceof Error ? e.message : "không mở được"));
        }
      }
      if (!opened.length) throw new Error("Không mở được nguồn nào. Android/WebView hoặc driver có thể giới hạn luồng thu đồng thời.");
      sessionsRef.current = opened;
      setChannels(opened.map(s => ({ id: s.id, label: s.label, history: [], diagnostics: s.diagnostics, trackState: s.track.muted ? ("muted" as const) : ("live" as const) })));
      setCombinedSpectrum([]);
      setRunning(true);
      setNotice(
        failed.length
          ? "Đang giám sát " + opened.length + " luồng input độc lập; không mở được: " + failed.join(" · ")
          : multiSourceSynchronizationWarning(opened.length)
      );
      let lastTick = 0;
      const tick = (time: number) => {
        if (time - lastTick >= 250) {
          lastTick = time;
          const next: ChannelState[] = sessionsRef.current.map(s => {
            s.analyser.getFloatFrequencyData(s.data);
            const bands = toLogBands(s.data, activeAudio.sampleRate);
            const history = [...(historiesRef.current.get(s.id) ?? []), bands].slice(-24);
            historiesRef.current.set(s.id, history);
            const trackState = s.track.readyState === "ended" ? "ended" : s.track.muted ? "muted" : "live";
            return { id: s.id, label: s.label, history, diagnostics: s.diagnostics, trackState };
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
    } catch (e) {
      opened.forEach(s => s.stream.getTracks().forEach(t => t.stop()));
      if (audio && audio.state !== "closed") await audio.close().catch(() => undefined);
      if (audioRef.current === audio) audioRef.current = null;
      setError(e instanceof Error ? e.message : "Không thể khởi động giám sát.");
      setNotice("Không thể bắt đầu phép đo. Kiểm tra quyền micro, kết nối USB/OTG và thiết bị đầu vào.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="panel multi-mic-panel" id="multi-mic">
    <div className="heading"><Activity /><h2>Multi-Source Measurement · Đo đa nguồn</h2><span>{running ? "LIVE SESSION" : "STANDBY"}</span></div>
    <p className="muted">Chọn tối đa 4 đầu vào được hệ điều hành liệt kê riêng. Ứng dụng mở từng input thành luồng độc lập, hiển thị RTA riêng và phổ tổng hợp tham khảo; không giả định các luồng dùng chung hardware clock hoặc lấy mẫu đồng bộ.</p>

    <div className="multi-mic-toolbar">
      <button className="secondary" disabled={busy || running} onClick={() => void refresh()}><Mic2 /> Quét / cấp quyền nguồn</button>
      <button disabled={busy || (!running && !selected.length)} onClick={() => running ? stop() : void start()}>{running ? <Square /> : <Activity />}{busy ? "Đang mở thiết bị…" : running ? "Dừng phép đo" : "Bắt đầu đo cùng lúc"}</button>
    </div>
    {devices.length > 0 && <div className="multi-mic-select"><b>Chọn các nguồn tham gia cùng một phép đo (tối đa 4)</b>{devices.map((d, i) => <label key={d.deviceId}><input type="checkbox" checked={selected.includes(d.deviceId)} disabled={running || (!selected.includes(d.deviceId) && selected.length >= 4)} onChange={e => setSelected(current => e.target.checked ? [...current, d.deviceId] : current.filter(id => id !== d.deviceId))} /><span>{d.label || "Microphone " + (i + 1)}</span></label>)}</div>}
    {notice && <p className="device-notice">{notice}</p>}{error && <p className="error">{error}</p>}

    {channels.length > 0 && <section className="multi-source-composite">
      <div className="multi-mic-channel-head"><b><Activity /> Phổ xu hướng · {channels.length} nguồn</b><span>RELATIVE POWER VIEW</span></div>
      <div className="mini-spectrum composite-spectrum">{combinedSpectrum.map((v, i) => <i key={i} style={{ height: Math.max(3, Math.min(100, (v + 100) * 1.05)) + "%" }} />)}</div>
      <p>Đây là trung bình công suất tuyến tính theo từng dải tần, không phải cộng dB trực tiếp. Phổ xu hướng chỉ dùng tham khảo tổng quan giữa các input; chênh lệch độ nhạy, gain và latency từng micro có thể làm thay đổi kết quả. Không đại diện phép cộng pha và không phải SPL đã hiệu chuẩn.</p>
    </section>}

    {channels.map(channel => {
      const peaks = detectNarrowPeaks(channel.history);
      const feedbackAlert = describeVietnameseFeedbackAlert(peaks);
      const latest = channel.history[channel.history.length - 1] ?? [];
      const level = latest.length ? Math.max(...latest) : -100;
      return <article className="multi-mic-channel" key={channel.id}>
        <div className="multi-mic-channel-head"><b><Mic2 /> {channel.label}</b><span>{channel.trackState.toUpperCase()} · {level.toFixed(1)} dBFS</span></div>
        <div className="permission-help"><b>{channel.diagnostics.routeState === "verified" ? "Đã xác nhận input" : channel.diagnostics.routeState === "mismatch" ? "Input không khớp" : "Chưa xác nhận chính xác input"}</b><span>{channel.diagnostics.summary}</span></div>
        {channel.diagnostics.warnings.length > 0 && <p className="warning">{channel.diagnostics.warnings.join(" ")}</p>}
        <div className="mini-spectrum">{latest.map((v, i) => <i key={i} style={{ height: Math.max(3, Math.min(100, (v + 100) * 1.05)) + "%" }} />)}</div>
        {feedbackAlert.severity === "clear" ? (
          <div className="feedback-clear"><ShieldCheck /><span>{feedbackAlert.title}</span></div>
        ) : (
          <div className={`feedback-warning-banner ${feedbackAlert.severity}`} role={feedbackAlert.severity === "high" ? "alert" : "status"} aria-live={feedbackAlert.severity === "high" ? "assertive" : "polite"} aria-atomic="true">
            <div className="feedback-warning-title"><VolumeX /><b>{channel.label}: {feedbackAlert.title}</b></div>
            <p>{feedbackAlert.summary}</p>
            <small>{feedbackAlert.recommendation}</small>
          </div>
        )}
        {peaks.length > 0 && <div className="table-wrap"><table><thead><tr><th>Hz</th><th>Prominence</th><th>Persistence</th><th>Notch gợi ý</th><th>Q</th></tr></thead><tbody>{peaks.slice(0, 4).map(p => <tr key={p.index}><td>{p.frequencyHz}</td><td>{p.prominenceDb.toFixed(1)} dB</td><td>{p.persistence}%</td><td>{p.recommendedCutDb.toFixed(1)} dB</td><td>{p.q.toFixed(1)}</td></tr>)}</tbody></table></div>}
      </article>;
    })}
    <div className="permission-help"><b>Giới hạn đồng bộ và hiệu chuẩn</b><span>Các luồng cùng được cập nhật trong một phiên phần mềm, nhưng không bảo đảm cùng clock phần cứng hoặc cùng thời điểm lấy mẫu tuyệt đối. Độ nhạy/đáp tuyến từng micro khác nhau; cần hiệu chuẩn riêng từng nguồn trước khi so sánh mức SPL. Một interface USB đa kênh xuất hiện thành một device vẫn chưa tách được từng hardware channel trong bản này.</span></div>
    <p className="warning">Nếu Android/WebView chỉ cho phép một capture session hoặc driver không hỗ trợ mở đồng thời, ứng dụng sẽ báo từng nguồn không mở được. Không dùng phổ tổng hợp này để tính phase, delay tuyệt đối, SPL chứng nhận hoặc phản xạ đa kênh. Không tự động mute, tăng/giảm gain hay ghi EQ xuống mixer.</p>
  </section>;
}
