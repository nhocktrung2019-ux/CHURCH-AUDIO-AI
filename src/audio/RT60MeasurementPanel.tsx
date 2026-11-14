import { useState } from "react";
import { Play, Square, AlertTriangle, Waves } from "lucide-react";
import { analyzeImpulseResponse, createLogSweep, type ImpulseResponseResult } from "./rt60";
import { explainMicrophoneError, requestMicrophoneStream } from "./microphone";

type Props = { selectedInput: string; running: boolean };
function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const length = Math.max(1, Math.floor(input.length * toRate / fromRate));
  const output = new Float32Array(length);
  const ratio = fromRate / toRate;
  for (let i = 0; i < length; i++) {
    const position = i * ratio, left = Math.floor(position), fraction = position - left;
    const a = input[Math.min(input.length - 1, left)] ?? 0;
    const b = input[Math.min(input.length - 1, left + 1)] ?? a;
    output[i] = a + (b - a) * fraction;
  }
  return output;
}
export default function RT60MeasurementPanel({ selectedInput, running }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<ImpulseResponseResult | null>(null);
  const [impulse, setImpulse] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(6);
  const [tailSeconds, setTailSeconds] = useState(4);

  const measure = async () => {
    setBusy(true); setError(""); setNotice(""); setResult(null); setImpulse(null);
    let stream: MediaStream | undefined;
    let audio: AudioContext | undefined;
    let source: AudioBufferSourceNode | undefined;
    let recorder: MediaRecorder | undefined;
    try {
      if (running) throw new Error("Hãy dừng RTA trước khi chạy sweep RT60 để chỉ có một phiên dùng microphone.");
      if (typeof MediaRecorder === "undefined") throw new Error("Thiết bị không hỗ trợ MediaRecorder.");
      const requested = await requestMicrophoneStream(selectedInput);
      stream = requested.stream;
      if (requested.usedFallbackInput) setNotice("Micro đã chọn không còn khả dụng; phép đo sử dụng micro mặc định.");
      audio = new AudioContext();
      await audio.resume();
      if (audio.state !== "running") throw new Error("Audio engine chưa chạy. Chạm nút đo lần nữa và kiểm tra quyền âm thanh.");
      const sweep = createLogSweep(audio.sampleRate, duration);
      const leadSeconds = 0.35;
      const leadSamples = Math.floor(leadSeconds * audio.sampleRate);
      const reference = new Float32Array(leadSamples + sweep.length);
      reference.set(sweep, leadSamples);
      const buffer = audio.createBuffer(1, sweep.length, audio.sampleRate);
      buffer.copyToChannel(sweep, 0);
      const chunks: BlobPart[] = [];
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 256000 } : undefined);
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise<Blob>((resolve, reject) => {
        recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType || mime || "audio/webm" }));
        recorder!.onerror = () => reject(new Error("MediaRecorder không thể ghi mẫu âm thanh."));
      });
      recorder.start();
      source = audio.createBufferSource();
      source.buffer = buffer;
      const gain = audio.createGain();
      gain.gain.value = 1;
      source.connect(gain).connect(audio.destination);
      source.start(audio.currentTime + leadSeconds);
      const totalSeconds = leadSeconds + duration + tailSeconds + 0.4;
      await new Promise<void>(resolve => window.setTimeout(resolve, totalSeconds * 1000));
      if (recorder.state === "recording") recorder.stop();
      const blob = await stopped;
      if (!blob.size) throw new Error("Bản ghi rỗng. Kiểm tra quyền micro và đầu vào âm thanh.");
      const decoded = await audio.decodeAudioData(await blob.arrayBuffer());
      const mono = new Float32Array(decoded.length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const samples = decoded.getChannelData(channel);
        for (let i = 0; i < samples.length; i++) mono[i] += samples[i] / decoded.numberOfChannels;
      }
      const sameRate = resampleLinear(mono, decoded.sampleRate, audio.sampleRate);
      const clipped = sameRate.reduce((sum, value) => sum + (Math.abs(value) >= 0.999 ? 1 : 0), 0);
      const clipPercent = 100 * clipped / Math.max(1, sameRate.length);
      if (clipPercent > 0.1) throw new Error("Tín hiệu ghi bị clipping (" + clipPercent.toFixed(1) + "% mẫu). Giảm gain/âm lượng và đo lại.");
      const analyzed = analyzeImpulseResponse(reference, sameRate, audio.sampleRate);
      if (!analyzed) throw new Error("Không giải chập được impulse response rõ. Kiểm tra loa, micro, khoảng cách, tiếng ồn và thử sweep lại.");
      if (analyzed.result.peakToNoiseDb < 20) setNotice("Tỷ lệ đỉnh/nhiễu thấp; RT60 chỉ nên xem là tham khảo. Tăng SNR hoặc giảm tiếng ồn nền.");
      else if (analyzed.result.quality !== "good") setNotice("Một số dải tần thiếu dynamic range hoặc độ tuyến tính. Hãy kiểm tra decay plot và đo lặp tại nhiều vị trí.");
      setResult(analyzed.result);
      setImpulse(analyzed.impulse);
    } catch (cause) {
      setError(explainMicrophoneError(cause));
    } finally {
      try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch { /* recorder already stopped */ }
      try { source?.stop(); } catch { /* source already ended */ }
      source?.disconnect();
      stream?.getTracks().forEach(track => track.stop());
      await audio?.close().catch(() => undefined);
      setBusy(false);
    }
  };

  const plot = impulse ? Array.from({ length: 480 }, (_, index) => {
    const start = Math.floor(index / 480 * impulse.length);
    const end = Math.max(start + 1, Math.floor((index + 1) / 480 * impulse.length));
    let peak = 0;
    for (let i = start; i < Math.min(end, impulse.length); i++) peak = Math.max(peak, Math.abs(impulse[i]));
    return { x: index, y: 110 - Math.min(100, peak * 100) };
  }) : [];
  return <section className="panel rt60-pro-panel" id="rt60">
    <div className="heading"><Waves /><h2>RT60 Studio · Impulse Response / Schroeder</h2><span>{result?.quality.toUpperCase() ?? "SWEEP"}</span></div>
    <p className="muted">Phát logarithmic sine sweep qua loa, thu micro và giải chập để lấy impulse response. Đường suy giảm Schroeder được lọc theo octave band, fit T20/T30 rồi ngoại suy RT60.</p>
    <div className="form-grid">
      <div><label>THỜI LƯỢNG SWEEP</label><select value={duration} onChange={e => setDuration(+e.target.value)} disabled={busy}><option value={4}>4 giây · nhanh</option><option value={6}>6 giây · mặc định</option><option value={10}>10 giây · SNR tốt hơn</option></select></div>
      <div><label>TAIL SAU SWEEP</label><select value={tailSeconds} onChange={e => setTailSeconds(+e.target.value)} disabled={busy}><option value={2}>2 giây</option><option value={4}>4 giây</option><option value={6}>6 giây</option></select></div>
    </div>
    <button disabled={busy || running} onClick={() => void measure()}>{busy ? <Square /> : <Play />}{busy ? "Đang sweep / ghi / phân tích…" : "Đo RT60 bằng sine sweep"}</button>
    {running && <p className="device-notice">Dừng RTA trước khi đo. Phép đo sẽ sử dụng micro riêng trong thời gian sweep và thu đuôi vang.</p>}
    {notice && <p className="device-notice">{notice}</p>}
    {error && <p className="error"><AlertTriangle /> {error}</p>}
    {result && <>
      <div className="metrics rt60-metrics">
        <article><small>RT60 MEDIAN · 500 Hz–2 kHz</small><strong>{result.recommendedRt60 === null ? "—" : result.recommendedRt60.toFixed(2)} <small>s</small></strong></article>
        <article><small>PEAK / NOISE</small><strong>{result.peakToNoiseDb.toFixed(1)} <small>dB</small></strong></article>
        <article><small>IR SAMPLE RATE</small><strong>{(result.sampleRate / 1000).toFixed(1)} <small>kHz</small></strong></article>
      </div>
      {impulse && <div className="ir-plot"><svg viewBox="0 0 480 120" role="img" aria-label="Impulse response plot"><path d="M0 110 H480 M0 60 H480" stroke="#3a515d" strokeDasharray="4 4" fill="none"/><polyline points={plot.map(p => p.x + "," + p.y).join(" ")} fill="none" stroke="#65d2b6" strokeWidth="1.4" vectorEffect="non-scaling-stroke"/></svg><small className="muted">Impulse response đã chuẩn hóa · 4 giây đầu sau direct peak</small></div>}
      <div className="table-wrap"><table><thead><tr><th>Octave band</th><th>RT20 → RT60</th><th>RT30 → RT60</th><th>Chosen RT60</th><th>Fit R²</th></tr></thead><tbody>{result.bands.map(b => <tr key={b.centerHz}><td>{b.centerHz >= 1000 ? (b.centerHz / 1000) + " kHz" : b.centerHz + " Hz"}</td><td>{b.rt20Seconds === null ? "—" : b.rt20Seconds.toFixed(2) + " s"}</td><td>{b.rt30Seconds === null ? "—" : b.rt30Seconds.toFixed(2) + " s"}</td><td><b>{b.rt60Seconds === null ? "—" : b.rt60Seconds.toFixed(2) + " s"}</b></td><td>{b.fitR2 === null ? "—" : b.fitR2.toFixed(3)}</td></tr>)}</tbody></table></div>
    </>}
    <p className="warning">Đo sweep qua loa và micro là phép đo in-situ, không phải buồng âm chuẩn. Kết quả còn phụ thuộc đáp ứng loa/micro, nén, tiếng ồn, hướng đặt micro, codec MediaRecorder và chất lượng giải chập. Để nghiệm thu cần micro đo có calibration file, soundcard phù hợp và đo lặp ở nhiều điểm; kiểm tra độ dốc/R² trước khi dùng.</p>
  </section>;
}
