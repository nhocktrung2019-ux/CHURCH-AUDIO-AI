export type MicrophonePermissionState = "granted" | "denied" | "prompt" | "unknown";

export interface MicrophoneStreamResult {
  stream: MediaStream;
  usedFallbackInput: boolean;
}

function getAudioConstraints(deviceId?: string): MediaStreamConstraints {
  const audio: MediaTrackConstraints = {
    echoCancellation: { ideal: false },
    noiseSuppression: { ideal: false },
    autoGainControl: { ideal: false },
    // Ask for stereo when available; mono devices remain valid and are reported as such.\n    channelCount: { ideal: 2 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
  return { audio, video: false };
}

export async function requestMicrophoneStream(deviceId = ""): Promise<MicrophoneStreamResult> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("Microphone chỉ hoạt động trong ứng dụng Android hoặc trang HTTPS/localhost. Hãy mở đúng ứng dụng hoặc địa chỉ HTTPS.");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Thiết bị/trình duyệt không hỗ trợ mở microphone. Hãy cập nhật Chrome/WebView và kiểm tra kết nối mạng của ứng dụng.");
  }

  if (deviceId) {
    try {
      return {
        stream: await navigator.mediaDevices.getUserMedia(getAudioConstraints(deviceId)),
        usedFallbackInput: false,
      };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name !== "NotFoundError" && name !== "OverconstrainedError") throw error;

      // A selected USB/Bluetooth input may have disappeared or its ID may have changed.
      // Retry the system-default input instead of leaving the microphone unusable.
      return {
        stream: await navigator.mediaDevices.getUserMedia(getAudioConstraints()),
        usedFallbackInput: true,
      };
    }
  }

  return {
    stream: await navigator.mediaDevices.getUserMedia(getAudioConstraints()),
    usedFallbackInput: false,
  };
}

export async function readMicrophonePermission(): Promise<MicrophonePermissionState> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    // Several Android WebView versions do not expose the microphone permission descriptor.
    return "unknown";
  }
}

export function explainMicrophoneError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const detail = error instanceof Error ? error.message : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Quyền microphone đang bị từ chối. Trên Android: Cài đặt → Ứng dụng → Church Audio Analyzer → Quyền → Microphone → Cho phép; sau đó quay lại ứng dụng và thử lại.";
    case "NotFoundError":
      return "Không tìm thấy microphone. Hãy kết nối lại micro, kiểm tra micro USB/Bluetooth và chọn “Micro mặc định hệ thống”.";
    case "NotReadableError":
      return "Android không mở được nguồn âm thanh. Hãy đóng ứng dụng khác đang dùng micro (cuộc gọi, ghi âm, camera), kiểm tra quyền Microphone rồi thử lại.";
    case "OverconstrainedError":
      return "Microphone đã chọn không còn khả dụng hoặc không hỗ trợ cấu hình này. Hãy làm mới thiết bị và chọn lại micro.";
    case "SecurityError":
      return "Trình duyệt/WebView đang chặn microphone vì chính sách bảo mật. Hãy mở ứng dụng Android hoặc dùng trang HTTPS.";
    case "AbortError":
      return "Hệ thống đã ngắt yêu cầu mở microphone. Hãy thử lại; nếu vẫn lỗi, khởi động lại ứng dụng.";
    case "InvalidStateError":
      return "Trang ứng dụng chưa sẵn sàng để mở microphone. Hãy tải lại ứng dụng rồi thử lại.";
    default:
      return detail || "Không thể mở microphone. Hãy kiểm tra quyền truy cập và thiết bị đầu vào.";
  }
}
