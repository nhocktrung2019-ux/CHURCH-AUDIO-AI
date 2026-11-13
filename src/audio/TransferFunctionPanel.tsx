import { useMemo, useState } from "react";
import { Activity, Play, Square, AlertTriangle, Download, Waves } from "lucide-react";
import { analyzeTransfer, makeReferenceNoise, type TransferResult } from "./transfer";
import { suggestParametricEq } from "./acoustics";
import { explainMicrophoneError, requestMicrophoneStream } from "./microphone";

export default function TransferFunctionPanel({ selectedInput, running }: { selectedInput: string; running: boolean }) {
  const [result, setResult] = useState<TransferResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eqCopied, setEqCopied] = useState(false);
  const [referenceA, setReferenceA] = useState<TransferResult | null>(null);
  const [referenceB, setReferenceB] = useState<TransferResult | null>(null);
  const [crossoverHz, setCrossoverHz] = useState(1000);
  const eq = useMemo(() => result ? suggestParametricEq(result.points) : [], [result]);

  const measure = async () => {
    setBusy(true); setError(""); setNotice(""); setResult(null); setEqCopied(false);
    let stream: MediaStream | undefined, audio: AudioContext | undefined;
    let recorder: MediaRecorder | undefined, source: AudioBufferSourceNode | undefined, gain: GainNode | undefined;
    try {
      if (running) throw new Error("Hãy dừng RTA trực tiếp trước khi đo Transfer Function.");
      if (typeof MediaRecorder === "undefined") throw new Error("Trình duyệt này không hỗ trợ MediaRecorder.");
      const requested = await requestMicrophoneStream(selectedInput);
      stream = requested.stream;
      if (requested.usedFallbackInput) setNotice("Micro được chọn không khả dụng; đã chuyển sang micro mặc định.");
      audio = new AudioContext();
      await audio.resume();
      if (audio.state !== "running") throw new Error("Audio engine chưa chạy. Chạm đo lại và kiểm tra quyền micro.");
      const reference = makeReferenceNoise(audio.sampleRate, 5);
      const buffer = audio.createBuffer(1, reference.length, audio.sampleRate);
      buffer.copyToChannel(reference, 0);
      const chunks: BlobPart[] = [];
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 256000 } : undefined);
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const completed = new Promise<Blob>((resolve, reject) => {
        recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType || mime || "audio/webm" }));
        recorder!.onerror = () => reject(new Error("Không ghi được microphone."));
      });
      recorder.start();
      source = audio.createBufferSource();
      gain = audio.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.18;
      source.connect(gain).connect(audio.destination);
      source.start(audio.currentTime + 0.25);
      await new Promise<void>(resolve => window.setTimeout(resolve, 5600));
      if (recorder.state === "recording") recorder.stop();
      const blob = await completed;
      if (!blob.size) throw new Error("Bản ghi rỗng. Kiểm tra micro và đầu ra loa.");
      const decoded = await audio.decodeAudioData(await blob.arrayBuffer());
      const captured = new Float32Array(decoded.length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const samples = decoded.getChannelData(channel);
        for (let i = 0; i < samples.length; i++) captured[i] += samples[i] / decoded.numberOfChannels;
      }
      if (decoded.sampleRate !== audio.sampleRate) throw new Error("Sample rate của bản ghi và tín hiệu tham chiếu khác nhau. Dùng thiết bị/driver có sample rate đồng nhất rồi đo lại.");
      const measured = analyzeTransfer(reference, captured, audio.sampleRate);
      if (!measured) throw new Error("Không tìm được tín hiệu tham chiếu đủ rõ. Kiểm tra loa, micro, tiếng ồn và mức phát.");
      if (measured.averageCoherence < 0.6) setNotice("Coherence thấp: phép đo có thể bị nhiễu, phản xạ hoặc tín hiệu không ổn định. Không dùng EQ tự động từ lần đo này.");
      setResult(measured);
    } catch (cause) {
      setError(explainMicrophoneError(cause));
    } finally {
      source?.disconnect(); gain?.disconnect();
      try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch { /* already stopped */ }
      stream?.getTracks().forEach(track => track.stop());
      await audio?.close().catch(() => undefined);
      setBusy(false);
    }
  };

  const exportEq = () => {
    if (!eq.length) return;
    const payload = { format: "Church Audio Parametric EQ Suggestion", status: "advisory-not-applied", generatedAt: new Date().toISOString(), requirements: "Verify on a calibrated measurement chain before DSP entry.", filters: eq.map((filter, index) => ({ band: index + 1, type: "PEQ", frequencyHz: filter.frequencyHz, gainDb: filter.gainDb, q: filter.q, coherence: Number(filter.coherence.toFixed(3)) })) };
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
      <div className="response-chart"><span className="chart-label">RELATIVE MAGNITUDE · dB</span>{result.points.filter((_,i)=>i%2===0).map((point,index)=><i key={index} title={point.frequencyHz.toFixed(0)+" Hz · "+point.magnitudeDb.toFixed(1)+" dB · coh "+point.coherence.toFixed(2)} style={{height:Math.max(3,Math.min(100,(point.magnitudeDb+45)*1.5))+"%",opacity:point.coherence<.5?.28:1}} />)}</div>
      <div className="phase-panel"><div className="heading"><Waves /><h3>Time-aligned phase response</h3></div><svg viewBox="0 0 760 120" role="img" aria-label="Phase response"><path d="M10 12 H750 M10 56 H750 M10 100 H750" stroke="#354a55" strokeDasharray="4 4" fill="none"/><path d={phasePath} stroke="#e4b86f" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke"/></svg><div className="axis"><span>30 Hz</span><span>100 Hz</span><span>1 kHz</span><span>10 kHz</span><span>18 kHz</span></div></div>
      <div className="table-wrap"><table><thead><tr><th>Frequency</th><th>Magnitude</th><th>Phase aligned</th><th>Coherence</th></tr></thead><tbody>{result.points.filter((_,i)=>i%Math.max(1,Math.floor(result.points.length/16))===0).slice(0,16).map(point=><tr key={point.frequencyHz}><td>{point.frequencyHz.toFixed(0)} Hz</td><td>{point.magnitudeDb.toFixed(1)} dB</td><td>{point.phaseDeg.toFixed(0)}°</td><td><b className={point.coherence>=.8?"coherence-good":point.coherence>=.5?"coherence-mid":"coherence-low"}>{(point.coherence*100).toFixed(0)}%</b></td></tr>)}</tbody></table></div>
      <div className="phase-panel phase-align-panel"><div className="heading"><Activity/><h3>A/B Phase & Polarity comparison</h3><span>COHERENT BINS</span></div>
        <p className="muted">Đo loa A tại cùng vị trí microphone, lưu A; đổi sang loa B, giữ gain và xử lý không đổi, đo lại rồi lưu B. So sánh phase-shape và polarity tương đối quanh crossover.</p>
        <div className="phase-ab-controls"><label>CROSSOVER CENTER<select value={crossoverHz} onChange={event=>setCrossoverHz(+event.target.value)}><option value={80}>80 Hz</option><option value={100}>100 Hz</option><option value={120}>120 Hz</option><option value={150}>150 Hz</option><option value={200}>200 Hz</option><option value={250}>250 Hz</option><option value={500}>500 Hz</option><option value={1000}>1 kHz</option><option value={2000}>2 kHz</option></select></label><button className="secondary" onClick={()=>setReferenceA(result)}>Save current as A</button><button className="secondary" onClick={()=>setReferenceB(result)}>Save current as B</button></div>
        <div className="phase-ab-status"><span>A: <b>{referenceA?referenceA.points.length+" bins saved":"not saved"}</b></span><span>B: <b>{referenceB?referenceB.points.length+" bins saved":"not saved"}</b></span><button className="icon-button" onClick={()=>{setReferenceA(null);setReferenceB(null);}}>Reset A/B</button></div>
        {phaseComparison&&<div className="phase-ab-result"><article><small>MEAN PHASE B − A</small><b>{phaseComparison.meanPhaseDeg===null?"—":phaseComparison.meanPhaseDeg.toFixed(1)+"°"}</b></article><article><small>MAGNITUDE DELTA B − A</small><b>{phaseComparison.magnitudeDeltaDb===null?"—":phaseComparison.magnitudeDeltaDb.toFixed(1)+" dB"}</b></article><article><small>PHASE CONCENTRATION</small><b>{(phaseComparison.phaseConcentration*100).toFixed(0)}%</b></article><p>{phaseComparison.interpretation}</p></div>}
        <p className="warning">Important: each capture is independently time-aligned to its own correlation peak, so this tool does not retain the absolute A-to-B arrival-time difference. Use it only as a phase-shape/polarity diagnostic. True relative speaker delay requires a synchronous dual-channel reference/measurement chain, common clock and simultaneous capture.</p>
      </div>
      <div className="auto-eq-results"><div className="heading"><Waves /><h3>Auto EQ · PEQ cut suggestions</h3><span>{eq.length} FILTERS</span></div>{eq.length?<><div className="table-wrap"><table><thead><tr><th>Band</th><th>Frequency</th><th>Gain</th><th>Q</th><th>Coherence</th></tr></thead><tbody>{eq.map((f,index)=><tr key={f.frequencyHz}><td>{index+1}</td><td>{f.frequencyHz.toLocaleString("vi-VN")} Hz</td><td><b>{f.gainDb.toFixed(1)} dB</b></td><td>{f.q.toFixed(1)}</td><td>{(f.coherence*100).toFixed(0)}%</td></tr>)}</tbody></table></div><button className="secondary" onClick={exportEq}><Download /> {eqCopied?"Xuất lại cấu hình PEQ":"Xuất cấu hình PEQ JSON"}</button></>:<p className="muted">Chưa đủ số điểm có coherence cao để tạo filter đáng tin cậy. Cải thiện tín hiệu reference/micro và đo lại.</p>}</div>
      <p className="warning">Delay là độ trễ tương đối tổng hợp của đường phát–phòng–micro–codec, không phải delay loa tuyệt đối. Pha đã loại phần delay phân số sau khi time-align. Coherence của một đường thu qua loa không thay thế đo hai kênh reference/input cách ly. Auto EQ chỉ tạo PEQ cắt đỉnh từ dữ liệu có coherence cao; không tự ghi vào DSP.</p>
    </>}
    <p className="warning">Không thể chứng nhận pha/delay chuyên nghiệp qua một micro và loa mặc định: để căn delay tuyệt đối cần loopback/reference input có đồng hồ đồng bộ, thiết bị đo phù hợp và kiểm tra polarity. Giữ nguyên gain/processing giữa các lần đo.</p>
  </section>;
}
  const phaseComparison = useMemo(() => {
    if (!referenceA || !referenceB) return null;
    const low = crossoverHz / Math.SQRT2, high = crossoverHz * Math.SQRT2;
    const bByFrequency = new Map(referenceB.points.map(point => [Math.round(point.frequencyHz), point]));
    const paired = referenceA.points.filter(point => point.frequencyHz >= low && point.frequencyHz <= high && point.coherence >= .8).flatMap(point => {
      const other = bByFrequency.get(Math.round(point.frequencyHz));
      return other && other.coherence >= .8 ? [{ a: point, b: other }] : [];
    });
    if (paired.length < 3) return { count: paired.length, meanPhaseDeg: null as number | null, phaseConcentration: 0, magnitudeDeltaDb: null as number | null, interpretation: "Không đủ điểm có coherence ≥ 0.8 trong dải crossover." };
    const phaseDiff = paired.map(pair => {
      let angle = pair.b.phaseDeg - pair.a.phaseDeg;
      while (angle > 180) angle -= 360;
      while (angle < -180) angle += 360;
      return angle * Math.PI / 180;
    });
    const sin = phaseDiff.reduce((sum, value) => sum + Math.sin(value), 0) / phaseDiff.length;
    const cos = phaseDiff.reduce((sum, value) => sum + Math.cos(value), 0) / phaseDiff.length;
    const mean = Math.atan2(sin, cos) * 180 / Math.PI;
    const concentration = Math.hypot(sin, cos);
    const magnitudeDeltaDb = paired.reduce((sum, pair) => sum + pair.b.magnitudeDb - pair.a.magnitudeDb, 0) / paired.length;
    const absolute = Math.abs(mean);
    const interpretation = absolute >= 135 && concentration >= .7
      ? "Có dấu hiệu đảo cực / phase gần đối nhau. Kiểm tra polarity ở DSP và crossover."
      : absolute <= 45 && concentration >= .7
        ? "Pha trung bình gần trùng trong dải kiểm tra; vẫn cần kiểm tra theo từng điểm nghe."
        : "Có lệch pha đáng kể hoặc pha biến thiên; kiểm tra delay/crossover và đo lại đồng thời.";
    return { count: paired.length, meanPhaseDeg: mean, phaseConcentration: concentration, magnitudeDeltaDb, interpretation };
  }, [referenceA, referenceB, crossoverHz]);
