export type CalibrationRecord = {
  id: string; microphoneId: string; serialNumber: string; referenceLevelDbSpl: 94 | 114;
  measuredLevelDbSpl: number; correctionDb: number; calibratedAt: string; expiresAt: string;
  certificateRef?: string;
};
export type CalibrationAssessment = { status: "valid"|"expired"|"invalid"; correctionDb: number|null; reason: string };
export function assessCalibration(record: CalibrationRecord, now = new Date()): CalibrationAssessment {
  const calibrated = Date.parse(record.calibratedAt), expires = Date.parse(record.expiresAt);
  if (!record.id.trim() || !record.microphoneId.trim() || !record.serialNumber.trim() || !Number.isFinite(record.measuredLevelDbSpl) || !Number.isFinite(record.correctionDb) || !Number.isFinite(calibrated) || !Number.isFinite(expires) || record.measuredLevelDbSpl < 20 || record.measuredLevelDbSpl > 140 || expires <= calibrated) {
    return { status: "invalid", correctionDb: null, reason: "Hồ sơ hiệu chuẩn thiếu hoặc sai dữ liệu; không được dùng để xác nhận dB SPL." };
  }
  if (now.getTime() > expires) return { status: "expired", correctionDb: null, reason: "Hồ sơ hiệu chuẩn đã hết hạn." };
  const expectedCorrection = record.referenceLevelDbSpl - record.measuredLevelDbSpl;
  if (Math.abs(expectedCorrection - record.correctionDb) > 0.2) return { status: "invalid", correctionDb: null, reason: "Hệ số hiệu chỉnh không khớp mức tham chiếu và mức đo (sai lệch > 0,2 dB)." };
  return { status: "valid", correctionDb: record.correctionDb, reason: "Hồ sơ hợp lệ theo thông tin đã nhập; vẫn cần đối chiếu chứng chỉ và thiết bị thực tế." };
}
export function applyCalibrationOffset(rawDbSpl: number, record: CalibrationRecord, now = new Date()): number | null {
  const assessment = assessCalibration(record, now);
  if (assessment.status !== "valid" || !Number.isFinite(rawDbSpl) || rawDbSpl < 0 || rawDbSpl > 140) return null;
  return rawDbSpl + (assessment.correctionDb ?? 0);
}
