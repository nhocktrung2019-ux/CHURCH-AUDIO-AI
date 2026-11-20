import { useState } from "react";
import { Play, Square, AlertTriangle, Waves } from "lucide-react";
import { analyzeImpulseResponse, createLogSweep, type ImpulseResponseResult } from "./rt60";
import { explainMicrophoneError, requestMicrophoneStream } from "./microphone";
import { concatenatePcmChunks, mixInterleavedPcmToMono } from "./pcmCapture.ts";
import { PcmCaptureIntegrityMonitor } from "./pcmCaptureIntegrity";

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
    let playbackGain: GainNode | undefined;
    let microphoneSource: MediaStreamAudioSourceNode | undefined;
    let workletNode: AudioWorkletNode | undefined;
    let silentOutput: GainNode | undefined;
    let stoppedPromise: Promise<void> | undefined;
    let resolveStopped: (() => void) | undefined;
    let metadataError = "";
    let firstFrame: number | null = null;
    let blockSequence = 0;
    const pcmChunks: Float32Array[] = [];
    try {
      if (running) throw new Error("Hãy dừng RTA trước khi chạy sweep RT60 để chỉ có một phiên dùng microphone.");
      const requested = await requestMicrophoneStream(selectedInput);
      stream = requested.stream;
      if (requested.usedFallbackInput) setNotice("Micro đã chọn không còn khả dụng; phép đo sử dụng micro mặc định.");
      audio = new AudioContext();
      await audio.resume();
      if (audio.state !== "running") throw new Error("Audio engine chưa chạy. Chạm nút đo lần nữa và kiểm tra quyền âm thanh.");
      if (!audio.audioWorklet || typeof AudioWorkletNode === "undefined") {
        throw new Error("RT60 PCM cần AudioWorklet. Hãy cập nhật Android System WebView/Chrome rồi thử lại; không tự chuyển sang codec nén.");
      }
      await audio.audioWorklet.addModule("/audio/pcm-capture-worklet.js");

      const sweep = createLogSweep(audio.sampleRate, duration);
      const monitor = new PcmCaptureIntegrityMonitor(audio.sampleRate);
      microphoneSource = audio.createMediaStreamSource(stream);
      workletNode = new AudioWorkletNode(audio, "church-pcm-capture", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCountMode: "max", channelInterpretation: "discrete",
      });
      stoppedPromise = new Promise<void>(resolve => { resolveStopped = resolve; });
      workletNode.port.onmessage = (event: MessageEvent<{
        type?: string; pcm?: ArrayBuffer; frameStart?: number; frameCount?: number;
        pcmChannelCount?: number; inputChannelCount?: number; channelMix?: string;
        sampleFormat?: string; sequence?: number; sampleRate?: number; reason?: string;
      }>) => {
        const message = event.data;
        if (message?.type === "stopped") { resolveStopped?.(); return; }
        if (message?.type === "capture-error") {
          metadataError = message.reason || "AudioWorklet capture error.";
          return;
        }
        if (message?.type !== "pcm" || !(message.pcm instanceof ArrayBuffer)
          || !Number.isSafeInteger(message.frameStart) || !Number.isSafeInteger(message.frameCount)
          || !Number.isInteger(message.pcmChannelCount) || !Number.isInteger(message.inputChannelCount)
          || !Number.isSafeInteger(message.sequence) || !Number.isFinite(message.sampleRate)
          || message.channelMix !== "interleaved-preserved" || message.sampleFormat !== "float32") {
          metadataError = "AudioWorklet gửi metadata PCM không hợp lệ.";
          return;
        }
        const interleaved = new Float32Array(message.pcm);
        const accepted = monitor.accept({
          frameStart: message.frameStart!, frameCount: message.frameCount!,
          sampleRate: message.sampleRate!, pcmChannelCount: message.pcmChannelCount!,
          inputChannelCount: message.inputChannelCount!, byteLength: message.pcm.byteLength,
        }, interleaved, message.sequence!, message.channelMix!, message.sampleFormat!);
        if (!accepted.valid) { metadataError = accepted.reason; return; }
        if (message.sequence !== blockSequence) { metadataError = "Thứ tự block PCM không liên tục."; return; }
        blockSequence++;
        if (firstFrame === null) firstFrame = message.frameStart!;
        const mono = mixInterleavedPcmToMono(interleaved, message.frameCount!, message.pcmChannelCount!);
        if (!mono) { metadataError = "Không thể downmix PCM đa kênh sang mono an toàn."; return; }
        pcmChunks.push(mono);
      };
      microphoneSource.connect(workletNode);
      silentOutput = audio.createGain();
      silentOutput.gain.value = 0;
      workletNode.connect(silentOutput);
      silentOutput.connect(audio.destination);

      // The reference pre-roll is derived from the exact AudioWorklet frame clock,
      // not an assumed zero point, so capture and playback share one sample timeline.
      const leadSeconds = 0.35;
      const playbackStartTime = audio.currentTime + leadSeconds;
      const playbackStartFrame = Math.round(playbackStartTime * audio.sampleRate);
      const buffer = audio.createBuffer(1, sweep.length, audio.sampleRate);
      buffer.copyToChannel(sweep, 0);
      playback = audio.createBufferSource();
      playback.buffer = buffer;
      playbackGain = audio.createGain();
      playbackGain.gain.value = 1;
      playback.connect(playbackGain).connect(audio.destination);
      playback.start(playbackStartTime);

      const totalSeconds = leadSeconds + duration + tailSeconds + 0.4;
      await new Promise<void>(resolve => window.setTimeout(resolve, totalSeconds * 1000));
      workletNode.port.postMessage({ command: "stop" });
      await stoppedPromise;
      workletNode.port.onmessage = null;
      if (metadataError) throw new Error("PCM capture integrity: " + metadataError);
      if (firstFrame === null || !pcmChunks.length) throw new Error("Không nhận được PCM từ AudioWorklet. Kiểm tra quyền micro và thiết bị đầu vào.");
      const leadSamples = playbackStartFrame - firstFrame;
      if (!Number.isSafeInteger(leadSamples) || leadSamples < 0 || leadSamples > audio.sampleRate) {
        throw new Error("Không xác định được pre-roll theo AudioWorklet frame clock. Hãy đo lại.");
      }
      const reference = new Float32Array(leadSamples + sweep.length);
      reference.set(sweep, leadSamples);
      const recorded = concatenatePcmChunks(pcmChunks, Math.ceil(totalSeconds * audio.sampleRate) + 8192);
      const integrity = monitor.getSnapshot();
      if (integrity.durationSeconds < duration + 0.25) {
        throw new Error("PCM capture quá ngắn hoặc bị gián đoạn (" + integrity.durationSeconds.toFixed(2) + " giây).");
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
      try { workletNode?.port.postMessage({ command: "stop" }); } catch { /* worklet already stopped */ }
      workletNode && (workletNode.port.onmessage = null);
      workletNode?.disconnect();
      microphoneSource?.disconnect();
      silentOutput?.disconnect();
      try { playback?.stop(); } catch { /* playback already ended */ }
      playback?.disconnect(); playbackGain?.disconnect();
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
    <p className="muted">Phát logarithmic sine sweep qua loa, thu PCM Float32 bằng AudioWorklet với kiểm tra frame continuity và giải chập trên cùng sample clock. Đường suy giảm Schroeder được lọc theo octave band, fit T20/T30 rồi ngoại suy RT60.</p>
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
    <p className="warning">AudioWorklet giữ block PCM theo frame clock của Web Audio và phát hiện mất/đảo frame; điều này không chứng minh ADC của USB interface dùng chung hardware clock với DAC. Kết quả là phép đo in-situ, không phải chứng nhận tiêu chuẩn; cần micro có calibration file, kiểm tra SNR/độ dốc và đo lặp nhiều vị trí.</p>
  </section>;
}
