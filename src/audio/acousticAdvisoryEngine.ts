import { compareZoneLevels, type ZoneSplRecord } from "./zoneSplUniformity.ts";

export type QualityStatus = "ready" | "review" | "blocked";
export type QualityCheck = {
  id: string;
  status: "pass" | "warning" | "fail";
  detail: string;
};
export type RoomBounds = { lengthM: number; widthM: number };
export type SurveyQuality = {
  status: QualityStatus;
  checks: QualityCheck[];
  recordCount: number;
  zoneCount: number;
  distinctPositionCount: number;
};

const validLevel = (value: number) => Number.isFinite(value) && value > -99 && value <= 200;
const normalized = (value: string) => value.trim().toLocaleLowerCase("vi");

function uniqueCount(values: string[]): number {
  return new Set(values.map(normalized).filter(Boolean)).size;
}

/** Checks record integrity before analysis. It does not certify the meter or room. */
export function assessSurveyQuality(records: ZoneSplRecord[], room?: RoomBounds): SurveyQuality {
  const checks: QualityCheck[] = [];
  const add = (id: string, status: QualityCheck["status"], detail: string) =>
    checks.push({ id, status, detail });

  if (!records.length) {
    add("records", "fail", "Chưa có bản ghi đo thực tế.");
    return { status: "blocked", checks, recordCount: 0, zoneCount: 0, distinctPositionCount: 0 };
  }

  const units = new Set(records.map((record) => record.unit));
  const inputs = new Set(records.map((record) => normalized(record.inputLabel)));
  const zones = uniqueCount(records.map((record) => record.zone));
  const positions = uniqueCount(records.map((record) => record.position));

  add("unit-consistency", units.size === 1 ? "pass" : "fail",
    units.size === 1 ? "Tất cả bản ghi cùng đơn vị." : "Dữ liệu trộn dBFS và dB SPL; không được kết luận chung.");
  add("input-consistency", inputs.size === 1 && !inputs.has("") ? "pass" : "fail",
    inputs.size === 1 && !inputs.has("") ? "Cùng nhãn đầu vào microphone." : "Đầu vào microphone không đồng nhất hoặc thiếu nhãn.");
  add("zone-position-labels",
    records.every((record) => Boolean(record.zone.trim() && record.position.trim())) ? "pass" : "fail",
    "Tên vùng và vị trí nghe phải được ghi rõ.");

  const invalidValues = records.some((record) =>
    !validLevel(record.levelDb) || !validLevel(record.rawDbfs) ||
    !Number.isFinite(record.durationSeconds) || record.durationSeconds <= 0 ||
    !Number.isInteger(record.sampleCount) || record.sampleCount <= 0 ||
    !Number.isFinite(record.timestamp)
  );
  add("numeric-integrity", invalidValues ? "fail" : "pass",
    invalidValues ? "Có giá trị mức, thời lượng, số mẫu hoặc thời gian không hợp lệ." : "Các trường số cơ bản hợp lệ.");

  const coordinateInvalid = records.some((record) => {
    const hasX = Number.isFinite(record.xM);
    const hasY = Number.isFinite(record.yM);
    if (hasX !== hasY) return true;
    if (!hasX || !hasY) return false;
    if (record.xM! < 0 || record.yM! < 0) return true;
    return Boolean(room && (record.xM! > room.lengthM || record.yM! > room.widthM));
  });
  add("coordinates", coordinateInvalid ? "fail" : "pass",
    coordinateInvalid ? "Tọa độ X/Y thiếu cặp hoặc nằm ngoài kích thước phòng." : "Tọa độ đã nhập hợp lệ; bản ghi cũ không có tọa độ vẫn được giữ.");

  const splRecords = records.filter((record) => record.unit === "dB SPL");
  const offsets = splRecords.map((record) => record.calibrationOffsetDb);
  const knownOffsets = offsets.filter((offset): offset is number =>
    typeof offset === "number" && Number.isFinite(offset));
  const calibrationInvalid = splRecords.length > 0 && (
    knownOffsets.length !== splRecords.length ||
    splRecords.some((record) => Math.abs(record.levelDb - (record.rawDbfs + (record.calibrationOffsetDb ?? Number.NaN))) > 0.05) ||
    (knownOffsets.length === splRecords.length &&
      Math.max(...knownOffsets) - Math.min(...knownOffsets) > 0.01)
  );
  add("spl-calibration", calibrationInvalid ? "fail" : "pass",
    calibrationInvalid ? "Offset hiệu chuẩn thiếu, không đồng nhất hoặc không khớp level dB SPL với dBFS gốc."
      : splRecords.length ? "Offset được lưu nhất quán; vẫn cần xác nhận bằng calibrator tham chiếu."
        : "Bộ dữ liệu không được gán nhãn dB SPL.");

  const sparseZones = records.some((record) =>
    uniqueCount(records.filter((item) => item.zone === record.zone).map((item) => item.position)) < 2
  );
  add("spatial-coverage", sparseZones ? "warning" : "pass",
    sparseZones ? "Ít nhất một vùng có dưới hai vị trí nghe; chưa đủ cơ sở đánh giá phân bố không gian."
      : "Mỗi vùng có ít nhất hai vị trí nghe được đặt tên.");
  const lowSampleRecords = records.filter((record) => record.sampleCount < Math.max(5, record.durationSeconds * 3));
  add("sample-density", lowSampleRecords.length ? "warning" : "pass",
    lowSampleRecords.length ? String(lowSampleRecords.length) + " bản ghi có mật độ mẫu thấp hơn ngưỡng ứng dụng; cần đo lại nếu dùng cho quyết định cân chỉnh."
      : "Mật độ mẫu đạt ngưỡng tối thiểu của quy trình ứng dụng.");

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warning");
  return { status: hasFail ? "blocked" : hasWarning ? "review" : "ready",
    checks, recordCount: records.length, zoneCount: zones, distinctPositionCount: positions };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export type SurveyOutlier = {
  recordIds: number[];
  zone: string;
  position: string;
  levelDb: number;
  medianDb: number;
  deviationDb: number;
  reason: string;
};

/** Flags suspicious captures for human review; never removes or edits source records. */
export function detectSurveyOutliers(records: ZoneSplRecord[], minimumDeviationDb = 6): SurveyOutlier[] {
  if (!Number.isFinite(minimumDeviationDb) || minimumDeviationDb <= 0) return [];
  const valid = records.filter((record) => validLevel(record.levelDb) &&
    Boolean(record.zone.trim() && record.position.trim()));
  const buckets = new Map<string, ZoneSplRecord[]>();
  for (const record of valid) {
    const key = [record.zone, record.unit, record.inputLabel, record.position].map(normalized).join("|");
    const group = buckets.get(key) ?? [];
    group.push(record);
    buckets.set(key, group);
  }

  const flagged: SurveyOutlier[] = [];
  for (const group of buckets.values()) {
    if (group.length < 3) continue;
    const values = group.map((record) => record.levelDb);
    const center = median(values);
    const mad = median(values.map((value) => Math.abs(value - center)));
    for (const record of group) {
      const deviation = record.levelDb - center;
      const robustScore = mad > 0 ? 0.6745 * Math.abs(deviation) / mad : 0;
      if (Math.abs(deviation) >= minimumDeviationDb && (mad === 0 || robustScore >= 3.5)) {
        flagged.push({ recordIds: [record.id], zone: record.zone, position: record.position,
          levelDb: record.levelDb, medianDb: center, deviationDb: deviation,
          reason: "Giá trị khác biệt so với các lần đo lặp tại cùng vị trí; kiểm tra solo zone, tín hiệu phát, gain và thao tác đo." });
      }
    }
  }
  return flagged;
}

export type ZoneAdvisory = {
  zone: string;
  status: "balanced" | "low" | "high" | "insufficient";
  meanDb: number;
  deltaFromReferenceDb: number;
  recommendation: string;
};
export type AdvisoryPlan = {
  status: "available" | "insufficient-data";
  unit: "dBFS" | "dB SPL" | null;
  toleranceDb: number;
  zones: ZoneAdvisory[];
  safeguards: string[];
};

/** Builds technician-facing analysis notes only. It never computes DSP write commands. */
export function buildZoneAdvisoryPlan(records: ZoneSplRecord[], toleranceDb = 2): AdvisoryPlan {
  const rows = compareZoneLevels(records, toleranceDb);
  const unit = records.length ? records[0].unit : null;
  const safeguards = [
    "Đây là khuyến nghị khảo sát, không phải lệnh DSP.",
    "Không tự thay EQ, gain, delay, polarity, mute hoặc routing.",
    "Chỉ so sánh các vùng cùng đơn vị, cùng input và cùng chuỗi hiệu chuẩn.",
    "Xác minh solo đúng vùng loa và giữ nguyên điều kiện phát trước khi cân chỉnh.",
  ];
  if (!rows || !rows.length) return { status: "insufficient-data", unit, toleranceDb, zones: [], safeguards };
  return {
    status: "available", unit, toleranceDb,
    zones: rows.map((row) => ({
      zone: row.zone, status: row.status, meanDb: row.meanDb,
      deltaFromReferenceDb: row.deltaFromMeanDb,
      recommendation: row.status === "low"
        ? "Đo xác nhận lại; kiểm tra vùng phủ, hướng loa và mức tín hiệu trước khi kỹ thuật viên cân nhắc gain."
        : row.status === "high"
          ? "Đo xác nhận lại; kiểm tra chồng lấn vùng phủ và vị trí loa trước khi kỹ thuật viên cân nhắc gain."
          : row.status === "insufficient"
            ? "Bổ sung ít nhất hai vị trí nghe độc lập cho vùng này."
            : "Tiếp tục kiểm tra đáp tuyến và độ rõ lời nói; cân bằng SPL không tự chứng minh chất lượng âm thanh.",
    })),
    safeguards,
  };
}

export type SessionComparisonRow = {
  zone: string;
  matchedPositions: number;
  beforeMeanDb: number;
  afterMeanDb: number;
  deltaAfterMinusBeforeDb: number;
  beforeSpreadDb: number;
  afterSpreadDb: number;
  spreadChangeDb: number;
};
export type SessionComparison = {
  unit: "dBFS" | "dB SPL";
  inputLabel: string;
  rows: SessionComparisonRow[];
  note: string;
};

/** Compares before/after only at matched positions and under the same measurement chain. */
export function compareSurveySessions(
  before: ZoneSplRecord[], after: ZoneSplRecord[],
): SessionComparison | null {
  if (!before.length || !after.length) return null;
  const all = [...before, ...after];
  const unit = all[0].unit;
  const input = normalized(all[0].inputLabel);
  if (all.some((record) => record.unit !== unit || normalized(record.inputLabel) !== input ||
    !validLevel(record.levelDb) || !Number.isFinite(record.durationSeconds) || record.durationSeconds <= 0)) return null;
  if (unit === "dB SPL") {
    const offsets = all.map((record) => record.calibrationOffsetDb);
    const known = offsets.filter((offset): offset is number => typeof offset === "number" && Number.isFinite(offset));
    if (known.length !== offsets.length || Math.max(...known) - Math.min(...known) > 0.01) return null;
  }

  const aggregate = (records: ZoneSplRecord[]) => {
    const groups = new Map<string, ZoneSplRecord[]>();
    for (const record of records) {
      const key = normalized(record.zone) + "|" + normalized(record.position);
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }
    const result = new Map<string, number>();
    for (const [key, captures] of groups) {
      const duration = captures.reduce((sum, record) => sum + record.durationSeconds, 0);
      const energy = captures.reduce((sum, record) =>
        sum + 10 ** (record.levelDb / 10) * record.durationSeconds, 0) / duration;
      if (duration > 0 && energy > 0 && Number.isFinite(energy)) result.set(key, 10 * Math.log10(energy));
    }
    return result;
  };
  const oldMap = aggregate(before);
  const newMap = aggregate(after);
  const zones = new Set(before.map((record) => record.zone).filter((zone) =>
    after.some((record) => normalized(record.zone) === normalized(zone))));
  const rows: SessionComparisonRow[] = [];
  for (const zone of zones) {
    const oldValues: number[] = [];
    const newValues: number[] = [];
    for (const [key, oldLevel] of oldMap) {
      if (!key.startsWith(normalized(zone) + "|")) continue;
      const newLevel = newMap.get(key);
      if (newLevel !== undefined) { oldValues.push(oldLevel); newValues.push(newLevel); }
    }
    if (oldValues.length < 2) continue;
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    rows.push({
      zone, matchedPositions: oldValues.length,
      beforeMeanDb: average(oldValues), afterMeanDb: average(newValues),
      deltaAfterMinusBeforeDb: average(newValues) - average(oldValues),
      beforeSpreadDb: spread(oldValues), afterSpreadDb: spread(newValues),
      spreadChangeDb: spread(newValues) - spread(oldValues),
    });
  }
  if (!rows.length) return null;
  return { unit, inputLabel: all[0].inputLabel, rows,
    note: "So sánh chỉ có ý nghĩa khi cùng micro, input, gain, tín hiệu phát, vị trí, hiệu chuẩn và điều kiện phòng; số liệu không tự chứng minh nguyên nhân thay đổi." };
}

export type AxialMode = {
  axis: "length" | "width" | "height";
  order: number;
  frequencyHz: number;
  classification: "theoretical-estimate";
};

/** Calculates ideal rectangular-room axial modes; output is theory, not measured room response. */
export function estimateAxialRoomModes(
  room: { lengthM: number; widthM: number; heightM: number },
  speedOfSoundMps = 343,
  maximumOrder = 4,
): AxialMode[] {
  if (![room.lengthM, room.widthM, room.heightM, speedOfSoundMps].every(Number.isFinite) ||
    room.lengthM <= 0 || room.widthM <= 0 || room.heightM <= 0 ||
    speedOfSoundMps < 300 || speedOfSoundMps > 360 ||
    !Number.isInteger(maximumOrder) || maximumOrder < 1 || maximumOrder > 12) return [];
  const dimensions = [["length", room.lengthM], ["width", room.widthM], ["height", room.heightM]] as const;
  return dimensions.flatMap(([axis, size]) =>
    Array.from({ length: maximumOrder }, (_, index) => ({
      axis, order: index + 1,
      frequencyHz: (index + 1) * speedOfSoundMps / (2 * size),
      classification: "theoretical-estimate" as const,
    }))
  ).sort((a, b) => a.frequencyHz - b.frequencyHz);
}

export type DspParameterProposal = {
  parameter: "gain" | "delay" | "eq" | "mute" | "polarity" | "routing";
  target: string;
  proposedValue: string | number;
  basisMeasurementIds: number[];
  execution: "advisory-only";
  writeEnabled: false;
  requiredHumanChecks: string[];
};

/** Packages an auditable proposal while permanently keeping this workflow read-only. */
export function createDspAdvisoryProposal(input: {
  parameter: DspParameterProposal["parameter"];
  target: string;
  proposedValue: string | number;
  basisMeasurementIds: number[];
}): DspParameterProposal | null {
  if (!input.target.trim() || !input.basisMeasurementIds.length ||
    input.basisMeasurementIds.some((id) => !Number.isInteger(id) || id <= 0) ||
    (typeof input.proposedValue === "number" && !Number.isFinite(input.proposedValue)) ||
    (typeof input.proposedValue === "string" && !input.proposedValue.trim())) return null;
  return {
    ...input, execution: "advisory-only", writeEnabled: false,
    requiredHumanChecks: [
      "Xác minh chính xác hãng, model và firmware của DSP/mixer.",
      "Xác minh giao thức/API chính thức và quyền truy cập chỉ đọc/read-back.",
      "Lưu snapshot cấu hình hiện tại và phương án rollback.",
      "Đối chiếu kết quả đo bằng thiết bị tham chiếu và kỹ thuật viên phụ trách.",
      "Áp dụng thủ công trên thiết bị; mô-đun này không gửi lệnh điều khiển.",
    ],
  };
}
