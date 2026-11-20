import { useState } from "react";
import { Play, Square, AlertTriangle, Waves } from "lucide-react";
import { analyzeImpulseResponse, createLogSweep, type ImpulseResponseResult } from "./rt60";
import { explainMicrophoneError, requestMicrophoneStream } from "./microphone";
import { concatenatePcmChunks } from "./pcmCapture";

type Props = { selectedInput: string; running: boolean };

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
    let playback: AudioBufferSourceNode | undefined;
    let microphoneSource: MediaStreamAudioSourceNode | undefined;
    let processor: ScriptProcessorNode | undefined;
    let silentOutput: GainNode | undefined;
    let capturing = false;
    const pcmChunks: Float32Array[] = [];
    try {
      if (running) throw new Error("Hãy dừng RTA trước khi chạy sweep RT60 để chỉ có một phiên dùng microphone.");
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

      // Capture microphone as raw Float32 PCM at the AudioContext clock rate.
      // This avoids lossy MediaRecorder codecs and decode/resample timing drift.
      if (typeof audio.createScriptProcessor !== "function") {
        throw new Error("Thiết bị không hỗ trợ PCM callback capture. Cần AudioWorklet hoặc thiết bị trình duyệt tương thích.");
      }
      microphoneSource = audio.createMediaStreamSource(stream);
      processor = audio.createScriptProcessor(4096, 1, 1);
      silentOutput = audio.createGain();
      silentOutput.gain.value = 0;
      processor.onaudioprocess = event => {
        if (capturing) pcmChunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      microphoneSource.connect(processor);
      processor.connect(silentOutput);
      silentOutput.connect(audio.destination);
      capturing = true;

      const buffer = audio.createBuffer(1, sweep.length, audio.sampleRate);
      buffer.copyToChannel(sweep, 0);
      playback = audio.createBufferSource();
      playback.buffer = buffer;
      const gain = audio.createGain();
      gain.gain.value = 1;
      playback.connect(gain).connect(audio.destination);
      playback.start(audio.currentTime + leadSeconds);

      const totalSeconds = leadSeconds + duration + tailSeconds + 0.4;
      await new Promise<void>(resolve => window.setTimeout(resolve, totalSeconds * 1000));
      capturing = false;
      processor.onaudioprocess = null;
      const recorded = concatenatePcmChunks(pcmChunks, Math.ceil(totalSeconds * audio.sampleRate) + 8192);
      if (recorded.length < audio.sampleRate * (duration + 0.5)) {
        throw new Error("PCM capture quá ngắn hoặc bị gián đoạn. Kiểm tra quyền micro và thử lại.");
      }
      const clipped = recorded.reduce((sum, value) => sum + (Math.abs(value) >= 0.999 ? 1 : 0), 0);
      const clipPercent = 100 * clipped / Math.max(1, recorded.length);
      if (clipPercent > 0.1) throw new Error("Tín hiệu ghi bị clipping (" + clipPercent.toFixed(1) + "% mẫu). Giảm gain/âm lượng và đo lại.");

      const analyzed = analyzeImpulseResponse(reference, recorded, audio.sampleRate);
      if (!analyzed) throw new Error("Không giải chập được impulse response rõ. Kiểm tra loa, micro, khoảng cách, tiếng ồn và thử sweep lại.");
      if (analyzed.result.peakToNoiseDb < 20) setNotice("Tỷ lệ đỉnh/nhiễu thấp; RT60 chỉ nên xem là tham khảo. Tăng SNR hoặc giảm tiếng ồn nền.");
      else if (analyzed.result.quality !== "good") setNotice("Một số dải tần thiếu dynamic range hoặc độ tuyến tính. Hãy kiểm tra decay plot và đo lặp tại nhiều vị trí.");
      setResult(analyzed.result);
      setImpulse(analyzed.impulse);
    } catch (cause) {
      setError(explainMicrophoneError(cause));
    } finally {
      capturing = false;
      if (processor) { processor.onaudioprocess = null; processor.disconnect(); }
      microphoneSource?.disconnect();
      silentOutput?.disconnect();
      try { playback?.stop(); } catch { /* playback already ended */ }
      playback?.disconnect();
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
    <p className="muted">Phát logarithmic sine sweep qua loa, thu microphone bằng PCM Float32 trực tiếp theo clock AudioContext và giải chập để lấy impulse response. Đường suy giảm Schroeder được lọc theo octave band, fit T20/T30 rồi ngoại suy RT60.</p>
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
    <p className="warning">PCM trực tiếp loại bỏ codec lossy và bước giải mã MediaRecorder, nhưng ScriptProcessor vẫn phụ thuộc lịch chạy main thread và chưa thay thế AudioWorklet đồng bộ mẫu chuyên dụng. Kết quả là phép đo in-situ, không phải chứng nhận tiêu chuẩn; cần micro có calibration file, soundcard phù hợp, SNR/độ dốc đạt yêu cầu và đo lặp nhiều vị trí.</p>
  </section>;
}
