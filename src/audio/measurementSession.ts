export type MeasurementSession = {
  schemaVersion: 1;
  sessionId: string;
  label: string;
  roomId: string;
  startedAt: string;
  operatorNote?: string;
};
export type MeasurementCaptureContext = {
  sessionId: string | null;
  capturedAt: string;
  inputDeviceId?: string;
  outputDeviceId?: string;
  positionId?: string;
  microphoneProfileId?: string;
  calibrationRecordId?: string;
  weighting?: "A" | "C" | "Z" | "unknown";
  timeWeighting?: "fast" | "slow" | "impulse" | "unknown";
};
export type SessionCompatibility = {
  compatible: boolean;
  reason: string;
  sessionIds: string[];
};

/** Creates an opaque session identifier without relying on browser-only crypto APIs. */
export function createMeasurementSession(label: string, roomId: string, now = new Date()): MeasurementSession {
  const cleanLabel = label.trim().slice(0, 80);
  const cleanRoom = roomId.trim().slice(0, 80);
  if (!cleanLabel) throw new Error("Tên phiên đo không được để trống.");
  if (!cleanRoom) throw new Error("Mã phòng/khu vực không được để trống.");
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return {
    schemaVersion: 1,
    sessionId: "ca-" + now.getTime().toString(36) + "-" + random,
    label: cleanLabel,
    roomId: cleanRoom,
    startedAt: now.toISOString(),
  };
}

export function createCaptureContext(
  session: MeasurementSession | null,
  values: Omit<MeasurementCaptureContext, "sessionId" | "capturedAt"> = {},
  now = new Date(),
): MeasurementCaptureContext {
  return {
    sessionId: session?.sessionId ?? null,
    capturedAt: now.toISOString(),
    ...values,
  };
}

/** Only captures explicitly stamped with the same non-empty session may be combined. */
export function assessSessionCompatibility(captures: Array<MeasurementCaptureContext | null | undefined>): SessionCompatibility {
  const valid = captures.filter((item): item is MeasurementCaptureContext => Boolean(item));
  const ids = [...new Set(valid.map((item) => item.sessionId).filter((id): id is string => Boolean(id)))];
  if (valid.length !== captures.length || valid.length < 2) {
    return { compatible: false, reason: "Thiếu metadata phiên đo ở một hoặc nhiều phân hệ.", sessionIds: ids };
  }
  if (ids.length !== 1 || valid.some((item) => !item.sessionId)) {
    return { compatible: false, reason: "Các phép đo không thuộc cùng một phiên có mã định danh.", sessionIds: ids };
  }
  const roomIds = [...new Set(valid.map((item) => item.positionId ? item.positionId.split(":")[0] : ""))];
  if (roomIds.some((room) => room && room !== roomIds[0])) {
    return { compatible: false, reason: "Các phép đo khác mã phòng/khu vực.", sessionIds: ids };
  }
  return { compatible: true, reason: "Các kết quả có cùng mã phiên. Vẫn cần xác nhận vị trí và chuỗi đo trước khi so sánh định lượng.", sessionIds: ids };
}

const ACTIVE_SESSION_KEY = "church-audio-active-measurement-session";
export function readActiveMeasurementSession(): MeasurementSession | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as MeasurementSession;
    return value?.schemaVersion === 1 && typeof value.sessionId === "string" ? value : null;
  } catch {
    return null;
  }
}
export function writeActiveMeasurementSession(session: MeasurementSession | null): void {
  try {
    if (typeof window !== "undefined") {
      if (session) window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
      else window.localStorage.removeItem(ACTIVE_SESSION_KEY);
      window.dispatchEvent(new CustomEvent("church-audio-session-updated", { detail: session }));
    }
  } catch {
    // Session persistence is best-effort; measurement itself must remain available.
  }
}
