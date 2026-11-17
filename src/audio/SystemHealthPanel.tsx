import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import { assessAudioSystem, type AudioSystemSnapshot, type MicrophonePermissionState } from "./audioSystemHealth";

type ExtendedWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
  webkitSpeechRecognition?: unknown;
  SpeechRecognition?: unknown;
};

async function collectSnapshot(): Promise<AudioSystemSnapshot> {
  const mediaDevices = navigator.mediaDevices;
  const mediaDevicesAvailable = Boolean(mediaDevices?.enumerateDevices);
  const microphoneCaptureAvailable = Boolean(mediaDevices?.getUserMedia);
  let inputCount: number | null = null;
  let outputCount: number | null = null;

  if (mediaDevicesAvailable) {
    try {
      const devices = await mediaDevices.enumerateDevices();
      inputCount = devices.filter((device) => device.kind === "audioinput").length;
      outputCount = devices.filter((device) => device.kind === "audiooutput").length;
    } catch {
      // Keep counts unknown; a denied permission or transient Android route change is not a zero-device result.
    }
  }

  let microphonePermission: MicrophonePermissionState = "unknown";
  try {
    const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
    microphonePermission = permission.state;
  } catch {
    // Some Android WebViews do not expose microphone permission through the Permissions API.
  }

  const extendedWindow = window as ExtendedWindow;
  const AudioContextConstructor = window.AudioContext || extendedWindow.webkitAudioContext;
  const audioContextAvailable = typeof AudioContextConstructor === "function";
  const audioWorkletAvailable = Boolean(
    AudioContextConstructor && "audioWorklet" in AudioContextConstructor.prototype,
  );
  const outputSelectionAvailable = typeof HTMLMediaElement !== "undefined"
    && "setSinkId" in HTMLMediaElement.prototype;

  return {
    secureContext: window.isSecureContext,
    mediaDevicesAvailable,
    microphoneCaptureAvailable,
    audioContextAvailable,
    audioWorkletAvailable,
    outputSelectionAvailable,
    speechRecognitionAvailable: "SpeechRecognition" in extendedWindow
      || "webkitSpeechRecognition" in extendedWindow,
    microphonePermission,
    inputCount,
    outputCount,
    online: navigator.onLine,
  };
}

const stateLabel = {
  ready: "SẴN SÀNG",
  warning: "CẦN KIỂM TRA",
  blocked: "BỊ CHẶN",
} as const;

export default function SystemHealthPanel() {
  const [snapshot, setSnapshot] = useState<AudioSystemSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setSnapshot(await collectSnapshot());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đọc trạng thái hệ thống.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assessment = snapshot ? assessAudioSystem(snapshot) : null;

  return (
    <article className="panel">
      <div className="heading"><Activity /><h2>Chẩn đoán đường âm thanh</h2><span>SYSTEM PREFLIGHT</span></div>
      <p className="muted">
        Kiểm tra khả năng API và danh sách thiết bị mà không tự mở microphone, không phát âm thanh và không gửi dữ liệu ra ngoài.
      </p>
      <button type="button" className="secondary" onClick={() => void refresh()} disabled={busy}>
        <RefreshCw /> {busy ? "Đang kiểm tra…" : "Kiểm tra lại hệ thống"}
      </button>
      {error && <p className="error">{error}</p>}
      {assessment && snapshot && (
        <>
          <div className="dsp-device-summary">
            <div><small>TỔNG QUAN API</small><b>{stateLabel[assessment.overall]}</b></div>
            <div><small>MICROPHONE</small><b>{assessment.measurementGate === "available" ? "Đã cấp quyền" : assessment.measurementGate === "permission-required" ? "Cần cấp quyền" : "Không khả dụng"}</b></div>
            <div><small>INPUT / OUTPUT</small><b>{snapshot.inputCount ?? "?"} / {snapshot.outputCount ?? "?"}</b></div>
            <div><small>ĐỒNG BỘ ĐA KÊNH</small><b>{assessment.synchronousCaptureGate === "hardware-verification-required" ? "Cần xác minh phần cứng" : "AudioWorklet không khả dụng"}</b></div>
          </div>
          <div className="heading"><ShieldCheck /><h3>Kết quả từng mục</h3></div>
          <div className="tab-stack">
            {assessment.checks.map((check) => (
              <div className="item" key={check.id}>
                <b>{check.label} · {stateLabel[check.state]}</b>
                <small>{check.detail}</small>
              </div>
            ))}
          </div>
          <p className="warning">
            Lưu ý: kiểm tra API không xác nhận micro đang thu đúng cổng, output đang phát đúng thiết bị, hai kênh dùng chung clock, độ trễ ADC/DAC hay độ chính xác SPL. Cần kiểm thử bằng sound card, dây loopback có suy hao phù hợp và thiết bị Android thực tế.
          </p>
        </>
      )}
      {!snapshot && !error && <p className="muted">Đang đọc khả năng của trình duyệt và Android WebView…</p>}
    </article>
  );
}
