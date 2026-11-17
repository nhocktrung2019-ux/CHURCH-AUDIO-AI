export type MultiSourceTrackState = "live" | "muted" | "ended";
export type MultiSourceRouteState = "verified" | "unconfirmed" | "mismatch";

export type MultiSourceInputEvidence = {
  requestedDeviceId: string;
  actualDeviceId?: string;
  trackState: MultiSourceTrackState;
  sampleRate?: number;
  channelCount?: number;
  latencySeconds?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
};

export type MultiSourceInputAssessment = {
  routeState: MultiSourceRouteState;
  trackState: MultiSourceTrackState;
  sampleRate: number | null;
  channelCount: number | null;
  latencyMs: number | null;
  processingFlags: string[];
  warnings: string[];
  summary: string;
  synchronization: "independent-stream-not-sample-synchronous";
};

function validPositive(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Assess one separately opened getUserMedia stream.
 * This deliberately never claims sample-accurate synchronization with another
 * independently opened device stream.
 */
export function assessMultiSourceInput(
  evidence: MultiSourceInputEvidence,
): MultiSourceInputAssessment {
  const actualId = evidence.actualDeviceId?.trim() ?? "";
  const requestedId = evidence.requestedDeviceId.trim();
  const routeState: MultiSourceRouteState = actualId && requestedId
    ? actualId === requestedId ? "verified" : "mismatch"
    : "unconfirmed";

  const sampleRate = validPositive(evidence.sampleRate);
  const channelCount = validPositive(evidence.channelCount);
  const latencySeconds = typeof evidence.latencySeconds === "number"
    && Number.isFinite(evidence.latencySeconds)
    && evidence.latencySeconds >= 0
    ? evidence.latencySeconds
    : null;

  const processingFlags: string[] = [];
  const warnings: string[] = [];

  if (routeState === "mismatch") {
    warnings.push("Thiết bị thực tế không khớp input đã chọn; không sử dụng nguồn này.");
  } else if (routeState === "unconfirmed") {
    warnings.push("WebView không cung cấp đủ device identity để xác nhận tuyến input đã chọn.");
  }

  if (evidence.trackState === "ended") warnings.push("Luồng microphone đã kết thúc.");
  if (evidence.trackState === "muted") warnings.push("Luồng microphone đang bị mute bởi hệ điều hành hoặc thiết bị.");

  if (sampleRate === null) warnings.push("Không đọc được sample rate thực từ track.");
  if (channelCount === null) warnings.push("Không đọc được số kênh thực từ track.");

  if (evidence.echoCancellation === true) processingFlags.push("Echo cancellation bật");
  if (evidence.noiseSuppression === true) processingFlags.push("Noise suppression bật");
  if (evidence.autoGainControl === true) processingFlags.push("Auto gain control bật");
  if (processingFlags.length) {
    warnings.push("Chuỗi thu đang có xử lý tự động; phổ/tương quan có thể bị thay đổi.");
  }
  if (
    evidence.echoCancellation === undefined ||
    evidence.noiseSuppression === undefined ||
    evidence.autoGainControl === undefined
  ) {
    warnings.push("Không xác nhận được toàn bộ trạng thái echo cancellation / noise suppression / AGC.");
  }

  const details = [
    sampleRate === null ? "sample rate chưa rõ" : `${sampleRate} Hz`,
    channelCount === null ? "số kênh chưa rõ" : `${channelCount} kênh`,
    latencySeconds === null ? "latency chưa rõ" : `latency báo cáo ${(latencySeconds * 1000).toFixed(1)} ms`,
  ];
  const routeText = routeState === "verified"
    ? "đã khớp input được chọn"
    : routeState === "mismatch" ? "input không khớp" : "chưa xác minh chính xác input";
  const trackText = evidence.trackState === "live"
    ? "track LIVE"
    : evidence.trackState === "muted" ? "track MUTED" : "track ENDED";

  return {
    routeState,
    trackState: evidence.trackState,
    sampleRate,
    channelCount,
    latencyMs: latencySeconds === null ? null : latencySeconds * 1000,
    processingFlags,
    warnings,
    summary: `${routeText} · ${trackText} · ${details.join(" · ")}`,
    synchronization: "independent-stream-not-sample-synchronous",
  };
}

export function multiSourceSynchronizationWarning(sourceCount: number): string {
  if (!Number.isInteger(sourceCount) || sourceCount < 1) {
    return "Chưa có nguồn âm thanh hoạt động.";
  }
  if (sourceCount === 1) {
    return "Đang giám sát một luồng input. Chưa xác minh calibration hoặc clock của phần cứng.";
  }
  return `Đang giám sát ${sourceCount} luồng input riêng. Chúng chạy trong cùng phiên phần mềm nhưng không được xác nhận chung hardware clock hoặc sample alignment; không dùng để tính phase, transfer function hay delay tuyệt đối giữa các nguồn.`;
}
