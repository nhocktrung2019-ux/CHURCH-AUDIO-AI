import { useEffect, useRef, useState } from "react";
import { Activity, Mic2, ShieldCheck, Square, VolumeX } from "lucide-react";
import { detectNarrowPeaks } from "./feedback";

type InputDevice = { deviceId: string; label: string };
type ChannelState = { id: string; label: string; history: number[][]; error?: string };
type Session = { id: string; label: string; stream: MediaStream; analyser: AnalyserNode; data: Float32Array };

function toLogBands(data: Float32Array, sampleRate: number): number[] {
  const nyquist = sampleRate / 2, minHz = 20, maxHz = Math.min(20000, nyquist);
  const result: number[] = [];
  for (let band = 0; band < 64; band++) {
    const low = minHz * Math.pow(maxHz / minHz, band / 64);
    const high = minHz * Math.pow(maxHz / minHz, (band + 1) / 64);
    const first = Math.max(1, Math.floor(low / nyquist * data.length));
    const last = Math.min(data.length - 1, Math.max(first + 1, Math.ceil(high / nyquist * data.length)));
    let power = 0, count = 0;
    for (let i = first; i <= last; i++) { const amplitude = Math.pow(10, (data[i] ?? -120) / 20); power += amplitude * amplitude; count++; }
    result.push(20 * Math.log10(Math.max(1e-6, Math.sqrt(power / Math.max(1, count)))));
  }
  return result;
}

export default function MultiMicFeedbackPanel() {
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [channels, setChannels] = useState<ChannelState[]>([]);
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
    sessionsRef.current.forEach(s => { try { s.stream.getTracks().forEach(t => t.stop()); } catch {} });
    sessionsRef.current = [];
    void audioRef.current?.close();
    audioRef.current = null;
    setRunning(false);
  };

  useEffect(() => () => stop(), []);

  const refresh = async () => {
    setError("");
    try {
      if (!navigator.mediaDevices?.enumerateDevices) throw new Error("Trình duyệt không hỗ trợ liệt kê thiết bị âm thanh.");
      // Permission is requested only after the operator presses this button.
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      permission.getTracks().forEach(track => track.stop());
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
      const next = list.map((d, i) => ({ deviceId: d.deviceId, label: d.label || "Microphone " + (i + 1) }));
      setDevices(next);
      setSelected(current => current.filter(id => next.some(d => d.deviceId === id)).length ? current.filter(id => next.some(d => d.deviceId === id)) : next.slice(0, Math.min(4, next.length)).map(d => d.deviceId));
      if (!next.length) setNotice("Không tìm thấy audio input. Kiểm tra quyền micro và kết nối USB/OTG.");
      else setNotice("Tìm thấy " + next.length + " đầu vào. Chọn các micro cần giám sát rồi nhấn Bắt đầu.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể liệt kê micro."); }
  };

  const start = async () => {
    if (!selected.length) { setError("Hãy chọn ít nhất một đầu vào micro."); return; }
    setBusy(true); setError(""); setNotice("");
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
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id }, channelCount: { ideal: 1 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
          const analyser = audio.createAnalyser();
          analyser.fftSize = 8192;
          analyser.smoothingTimeConstant = 0.35;
          audio.createMediaStreamSource(stream).connect(analyser);
          opened.push({ id, label: device.label, stream, analyser, data: new Float32Array(analyser.frequencyBinCount) });
          historiesRef.current.set(id, []);
        } catch (e) { failed.push(device.label + ": " + (e instanceof Error ? e.message : "không mở được")); }
      }
      if (!opened.length) throw new Error("Không mở được micro đã chọn. Có thể Android/WebView chỉ cho phép một luồng thu tại một thời điểm.");
      sessionsRef.current = opened;
      setChannels(opened.map(s => ({ id: s.id, label: s.label, history: [] })));
      setRunning(true);
      setNotice(failed.length ? "Đã mở " + opened.length + " micro; một số đầu vào không mở được: " + failed.join(" · ") : "Đang giám sát " + opened.length + " luồng micro độc lập. Khả năng mở đồng thời tùy driver và Android.");
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
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (e) {
      opened.forEach(s => s.stream.getTracks().forEach(t => t.stop()));
      await audio.close().catch(() => undefined);
      audioRef.current = null;
      setError(e instanceof Error ? e.message : "Không thể khởi động giám sát.");
    } finally { setBusy(false); }
  };

  return <section className="panel multi-mic-panel" id="multi-mic">
    <div className="heading"><Activity /><h2>Multi-Mic Feedback Watch · Giám sát từng micro</h2><span>{running ? "LIVE" : "STANDBY"}</span></div>
    <p className="muted">Quét các thiết bị audio input riêng biệt và phân tích phổ độc lập từng luồng nếu hệ điều hành cho phép mở đồng thời. Mỗi kênh có lịch sử RTA và cảnh báo riêng.</p>
    <div className="multi-mic-toolbar">
      <button className="secondary" disabled={busy || running} onClick={() => void refresh()}><Mic2 /> Quét / cấp quyền micro</button>
      <button disabled={busy || (!running && !selected.length)} onClick={() => running ? stop() : void start()}>{running ? <Square /> : <Activity />}{busy ? "Đang mở thiết bị…" : running ? "Dừng giám sát" : "Bắt đầu giám sát đồng thời"}</button>
    </div>
    {devices.length > 0 && <div className="multi-mic-select"><b>Chọn micro đầu vào (tối đa 4 luồng để giảm tải)</b>{devices.map((d, i) => <label key={d.deviceId}><input type="checkbox" checked={selected.includes(d.deviceId)} disabled={running || (!selected.includes(d.deviceId) && selected.length >= 4)} onChange={e => setSelected(current => e.target.checked ? [...current, d.deviceId] : current.filter(id => id !== d.deviceId))} /><span>{d.label || "Microphone " + (i + 1)}</span></label>)}</div>}
    {notice && <p className="device-notice">{notice}</p>}{error && <p className="error">{error}</p>}
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
    <div className="permission-help"><b>Lưu ý quan trọng về nhiều micro</b><span>Đây là phân tích các thiết bị input được hệ điều hành liệt kê riêng. Nhiều cổng trên cùng một interface USB có thể xuất hiện như một thiết bị đa kênh; bản hiện tại chưa chọn được từng hardware channel trong cùng device. Muốn tách từng kênh cần driver/API multichannel phù hợp hoặc mixer gửi từng kênh qua USB. Nếu Android chỉ cho phép một capture session, ứng dụng sẽ báo lỗi thay vì giả lập dữ liệu.</span></div>
    <p className="warning">Phát hiện đỉnh phổ không chứng minh chắc chắn là feedback. Chỉ áp notch sau khi nghe và cô lập đúng micro. Không tự giảm gain, mute micro hay ghi EQ xuống mixer. Automix/ducker điều khiển mixer phần cứng chưa được tích hợp.</p>
  </section>;
}
