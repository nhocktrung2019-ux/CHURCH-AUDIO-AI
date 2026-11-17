import { useMemo, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { Activity, Play, Square, AlertTriangle, Download, Waves } from "lucide-react";
import { analyzeTransfer, makeReferenceNoise, measurePcmCaptureQuality, type TransferResult } from "./transfer";
import { countPcmFrameDiscontinuity } from "./pcmCapture.ts";
import { assessAutoEqReadiness, suggestParametricEq } from "./autoEq";
import { comparePhaseInBand } from "./phaseAlignment";
import { explainMicrophoneError, requestMicrophoneStream } from "./microphone";
import type { MicCalibrationPoint } from "./micCalibration";

export default function TransferFunctionPanel({ selectedInput, running, calibrationPoints = [] }: { selectedInput: string; running: boolean; calibrationPoints?: MicCalibrationPoint[] }) {
  const [result, setResult] = usePersistentState<TransferResult | null>("church-audio-transfer-latest",null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eqCopied, setEqCopied] = useState(false);
  const [referenceA, setReferenceA] = usePersistentState<TransferResult | null>("church-audio-transfer-reference-a",null);
  const [referenceB, setReferenceB] = usePersistentState<TransferResult | null>("church-audio-transfer-reference-b",null);
  const [crossoverHz, setCrossoverHz] = usePersistentState("church-audio-transfer-crossover",1000);
  const eqReadiness = useMemo(() => {
    if (!result) return null;
    const base = assessAutoEqReadiness(result.points);
    const quality = result.captureQuality;
    if (!quality) return { ...base, ready: false, reason: "Phép đo đã lưu từ phiên bản cũ chưa có metadata PCM thô. Hãy đo lại trước khi tạo Auto EQ." };
    if (quality.invalidSamplePercent > 0.01 || quality.clippedSamplePercent > 0.1) {
      return { ...base, ready: false, reason: "Dữ liệu PCM có mẫu lỗi hoặc clipping. Giảm mức vào, kiểm tra gain và đo lại." };
    }
    if (quality.rmsDbfs < -55 || quality.peakDbfs > -0.5) {
      return { ...base, ready: false, reason: "Mức PCM quá thấp hoặc quá sát full-scale. Điều chỉnh gain để có headroom rồi đo lại." };
    }
    return base;
  }, [result]);
  const eq = useMemo(
    () => result && eqReadiness?.ready ? suggestParametricEq(result.points) : [],
    [result, eqReadiness],
  );

  const measure = async () => {
    setBusy(true); setError(""); setNotice(""); setResult(null); setEqCopied(false);
    let stream: MediaStream | undefined, audio: AudioContext | undefined;
    let microphoneSource: MediaStreamAudioSourceNode | undefined;
    let legacyProcessor: ScriptProcessorNode | undefined;
    let workletNode: AudioWorkletNode | undefined;
    let silentGain: GainNode | undefined;
    let source: AudioBufferSourceNode | undefined, playbackGain: GainNode | undefined;
    try {
      if (running) throw new Error("Hãy dừng RTA trực tiếp trước khi đo Transfer Function.");
      const requested = await requestMicrophoneStream(selectedInput);
      stream = requested.stream;
      if (requested.usedFallbackInput) setNotice("Micro được chọn không khả dụng; đã chuyển sang micro mặc định.");
      audio = new AudioContext();
      await audio.resume();
      if (audio.state !== "running") throw new Error("Audio engine chưa chạy. Chạm đo lại và kiểm tra quyền micro.");

      const reference = makeReferenceNoise(audio.sampleRate, 5);
      const buffer = audio.createBuffer(1, reference.length, audio.sampleRate);
      buffer.copyToChannel(reference, 0);
      const blockSize = 2048;
      const blocks: Float32Array[] = [];
      let firstBlockPlaybackTime: number | null = null;
      let previousBlockPlaybackTime: number | null = null;
      let previousFrameEnd: number | null = null;
      let missedBlocks = 0;
      let captureEngine: "AudioWorklet" | "ScriptProcessor fallback" = "AudioWorklet";
      microphoneSource = audio.createMediaStreamSource(stream);

      if (audio.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        try {
          await audio.audioWorklet.addModule("/audio/pcm-capture-worklet.js");
          workletNode = new AudioWorkletNode(audio, "church-pcm-capture", {
            numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
            channelCountMode: "max", channelInterpretation: "speakers",
          });
          workletNode.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; frameStart: number; channelCount: number }>) => {
            const { pcm, frameStart } = event.data;
            if (!(pcm instanceof ArrayBuffer) || !Number.isInteger(frameStart)) {
              missedBlocks++;
              return;
            }
            if (previousFrameEnd !== null && frameStart !== previousFrameEnd) {
              missedBlocks += countPcmFrameDiscontinuity(previousFrameEnd, frameStart, blockSize);
            }
            previousFrameEnd = frameStart + pcm.byteLength / Float32Array.BYTES_PER_ELEMENT;
            if (firstBlockPlaybackTime === null) firstBlockPlaybackTime = frameStart / audio!.sampleRate;
            blocks.push(new Float32Array(pcm));
          };
          microphoneSource.connect(workletNode);
          silentGain = audio.createGain();
          silentGain.gain.value = 0;
          workletNode.connect(silentGain);
          silentGain.connect(audio.destination);
        } catch {
          workletNode?.disconnect();
          workletNode = undefined;
          captureEngine = "ScriptProcessor fallback";
          setNotice("AudioWorklet chưa khởi tạo được trên WebView này; đang dùng ScriptProcessor dự phòng đã lỗi thời. Không coi đây là chế độ đo chuẩn cuối cùng.");
        }
      } else {
        captureEngine = "ScriptProcessor fallback";
        setNotice("WebView không hỗ trợ AudioWorklet; đang dùng ScriptProcessor dự phòng đã lỗi thời. Nên cập nhật Android System WebView.");
      }

      if (!workletNode) {
        if (typeof audio.createScriptProcessor !== "function") {
          throw new Error("Thiết bị không hỗ trợ AudioWorklet hoặc ScriptProcessor. Cập nhật Android System WebView/Chrome rồi thử lại.");
        }
        legacyProcessor = audio.createScriptProcessor(blockSize, 1, 1);
        silentGain = audio.createGain();
        silentGain.gain.value = 0;
        legacyProcessor.onaudioprocess = (event) => {
          const playbackTime = event.playbackTime;
          if (!Number.isFinite(playbackTime)) { missedBlocks++; return; }
          if (firstBlockPlaybackTime === null) firstBlockPlaybackTime = playbackTime;
          if (previousBlockPlaybackTime !== null) {
            const expectedSeconds = blockSize / audio!.sampleRate;
            const elapsed = playbackTime - previousBlockPlaybackTime;
            if (elapsed > expectedSeconds * 1.5) missedBlocks += Math.max(1, Math.round(elapsed / expectedSeconds) - 1);
          }
          previousBlockPlaybackTime = playbackTime;
          const input = event.inputBuffer;
          if (!input.numberOfChannels) return;
          const pcm = new Float32Array(input.length);
          for (let channel = 0; channel < input.numberOfChannels; channel++) {
            const samples = input.getChannelData(channel);
            for (let i = 0; i < samples.length; i++) pcm[i] += samples[i] / input.numberOfChannels;
          }
          blocks.push(pcm);
        };
        microphoneSource.connect(legacyProcessor);
        legacyProcessor.connect(silentGain);
        silentGain.connect(audio.destination);
      }

      source = audio.createBufferSource();
      playbackGain = audio.createGain();
      source.buffer = buffer;
      playbackGain.gain.value = 0.18;
      source.connect(playbackGain).connect(audio.destination);
      const playbackStartTime = audio.currentTime + 0.25;
      source.start(playbackStartTime);
      await new Promise<void>(resolve => window.setTimeout(resolve, 5600));
      if (legacyProcessor) legacyProcessor.onaudioprocess = null;
      if (workletNode) workletNode.port.postMessage({ command: "stop" });

      if (!blocks.length || firstBlockPlaybackTime === null) {
        throw new Error("Không nhận được khung PCM từ microphone. Kiểm tra quyền, input và kết nối USB/OTG.");
      }
      if (missedBlocks > 0) {
        throw new Error("Luồng PCM bị mất hoặc sai thứ tự frame trong lúc đo. Hãy đóng ứng dụng dùng micro, giảm tải thiết bị và đo lại; kết quả không được dùng cho Auto EQ.");
      }
      const totalSamples = blocks.reduce((sum, block) => sum + block.length, 0);
      const captured = new Float32Array(totalSamples);
      let writeOffset = 0;
      for (const block of blocks) { captured.set(block, writeOffset); writeOffset += block.length; }
      const playbackOffsetSeconds = playbackStartTime - firstBlockPlaybackTime;
      if (!Number.isFinite(playbackOffsetSeconds) || playbackOffsetSeconds < 0 || playbackOffsetSeconds > 1) {
        throw new Error("Không xác định được thời điểm bắt đầu phát so với PCM capture. Hãy đo lại.");
      }
      const captureQuality = measurePcmCaptureQuality(captured);
      if (!captureQuality) throw new Error("Dữ liệu PCM không hợp lệ hoặc rỗng.");
      const measured = analyzeTransfer(
        reference, captured, audio.sampleRate, calibrationPoints, playbackOffsetSeconds,
      );
      if (!measured) throw new Error("Không tìm được tín hiệu tham chiếu đủ rõ. Kiểm tra loa, micro, tiếng ồn và mức phát.");
      const fallbackWarning = captureEngine === "ScriptProcessor fallback"
        ? " CẢNH BÁO: phiên đo đang dùng ScriptProcessor dự phòng đã lỗi thời; nên cập nhật WebView và đo lại bằng AudioWorklet."
        : "";
      if (measured.averageCoherence < 0.6) {
        setNotice("Coherence thấp: phép đo có thể bị nhiễu, phản xạ hoặc tín hiệu không ổn định. Không dùng EQ tự động từ lần đo này." + fallbackWarning);
      } else if (captureQuality.clippedSamplePercent > 0.1 || captureQuality.rmsDbfs < -55 || captureQuality.peakDbfs > -0.5) {
        setNotice("PCM đã được thu không nén. Tuy nhiên, mức vào/clipping chưa đạt điều kiện Auto EQ; điều chỉnh gain và đo lại." + fallbackWarning);
      } else if (captureEngine === "AudioWorklet") {
        setNotice("Đã thu PCM thô bằng AudioWorklet trên sample clock của AudioContext; pre-roll đã được bù. Đường đo vẫn là loa–phòng–micro, chưa phải loopback đồng bộ hai kênh.");
      } else {
        setNotice("Đã thu PCM bằng ScriptProcessor dự phòng; kết quả cần được kiểm tra lại bằng AudioWorklet trước khi dùng cho nghiệm thu." + fallbackWarning);
      }
      setResult({ ...measured, captureQuality });
    } catch (cause) {
      setError(explainMicrophoneError(cause));
    } finally {
      legacyProcessor && (legacyProcessor.onaudioprocess = null);
      workletNode && (workletNode.port.onmessage = null);
      microphoneSource?.disconnect();
      legacyProcessor?.disconnect();
      workletNode?.disconnect();
      silentGain?.disconnect();
      source?.disconnect(); playbackGain?.disconnect();
      stream?.getTracks().forEach(track => track.stop());
      await audio?.close().catch(() => undefined);
      setBusy(false);
    }
  };

  const exportEq = () => {
    if (!eq.length) return;
    const payload = {
      format: "Church Audio Parametric EQ Suggestion",
      status: "advisory-not-applied",
      generatedAt: new Date().toISOString(),
      requirements: "Verify by listening and repeat measurement before manual DSP entry. No parameters are written to hardware.",
      measurement: { sampleRate: result?.sampleRate, averageCoherence: result?.averageCoherence, captureQuality: result?.captureQuality },
      filters: eq.map((filter, index) => ({
        band: index + 1, type: "PEQ", frequencyHz: filter.frequencyHz,
        gainDb: filter.gainDb, q: filter.q, coherence: Number(filter.coherence.toFixed(3)),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "church-audio-peq-suggestion.json"; anchor.click();
    URL.revokeObjectURL(url);
    setEqCopied(true);
  };

  const phasePoints = result?.points.filter(p => p.frequencyHz >= 30 && p.frequencyHz <= 18000) ?? [];
  const phaseMin = phasePoints.length ? Math.min(...phasePoints.map(p => p.phaseDeg)) : -180;
  const phaseMax = phasePoints.length ? Math.max(...phasePoints.map(p => p.phaseDeg)) : 180;
  const phaseRange = Math.max(90, phaseMax - phaseMin);
  const phasePath = phasePoints.map((p, index) => {
    const x = Math.log(p.frequencyHz / 30) / Math.log(18000 / 30) * 740 + 10;
    const y = 100 - ((p.phaseDeg - phaseMin) / phaseRange) * 88;
    return (index ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }).join(" ");

  const phaseComparison = useMemo(() => {
    if (!referenceA || !referenceB) return null;
    return comparePhaseInBand(referenceA.points, referenceB.points, crossoverHz);
  }, [referenceA, referenceB, crossoverHz]);

  return <section className="panel transfer-pro-panel" id="transfer">
    <div className="heading"><Activity /><h2>Transfer Function · Magnitude · Phase · Coherence</h2><span>WELCH H1</span></div>
    <p className="muted">Tạo tín hiệu broadband tham chiếu, ghi micro, căn chỉnh thời gian và ước tính H1 transfer function bằng averaging. Coherence biểu thị mức tương quan giữa reference và response theo từng tần số.</p>
    {running && <p className="device-notice">Dừng RTA trực tiếp trước khi đo để tránh hai phiên ghi âm tranh microphone.</p>}
    <button disabled={busy || running} onClick={() => void measure()}>{busy ? <Square /> : <Play />}{busy ? "Đang phát và ghi 5 giây…" : "Chạy phép đo Transfer Function"}</button>
    {notice && <p className="device-notice">{notice}</p>}
    {error && <p className="error"><AlertTriangle /> {error}</p>}
    {result && <>
      <div className="metrics transfer-metrics">
        <article><small>RELATIVE PATH DELAY</small><strong>{result.estimatedDelayMs.toFixed(2)} <small>ms</small></strong></article>
        <article><small>AVERAGE COHERENCE · 100 Hz–10 kHz</small><strong>{(result.averageCoherence*100).toFixed(1)} <small>%</small></strong></article>
        <article><small>COHERENT BINS · ≥0.80</small><strong>{result.reliableBandPercent.toFixed(0)} <small>%</small></strong></article>
      </div>
      <p className="muted">Correlation { (result.confidence*100).toFixed(1) }% · {result.framesAveraged} Welch averages · {result.sampleRate.toLocaleString("vi-VN")} Hz · {result.points.length} bins</p>
      {result.captureQuality && <p className="muted">Raw PCM · Peak {result.captureQuality.peakDbfs.toFixed(1)} dBFS · RMS {result.captureQuality.rmsDbfs.toFixed(1)} dBFS · clipping {result.captureQuality.clippedSamplePercent.toFixed(3)}%</p>}
      <div className="response-chart"><span className="chart-label">RELATIVE MAGNITUDE · dB</span>{result.points.filter((_,i)=>i%2===0).map((point,index)=><i key={index} title={point.frequencyHz.toFixed(0)+" Hz · "+point.magnitudeDb.toFixed(1)+" dB · coh "+point.coherence.toFixed(2)} style={{height:Math.max(3,Math.min(100,(point.magnitudeDb+45)*1.5))+"%",opacity:point.coherence<.5?.28:1}} />)}</div>
      <div className="phase-panel"><div className="heading"><Waves /><h3>Time-aligned phase response</h3></div><svg viewBox="0 0 760 120" role="img" aria-label="Phase response"><path d="M10 12 H750 M10 56 H750 M10 100 H750" stroke="#354a55" strokeDasharray="4 4" fill="none"/><path d={phasePath} stroke="#e4b86f" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke"/></svg><div className="axis"><span>30 Hz</span><span>100 Hz</span><span>1 kHz</span><span>10 kHz</span><span>18 kHz</span></div></div>
      <div className="table-wrap"><table><thead><tr><th>Frequency</th><th>Magnitude</th><th>Phase aligned</th><th>Coherence</th></tr></thead><tbody>{result.points.filter((_,i)=>i%Math.max(1,Math.floor(result.points.length/16))===0).slice(0,16).map(point=><tr key={point.frequencyHz}><td>{point.frequencyHz.toFixed(0)} Hz</td><td>{point.magnitudeDb.toFixed(1)} dB</td><td>{point.phaseDeg.toFixed(0)}°</td><td><b className={point.coherence>=.8?"coherence-good":point.coherence>=.5?"coherence-mid":"coherence-low"}>{(point.coherence*100).toFixed(0)}%</b></td></tr>)}</tbody></table></div>
      <div className="phase-panel phase-align-panel"><div className="heading"><Activity/><h3>A/B Phase & Polarity comparison</h3><span>COHERENT BINS</span></div>
        <p className="muted">Đo loa A tại cùng vị trí microphone, lưu A; đổi sang loa B, giữ gain và xử lý không đổi, đo lại rồi lưu B. So sánh phase-shape và polarity tương đối quanh crossover.</p>
        <div className="phase-ab-controls"><label>CROSSOVER CENTER<select value={crossoverHz} onChange={event=>setCrossoverHz(+event.target.value)}><option value={80}>80 Hz</option><option value={100}>100 Hz</option><option value={120}>120 Hz</option><option value={150}>150 Hz</option><option value={200}>200 Hz</option><option value={250}>250 Hz</option><option value={500}>500 Hz</option><option value={1000}>1 kHz</option><option value={2000}>2 kHz</option></select></label><button className="secondary" onClick={()=>setReferenceA(result)}>Save current as A</button><button className="secondary" onClick={()=>setReferenceB(result)}>Save current as B</button></div>
        <div className="phase-ab-status"><span>A: <b>{referenceA?referenceA.points.length+" bins saved":"not saved"}</b></span><span>B: <b>{referenceB?referenceB.points.length+" bins saved":"not saved"}</b></span><button className="icon-button" onClick={()=>{setReferenceA(null);setReferenceB(null);}}>Reset A/B</button></div>
        {phaseComparison&&<div className="phase-ab-result"><article><small>MEAN PHASE B − A</small><b>{phaseComparison.meanPhaseDeg===null?"—":phaseComparison.meanPhaseDeg.toFixed(1)+"°"}</b></article><article><small>MAGNITUDE DELTA B − A</small><b>{phaseComparison.magnitudeDeltaDb===null?"—":phaseComparison.magnitudeDeltaDb.toFixed(1)+" dB"}</b></article><article><small>PHASE CONCENTRATION</small><b>{(phaseComparison.phaseConcentration*100).toFixed(0)}%</b></article><article><small>AVG COHERENCE</small><b>{(phaseComparison.averageCoherence*100).toFixed(0)}%</b></article><p>{phaseComparison.interpretation}</p></div>}
        <p className="warning">Important: each capture is independently time-aligned to its own correlation peak, so this tool does not retain the absolute A-to-B arrival-time difference. Use it only as a phase-shape/polarity diagnostic. True relative speaker delay requires a synchronous dual-channel reference/measurement chain, common clock and simultaneous capture.</p>
      </div>
      <div className="auto-eq-results">
        <div className="heading"><Waves /><h3>Auto EQ · PEQ cut suggestions</h3><span>{eq.length} FILTERS</span></div>
        {eqReadiness && <div className={eqReadiness.ready ? "feedback-clear" : "device-notice"}>
          <b>{eqReadiness.ready ? "Đủ điều kiện tạo PEQ tư vấn" : "Auto EQ đang bị khóa an toàn"}</b>
          <span>{eqReadiness.reason}</span>
          <small>{eqReadiness.coherentBins}/{eqReadiness.totalBins} bin coherence ≥0.80 · {eqReadiness.coherentPercent.toFixed(1)}% · trung bình {(eqReadiness.averageCoherence*100).toFixed(1)}%</small>
        </div>}
        {eq.length ? <>
          <div className="table-wrap"><table><thead><tr><th>Band</th><th>Frequency</th><th>Gain</th><th>Q</th><th>Coherence</th></tr></thead>
            <tbody>{eq.map((f,index)=><tr key={f.frequencyHz}><td>{index+1}</td><td>{f.frequencyHz.toLocaleString("vi-VN")} Hz</td><td><b>{f.gainDb.toFixed(1)} dB</b></td><td>{f.q.toFixed(1)}</td><td>{(f.coherence*100).toFixed(0)}%</td></tr>)}</tbody>
          </table></div>
          <button className="secondary" onClick={exportEq}><Download /> {eqCopied?"Xuất lại cấu hình PEQ":"Xuất cấu hình PEQ JSON"}</button>
        </> : <p className="muted">Không có filter phù hợp trong dữ liệu hiện tại. Không tự tạo boost để bù null hoặc vùng triệt tiêu pha.</p>}
      </div>
      <p className="warning">Delay hiển thị đã bù pre-roll đã biết nhưng vẫn là tổng latency của chuỗi phát–loa–phòng–micro–input, không phải delay loa tuyệt đối. Pha đã loại phần delay phân số sau khi time-align. A/B độc lập chỉ dùng kiểm tra phase-shape/polarity. Auto EQ chỉ đề xuất PEQ cắt khi PCM không clipping và coherence đạt ngưỡng; không tự ghi vào DSP.</p>
    </>}
    <p className="warning">Không thể chứng nhận pha/delay chuyên nghiệp qua một micro và loa mặc định: để căn delay tuyệt đối cần loopback/reference input có đồng hồ đồng bộ, thiết bị đo phù hợp và kiểm tra polarity. Giữ nguyên gain/processing giữa các lần đo.</p>
  </section>;
}

