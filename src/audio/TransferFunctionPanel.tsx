import { useState } from "react";
import { Activity, Play, Square, AlertTriangle } from "lucide-react";
import { analyzeTransfer, makeReferenceNoise, type TransferResult } from "./transfer";
import { explainMicrophoneError, requestMicrophoneStream } from "./microphone";

export default function TransferFunctionPanel({
  selectedInput,
  running,
}: {
  selectedInput: string;
  running: boolean;
}) {
  const [result, setResult] = useState<TransferResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const measure = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);

    let stream: MediaStream | undefined;
    let audio: AudioContext | undefined;
    let recorder: MediaRecorder | undefined;
    let source: AudioBufferSourceNode | undefined;
    let gain: GainNode | undefined;

    try {
      if (running) {
        throw new Error("Hãy dừng RTA trực tiếp trước khi đo Transfer Function để nhường micro cho phép đo này.");
      }
      if (typeof MediaRecorder === "undefined") {
        throw new Error("Trình duyệt này không hỗ trợ ghi âm để đo Transfer Function.");
      }

      const requested = await requestMicrophoneStream(selectedInput);
      stream = requested.stream;
      if (requested.usedFallbackInput) {
        setNotice("Micro đã chọn không khả dụng; phép đo đang dùng micro mặc định hệ thống.");
      }

      audio = new AudioContext();
      await audio.resume();
      const reference = makeReferenceNoise(audio.sampleRate, 5);
      const buffer = audio.createBuffer(1, reference.length, audio.sampleRate);
      buffer.copyToChannel(reference, 0);

      const chunks: BlobPart[] = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const completed = new Promise<Blob>((resolve, reject) => {
        recorder!.onstop = () =>
          resolve(new Blob(chunks, { type: recorder!.mimeType || "audio/webm" }));
        recorder!.onerror = () => reject(new Error("Không ghi được microphone."));
      });

      recorder.start();
      source = audio.createBufferSource();
      gain = audio.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.25;
      source.connect(gain).connect(audio.destination);
      source.start(audio.currentTime + 0.25);

      await new Promise<void>((resolve) => window.setTimeout(resolve, 5600));
      if (recorder.state === "recording") recorder.stop();

      const blob = await completed;
      if (!blob.size) throw new Error("Bản ghi rỗng. Kiểm tra tín hiệu micro và thử lại.");

      const decoded = await audio.decodeAudioData(await blob.arrayBuffer());
      const captured = new Float32Array(decoded.length);
      for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex++) {
        const channel = decoded.getChannelData(channelIndex);
        for (let i = 0; i < captured.length; i++) {
          captured[i] += channel[i] / decoded.numberOfChannels;
        }
      }

      const measured = analyzeTransfer(reference, captured, audio.sampleRate);
      if (!measured) {
        throw new Error("Không tìm được tín hiệu tham chiếu rõ. Kiểm tra loa, microphone và giảm tiếng ồn.");
      }
      setResult(measured);
    } catch (cause) {
      setError(explainMicrophoneError(cause));
    } finally {
      source?.stop();
      source?.disconnect();
      gain?.disconnect();
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stream?.getTracks().forEach((track) => track.stop());
      await audio?.close().catch(() => undefined);
      setBusy(false);
    }
  };

  return (
    <section className="panel" id="transfer">
      <div className="heading">
        <Activity />
        <h2>Transfer Function · Phase · Delay</h2>
        <span>EXPERIMENTAL</span>
      </div>
      <p className="muted">
        Phát tín hiệu broadband mức thấp qua loa mặc định và ghi microphone đồng thời.
        Tắt các nguồn nhạc/PA khác, giữ gain cố định và đo tại một vị trí.
      </p>
      {running && (
        <p className="device-notice">
          Hãy dừng RTA trực tiếp trước khi đo để thiết bị Android không bị hai phiên ghi âm tranh micro.
        </p>
      )}
      <button disabled={busy || running} onClick={() => void measure()}>
        {busy ? <Square /> : <Play />}
        {busy ? "Đang phát/ghi 5 giây…" : "Đo Transfer Function"}
      </button>
      {notice && <p className="device-notice">{notice}</p>}
      {error && (
        <p className="error">
          <AlertTriangle /> {error}
        </p>
      )}

      {result && (
        <>
          <div className="metrics transfer-metrics">
            <article>
              <small>ESTIMATED RELATIVE DELAY</small>
              <strong>
                {result.estimatedDelayMs.toFixed(2)} <small>ms</small>
              </strong>
            </article>
            <article>
              <small>CORRELATION CONFIDENCE</small>
              <strong>
                {(result.confidence * 100).toFixed(1)} <small>%</small>
              </strong>
            </article>
            <article>
              <small>FREQUENCY BINS</small>
              <strong>{result.points.length}</strong>
            </article>
          </div>
          <div className="response-chart">
            {result.points
              .filter((_, index) => index % 2 === 0)
              .map((point, index) => (
                <i
                  key={index}
                  title={point.frequencyHz.toFixed(0) + " Hz · " + point.magnitudeDb.toFixed(1) + " dB"}
                  style={{
                    height: Math.max(3, Math.min(100, (point.magnitudeDb + 45) * 1.5)) + "%",
                  }}
                />
              ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Frequency</th>
                  <th>Magnitude (relative)</th>
                  <th>Phase</th>
                </tr>
              </thead>
              <tbody>
                {result.points
                  .filter((_, index) => index % Math.max(1, Math.floor(result.points.length / 12)) === 0)
                  .slice(0, 12)
                  .map((point) => (
                    <tr key={point.frequencyHz}>
                      <td>{point.frequencyHz.toFixed(0)} Hz</td>
                      <td>{point.magnitudeDb.toFixed(1)} dB</td>
                      <td>{point.phaseDeg.toFixed(0)}°</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="warning">
            Thử nghiệm: đồng hồ playback/record của thiết bị, độ trễ codec, phản xạ phòng và đồng hồ
            âm thanh không đồng bộ có thể làm sai pha/delay. Không dùng kết quả này để tự ghi DSP
            hoặc căn chỉnh hệ thống khi chưa kiểm chứng bằng thiết bị đo chuyên dụng.
          </p>
        </>
      )}
    </section>
  );
}
