export const PROJECT_BACKUP_FORMAT = "Church Audio Project";
export const PROJECT_BACKUP_SCHEMA_VERSION = 1;
export const PROJECT_BACKUP_PREFIX = "church-audio-";
export const PROJECT_BACKUP_MAX_BYTES = 20 * 1024 * 1024;
export const PROJECT_BACKUP_MAX_VALUE_BYTES = 5 * 1024 * 1024;
export const PROJECT_BACKUP_MAX_ENTRIES = 2000;

export type ValidatedProjectBackup = {
  valid: true;
  entries: Array<[string, string]>;
  exportedAt: string | null;
  totalBytes: number;
};
export type InvalidProjectBackup = { valid: false; reason: string };
export type ProjectBackupValidation = ValidatedProjectBackup | InvalidProjectBackup;

/** Validate the complete backup before any localStorage write is attempted. */
export function validateProjectBackup(input: unknown): ProjectBackupValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, reason: "Nội dung backup phải là một JSON object." };
  }
  const payload = input as Record<string, unknown>;
  if (payload.format !== PROJECT_BACKUP_FORMAT || payload.schemaVersion !== PROJECT_BACKUP_SCHEMA_VERSION) {
    return { valid: false, reason: "Sai định dạng hoặc phiên bản backup Church Audio Project." };
  }
  if (payload.exportedAt !== undefined && (typeof payload.exportedAt !== "string" || !Number.isFinite(Date.parse(payload.exportedAt)))) {
    return { valid: false, reason: "Thời điểm xuất backup không hợp lệ." };
  }
  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    return { valid: false, reason: "Backup không có vùng dữ liệu hợp lệ." };
  }
  const rawEntries = Object.entries(payload.data as Record<string, unknown>);
  if (rawEntries.length === 0) return { valid: false, reason: "Backup không chứa dữ liệu dự án." };
  if (rawEntries.length > PROJECT_BACKUP_MAX_ENTRIES) {
    return { valid: false, reason: `Backup vượt giới hạn ${PROJECT_BACKUP_MAX_ENTRIES} mục dữ liệu.` };
  }
  const entries: Array<[string, string]> = [];
  let totalBytes = 0;
  for (const [key, value] of rawEntries) {
    if (!key.startsWith(PROJECT_BACKUP_PREFIX) || key.length > 240) {
      return { valid: false, reason: "Backup chứa khóa ngoài phạm vi dữ liệu Church Audio hoặc khóa quá dài." };
    }
    if (typeof value !== "string") {
      return { valid: false, reason: `Giá trị của khóa ${key} không phải chuỗi hợp lệ.` };
    }
    const bytes = new TextEncoder().encode(value).byteLength;
    if (bytes > PROJECT_BACKUP_MAX_VALUE_BYTES) {
      return { valid: false, reason: `Mục ${key} vượt giới hạn 5 MB.` };
    }
    totalBytes += new TextEncoder().encode(key).byteLength + bytes;
    if (totalBytes > PROJECT_BACKUP_MAX_BYTES) {
      return { valid: false, reason: "Tổng dữ liệu backup vượt giới hạn 20 MB." };
    }
    entries.push([key, value]);
  }
  return { valid: true, entries, exportedAt: typeof payload.exportedAt === "string" ? payload.exportedAt : null, totalBytes };
}
