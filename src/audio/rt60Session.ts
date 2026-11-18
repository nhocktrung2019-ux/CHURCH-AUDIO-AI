import type { ImpulseResponseResult, Rt60BandResult } from "./rt60.ts";

export type Rt60RoomCondition = "occupied" | "unoccupied" | "unknown";
export type Rt60SessionCapture = {
  id: string;
  position: string;
  roomCondition: Rt60RoomCondition;
  inputLabel: string;
  usedFallbackInput: boolean;
  capturedAt: number;
  result: ImpulseResponseResult;
};
export type Rt60BandSummary = {
  centerHz: number;
  captureCount: number;
  medianRt60Seconds: number | null;
  minimumRt60Seconds: number | null;
  maximumRt60Seconds: number | null;
  spreadSeconds: number | null;
  medianFitR2: number | null;
  status: "supported" | "review" | "insufficient";
};
export type Rt60SessionAssessment = {
  status: "ready" | "review" | "blocked";
  captureCount: number;
  distinctPositionCount: number;
  sampleRate: number | null;
  roomCondition: Rt60RoomCondition | null;
  bands: Rt60BandSummary[];
  checks: Array<{ id: string; status: "pass" | "warning" | "fail"; detail: string }>;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle] ?? null
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function validBand(band: Rt60BandResult): boolean {
  return Number.isFinite(band.centerHz) && band.centerHz > 0 &&
    Number.isFinite(band.rt60Seconds) && (band.rt60Seconds as number) >= 0.1 &&
    (band.rt60Seconds as number) <= 10 &&
    Number.isFinite(band.fitR2) && (band.fitR2 as number) >= 0.75;
}

/**
 * Aggregates repeat RT60 sweeps across distinct room positions.
 * The result is an in-situ estimate and does not claim ISO 3382 compliance.
 */
export function assessRt60Session(
  captures: Rt60SessionCapture[],
  minimumPositions = 3,
): Rt60SessionAssessment {
  const checks: Rt60SessionAssessment["checks"] = [];
  const add = (id: string, status: "pass" | "warning" | "fail", detail: string) =>
    checks.push({ id, status, detail });
  if (!captures.length) {
    add("captures", "fail", "Chưa có phép đo RT60 nào được lưu.");
    return {
      status: "blocked", captureCount: 0, distinctPositionCount: 0,
      sampleRate: null, roomCondition: null, bands: [], checks,
    };
  }
  if (!Number.isInteger(minimumPositions) || minimumPositions < 2 || minimumPositions > 12) {
    add("minimum-positions", "fail", "Số vị trí tối thiểu phải từ 2 đến 12.");
    return {
      status: "blocked", captureCount: captures.length, distinctPositionCount: 0,
      sampleRate: null, roomCondition: null, bands: [], checks,
    };
  }
  const positions = new Set(captures.map((capture) => capture.position.trim().toLocaleLowerCase("vi")).filter(Boolean));
  const inputs = new Set(captures.map((capture) => capture.inputLabel.trim().toLocaleLowerCase("vi")));
  const rates = new Set(captures.map((capture) => capture.result.sampleRate));
  const conditions = new Set(captures.map((capture) => capture.roomCondition));
  const invalid = captures.some((capture) =>
    !capture.id.trim() || !capture.position.trim() || !capture.inputLabel.trim() ||
    !Number.isFinite(capture.capturedAt) ||
    !Number.isFinite(capture.result.sampleRate) || capture.result.sampleRate < 8000 ||
    !Number.isFinite(capture.result.peakToNoiseDb) || capture.result.peakToNoiseDb < 0 ||
    capture.result.quality === "invalid"
  );
  add("record-integrity", invalid ? "fail" : "pass",
    invalid ? "Có bản ghi thiếu vị trí, input hoặc metadata số không hợp lệ." : "Metadata các bản ghi hợp lệ.");
  add("input-consistency", inputs.size === 1 ? "pass" : "fail",
    inputs.size === 1 ? "Cùng chuỗi microphone đầu vào được ghi nhãn." : "Đầu vào microphone không đồng nhất.");
  add("sample-rate", rates.size === 1 ? "pass" : "fail",
    rates.size === 1 ? "Sample rate đồng nhất." : "Sample rate giữa các lần đo khác nhau.");
  add("room-condition", conditions.size === 1 && !conditions.has("unknown") ? "pass" : "warning",
    conditions.size === 1 && !conditions.has("unknown") ? "Tình trạng có người/không người đồng nhất." : "Tình trạng sử dụng phòng chưa xác định hoặc thay đổi.");
  const fallback = captures.some((capture) => capture.usedFallbackInput);
  add("input-route", fallback ? "warning" : "pass",
    fallback ? "Ít nhất một lần đo đã chuyển sang micro mặc định; cần xác nhận input thực tế." : "Không có lần đo nào báo fallback microphone.");
  add("spatial-coverage", positions.size >= minimumPositions ? "pass" : "warning",
    positions.size >= minimumPositions ? "Đủ số vị trí nghe độc lập theo cấu hình." :
      "Có " + positions.size + " vị trí; cần tối thiểu " + minimumPositions + " vị trí.");
  const bands = [...new Set(captures.flatMap((capture) => capture.result.bands.map((band) => band.centerHz)))].sort((a, b) => a - b);
  const summaries: Rt60BandSummary[] = bands.map((centerHz) => {
    const values = captures.flatMap((capture) => {
      const band = capture.result.bands.find((item) => item.centerHz === centerHz);
      return band && validBand(band) ? [{ rt: band.rt60Seconds as number, fit: band.fitR2 as number }] : [];
    });
    const readings = values.map((value) => value.rt);
    const center = median(readings);
    const minimum = readings.length ? Math.min(...readings) : null;
    const maximum = readings.length ? Math.max(...readings) : null;
    const spread = minimum !== null && maximum !== null ? maximum - minimum : null;
    return {
      centerHz, captureCount: readings.length, medianRt60Seconds: center,
      minimumRt60Seconds: minimum, maximumRt60Seconds: maximum,
      spreadSeconds: spread,
      medianFitR2: median(values.map((value) => value.fit)),
      status: readings.length < minimumPositions ? "insufficient" :
        readings.length !== captures.length || spread === null ? "review" : "supported",
    };
  });
  add("band-coverage", summaries.some((band) => band.status !== "supported") ? "warning" : "pass",
    summaries.some((band) => band.status !== "supported")
      ? "Một số octave band thiếu đủ kết quả fit hợp lệ từ mọi vị trí."
      : "Các octave band được tổng hợp có kết quả ở mọi vị trí.");
  const failed = checks.some((check) => check.status === "fail");
  const warned = checks.some((check) => check.status === "warning");
  return {
    status: failed ? "blocked" : warned ? "review" : "ready",
    captureCount: captures.length,
    distinctPositionCount: positions.size,
    sampleRate: rates.size === 1 ? captures[0]?.result.sampleRate ?? null : null,
    roomCondition: conditions.size === 1 ? captures[0]?.roomCondition ?? null : null,
    bands: summaries,
    checks,
  };
}
