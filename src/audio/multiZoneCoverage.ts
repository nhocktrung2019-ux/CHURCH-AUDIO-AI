import type { ZoneSplRecord } from "./zoneSplUniformity.ts";

export type MultiZonePoint = {
  position: string; xM: number | null; yM: number | null;
  levels: Record<string, number>; deltas: Record<string, number | null>;
};
export type MultiZoneCoverage = {
  status: "ready" | "blocked" | "insufficient";
  inputLabel: string; zones: string[]; points: MultiZonePoint[];
  summaries: Array<{ zone: string; measuredPoints: number; totalPositions: number; coveragePercent: number; meanDb: number | null; minDb: number | null; maxDb: number | null; spreadDb: number | null }>;
  commonPositionCount: number; unionPositionCount: number; overlapPercent: number;
  referenceZone: string; reason: string;
};
const finite = (n: number) => Number.isFinite(n);
const keyOf = (s: string) => s.trim().toLocaleLowerCase("vi");
const energyMean = (captures: ZoneSplRecord[]) => {
  const duration = captures.reduce((sum, r) => sum + r.durationSeconds, 0);
  const energy = captures.reduce((sum, r) => sum + 10 ** (r.levelDb / 10) * r.durationSeconds, 0);
  return duration > 0 && energy > 0 && finite(energy) ? 10 * Math.log10(energy / duration) : null;
};

/** Multi-zone SPL analysis: measured dB SPL only, one input and calibration offset. No interpolation. */
export function analyzeMultiZoneCoverage(records: ZoneSplRecord[], referenceZone?: string): MultiZoneCoverage {
  const empty = (status: MultiZoneCoverage["status"], reason: string): MultiZoneCoverage => ({
    status, inputLabel: "", zones: [], points: [], summaries: [], commonPositionCount: 0,
    unionPositionCount: 0, overlapPercent: 0, referenceZone: "", reason,
  });
  const calibrated = records.filter(r => r.unit === "dB SPL");
  if (!calibrated.length) return empty("insufficient", "Chưa có bản ghi dB SPL đã hiệu chuẩn.");
  if (calibrated.some(r => !r.zone.trim() || !r.position.trim() || !r.inputLabel.trim() ||
    !finite(r.levelDb) || r.levelDb <= -99 || r.levelDb > 200 ||
    !finite(r.durationSeconds) || r.durationSeconds <= 0 ||
    !finite(r.timestamp) || !finite(r.calibrationOffsetDb as number))) {
    return empty("blocked", "Dữ liệu dB SPL thiếu thông tin hoặc có giá trị không hợp lệ.");
  }
  const inputs = new Set(calibrated.map(r => r.inputLabel.trim()));
  const offsets = calibrated.map(r => r.calibrationOffsetDb as number);
  if (inputs.size !== 1 || Math.max(...offsets) - Math.min(...offsets) > 0.01)
    return empty("blocked", "Không thể trộn nhiều đầu vào hoặc offset hiệu chuẩn khác nhau.");
  const zones = [...new Set(calibrated.map(r => r.zone.trim()))].sort((a,b)=>a.localeCompare(b,"vi"));
  if (zones.length < 2) return empty("insufficient", "Cần ít nhất hai vùng loa có dữ liệu đo.");
  const byZone = new Map<string, Map<string, ZoneSplRecord[]>>();
  for (const zone of zones) byZone.set(zone, new Map());
  for (const r of calibrated) {
    const positions = byZone.get(r.zone.trim())!;
    const key = keyOf(r.position);
    positions.set(key, [...(positions.get(key) ?? []), r]);
  }
  const allKeys = [...new Set([...byZone.values()].flatMap(m => [...m.keys()]))].sort();
  const commonKeys = allKeys.filter(key => zones.every(zone => byZone.get(zone)!.has(key)));
  const unionPositionCount = allKeys.length;
  const overlapPercent = unionPositionCount ? commonKeys.length / unionPositionCount * 100 : 0;
  const reference = zones.includes(referenceZone ?? "") ? referenceZone! : zones[0];
  const refMap = byZone.get(reference)!;
  const points: MultiZonePoint[] = allKeys.map(key => {
    const levels: Record<string, number> = {};
    const deltas: Record<string, number | null> = {};
    let xM: number | null = null, yM: number | null = null;
    for (const zone of zones) {
      const captures = byZone.get(zone)!.get(key);
      if (!captures) { deltas[zone] = null; continue; }
      const level = energyMean(captures);
      if (level === null) { deltas[zone] = null; continue; }
      levels[zone] = level;
      const xs = captures.map(r=>r.xM), ys = captures.map(r=>r.yM);
      if (xs.every((value): value is number => typeof value === "number" && finite(value)) && ys.every((value): value is number => typeof value === "number" && finite(value))) { xM = xs.reduce((a,b)=>a+b,0)/xs.length; yM = ys.reduce((a,b)=>a+b,0)/ys.length; }
      const refCaptures = refMap.get(key);
      const refLevel = refCaptures ? energyMean(refCaptures) : null;
      deltas[zone] = refLevel === null ? null : level - refLevel;
    }
    const label = [...byZone.values()].flatMap(m=>m.get(key) ?? [])[0]?.position.trim() ?? key;
    return { position: label, xM, yM, levels, deltas };
  });
  const summaries = zones.map(zone => {
    const values = [...byZone.get(zone)!.values()].map(energyMean).filter((v):v is number=>v!==null);
    const meanDb = values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
    const minDb = values.length ? Math.min(...values) : null;
    const maxDb = values.length ? Math.max(...values) : null;
    return { zone, measuredPoints: values.length, totalPositions: unionPositionCount,
      coveragePercent: unionPositionCount ? values.length / unionPositionCount * 100 : 0,
      meanDb, minDb, maxDb, spreadDb: minDb === null || maxDb === null ? null : maxDb-minDb };
  });
  return { status: commonKeys.length >= 2 ? "ready" : "insufficient", inputLabel: [...inputs][0],
    zones, points, summaries, commonPositionCount: commonKeys.length, unionPositionCount,
    overlapPercent, referenceZone: reference,
    reason: commonKeys.length >= 2 ? "So sánh tại nhãn vị trí chung; xác minh các nhãn tương ứng cùng tọa độ nghe." : "Cần ít nhất hai vị trí được đo ở tất cả các vùng để so sánh đáng tin cậy." };
}
