export type MicrophonePermissionState = "granted" | "prompt" | "denied" | "unknown";
export type HealthState = "ready" | "warning" | "blocked";

export type AudioSystemSnapshot = {
  secureContext: boolean;
  mediaDevicesAvailable: boolean;
  microphoneCaptureAvailable: boolean;
  audioContextAvailable: boolean;
  audioWorkletAvailable: boolean;
  outputSelectionAvailable: boolean;
  speechRecognitionAvailable: boolean;
  microphonePermission: MicrophonePermissionState;
  inputCount: number | null;
  outputCount: number | null;
  online: boolean;
};

export type AudioSystemCheck = {
  id: string;
  label: string;
  state: HealthState;
  detail: string;
};

export type AudioSystemAssessment = {
  overall: HealthState;
  measurementGate: "available" | "permission-required" | "blocked";
  synchronousCaptureGate: "hardware-verification-required" | "worklet-unavailable";
  checks: AudioSystemCheck[];
};

export function assessAudioSystem(snapshot: AudioSystemSnapshot): AudioSystemAssessment {
  const checks: AudioSystemCheck[] = [
    {
      id: "secure-context",
      label: "Ngữ cảnh bảo mật",
      state: snapshot.secureContext ? "ready" : "blocked",
      detail: snapshot.secureContext
        ? "Ứng dụng đang chạy trong secure context."
        : "Microphone capture thường bị chặn ngoài HTTPS hoặc môi trường localhost đáng tin cậy.",
    },
    {
      id: "media-capture",
      label: "API microphone",
      state: snapshot.mediaDevicesAvailable && snapshot.microphoneCaptureAvailable ? "ready" : "blocked",
      detail: snapshot.mediaDevicesAvailable && snapshot.microphoneCaptureAvailable
        ? "Trình duyệt cung cấp enumerateDevices và getUserMedia."
        : "Thiếu MediaDevices hoặc getUserMedia; không thể khởi tạo phép đo microphone.",
    },
    {
      id: "microphone-permission",
      label: "Quyền microphone",
      state: snapshot.microphonePermission === "denied"
        ? "blocked"
        : snapshot.microphonePermission === "granted" ? "ready" : "warning",
      detail: snapshot.microphonePermission === "granted"
        ? "Quyền microphone đang được cấp."
        : snapshot.microphonePermission === "denied"
          ? "Quyền đang bị từ chối. Cần mở cài đặt ứng dụng/trình duyệt để cấp lại."
          : "Chưa xác định hoặc chưa cấp quyền. Nhấn Bắt đầu đo để hệ thống hỏi quyền; kiểm tra lại sau đó.",
    },
    {
      id: "audio-context",
      label: "Web Audio",
      state: snapshot.audioContextAvailable ? "ready" : "blocked",
      detail: snapshot.audioContextAvailable
        ? "AudioContext có sẵn."
        : "AudioContext không khả dụng; bộ phân tích và bộ phát tín hiệu không thể hoạt động bình thường.",
    },
    {
      id: "audio-worklet",
      label: "AudioWorklet",
      state: snapshot.audioWorkletAvailable ? "ready" : "warning",
      detail: snapshot.audioWorkletAvailable
        ? "API AudioWorklet có sẵn; vẫn cần xác nhận luồng PCM và clock trên sound card thực."
        : "AudioWorklet không khả dụng; không coi phép đo Reference/Measurement đồng bộ là sẵn sàng.",
    },
    {
      id: "input-devices",
      label: "Thiết bị đầu vào",
      state: snapshot.inputCount === null || snapshot.inputCount === 0 ? "warning" : "ready",
      detail: snapshot.inputCount === null
        ? "Không đọc được danh sách input. Thử làm mới sau khi cấp quyền."
        : snapshot.inputCount === 0
          ? "Chưa thấy audio input. Kiểm tra micro tích hợp, USB OTG hoặc quyền Android."
          : `Trình duyệt liệt kê ${snapshot.inputCount} audio input; chưa xác minh model hoặc calibration.`,
    },
    {
      id: "output-devices",
      label: "Đầu ra âm thanh",
      state: snapshot.outputCount === null || snapshot.outputCount === 0 ? "warning" : "ready",
      detail: snapshot.outputCount === null
        ? "Không đọc được danh sách output."
        : snapshot.outputCount === 0
          ? "Không thấy output được liệt kê; đầu ra mặc định của hệ thống vẫn có thể hoạt động."
          : `Trình duyệt liệt kê ${snapshot.outputCount} audio output.`,
    },
    {
      id: "output-selection",
      label: "Chọn đầu ra riêng",
      state: snapshot.outputSelectionAvailable ? "ready" : "warning",
      detail: snapshot.outputSelectionAvailable
        ? "HTMLMediaElement.setSinkId có sẵn; vẫn phải kiểm tra tuyến âm thanh thực tế."
        : "Không hỗ trợ chọn output riêng; có thể phải dùng đầu ra mặc định của Android/trình duyệt.",
    },
    {
      id: "voice",
      label: "Nhận dạng giọng nói",
      state: snapshot.speechRecognitionAvailable ? "ready" : "warning",
      detail: snapshot.speechRecognitionAvailable
        ? "Web Speech Recognition API được phát hiện; nhà cung cấp nhận dạng có thể phụ thuộc WebView/dịch vụ bên ngoài."
        : "Không có Web Speech Recognition API; vẫn có thể nhập lệnh bằng bàn phím.",
    },
    {
      id: "network",
      label: "Kết nối mạng",
      state: snapshot.online ? "ready" : "warning",
      detail: snapshot.online
        ? "Thiết bị báo đang trực tuyến."
        : "Thiết bị báo ngoại tuyến; đo âm thanh cục bộ có thể vẫn hoạt động nhưng cập nhật/hỗ trợ trực tuyến bị hạn chế.",
    },
  ];

  const blocked = checks.some((check) => check.state === "blocked");
  const warned = checks.some((check) => check.state === "warning");
  const measurementBlocked =
    !snapshot.secureContext ||
    !snapshot.mediaDevicesAvailable ||
    !snapshot.microphoneCaptureAvailable ||
    !snapshot.audioContextAvailable ||
    snapshot.microphonePermission === "denied";

  return {
    overall: blocked ? "blocked" : warned ? "warning" : "ready",
    measurementGate: measurementBlocked
      ? "blocked"
      : snapshot.microphonePermission === "granted" ? "available" : "permission-required",
    // Browser API presence is not proof of a shared hardware clock or synchronized USB channels.
    synchronousCaptureGate: snapshot.audioWorkletAvailable
      ? "hardware-verification-required"
      : "worklet-unavailable",
    checks,
  };
}
