export type DspFilterProposal = { frequencyHz: number; gainDb: number; q: number; type: "peaking"|"highpass"|"lowpass"|"notch" };
export type DspSafetyResult = { safeToExport: boolean; errors: string[]; warnings: string[] };
export function validateDspProposal(filters: DspFilterProposal[], context: { calibrated: boolean; measuredTransfer: boolean; maxFilters?: number }): DspSafetyResult {
  const errors: string[] = [], warnings: string[] = [];
  if (!Array.isArray(filters) || filters.length === 0) errors.push("Không có bộ lọc để xuất.");
  if (filters.length > (context.maxFilters ?? 24)) errors.push("Số bộ lọc vượt giới hạn cấu hình.");
  for (const [index, filter] of filters.entries()) {
    if (!Number.isFinite(filter.frequencyHz) || filter.frequencyHz < 20 || filter.frequencyHz > 20000) errors.push(`Filter ${index+1}: tần số phải trong 20 Hz–20 kHz.`);
    if (!Number.isFinite(filter.gainDb) || filter.gainDb < -12 || filter.gainDb > 0) errors.push(`Filter ${index+1}: chỉ cho phép cắt -12 đến 0 dB; không boost.`);
    if (!Number.isFinite(filter.q) || filter.q < 0.3 || filter.q > 12) errors.push(`Filter ${index+1}: Q phải trong 0,3–12.`);
  }
  if (!context.calibrated) warnings.push("Chưa có chuỗi đo SPL hiệu chuẩn; cấu hình chỉ là bản nháp tương đối.");
  if (!context.measuredTransfer) warnings.push("Chưa có Transfer Function đo thực; không được coi EQ là Auto EQ đã xác minh.");
  return { safeToExport: errors.length === 0 && context.calibrated && context.measuredTransfer, errors, warnings };
}
