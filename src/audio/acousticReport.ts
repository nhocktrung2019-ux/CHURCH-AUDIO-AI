import type { MeasurementPosition } from "./measurementPositions";
import type { CalibrationRecord } from "./calibrationRecords";
export type ReportReading = { id: string; positionId: string; value: number; unit: "dB_SPL"|"dBFS"; evidence: "measured"|"manual"|"simulated"|"interpolated"; calibrationId?: string; sessionId: string; weighting: "A"|"C"|"Z" };
export type AcousticReportInput = { reportId: string; roomId: string; sessionId: string; createdAt: string; positions: MeasurementPosition[]; calibrations: CalibrationRecord[]; readings: ReportReading[] };
export type AcousticReport = { schemaVersion: 1; reportId: string; roomId: string; sessionId: string; createdAt: string; positions: MeasurementPosition[]; readings: Array<ReportReading & { acceptedForSpl: boolean; rejectionReason?: string }>; summary: { acceptedSplCount: number; rejectedCount: number; status: "ready"|"insufficient-data" } };
export function buildAcousticReport(input: AcousticReportInput, now = new Date()): AcousticReport {
  if (!input.reportId.trim() || !input.roomId.trim() || !input.sessionId.trim()) throw new Error("Báo cáo cần mã báo cáo, phòng và phiên đo.");
  const positions = new Map(input.positions.map((p) => [p.id, p]));
  const calibrations = new Map(input.calibrations.map((c) => [c.id, c]));
  let accepted = 0;
  const readings = input.readings.map((reading) => {
    let rejectionReason: string | undefined;
    if (reading.sessionId !== input.sessionId) rejectionReason = "Khác phiên đo.";
    else if (!positions.has(reading.positionId)) rejectionReason = "Không tìm thấy vị trí đo.";
    else if (reading.unit !== "dB_SPL") rejectionReason = "dBFS không được xem là dB SPL.";
    else if (reading.evidence !== "measured") rejectionReason = "Chỉ dữ liệu đo thực mới đủ điều kiện.";
    else if (!reading.calibrationId || !calibrations.has(reading.calibrationId)) rejectionReason = "Thiếu hồ sơ hiệu chuẩn.";
    else {
      const record = calibrations.get(reading.calibrationId)!;
      const expiry = Date.parse(record.expiresAt);
      if (!Number.isFinite(expiry) || now.getTime() > expiry) rejectionReason = "Hiệu chuẩn hết hạn hoặc ngày không hợp lệ.";
      else if (record.microphoneId.trim() === "") rejectionReason = "Hồ sơ hiệu chuẩn thiếu mã microphone.";
    }
    const acceptedForSpl = !rejectionReason && Number.isFinite(reading.value) && reading.value >= 20 && reading.value <= 140;
    if (!acceptedForSpl && !rejectionReason) rejectionReason = "Giá trị SPL ngoài phạm vi 20–140 dB.";
    if (acceptedForSpl) accepted++;
    return { ...reading, acceptedForSpl, ...(rejectionReason ? { rejectionReason } : {}) };
  });
  return { schemaVersion: 1, reportId: input.reportId, roomId: input.roomId, sessionId: input.sessionId, createdAt: input.createdAt, positions: input.positions, readings, summary: { acceptedSplCount: accepted, rejectedCount: readings.length-accepted, status: accepted >= 2 ? "ready" : "insufficient-data" } };
}
