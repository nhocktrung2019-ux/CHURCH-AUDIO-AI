export type SPLWeighting = "A" | "C" | "Z";
export type SPLTimeWeighting = "Fast" | "Slow" | "Leq";

export type ZoneSPLReading = {
  id: string;
  zoneId: string;
  pointId: string;
  sessionId: string;
  value: number;
  unit: "dB_SPL" | "dBFS";
  evidence: "measured" | "manual" | "simulated" | "interpolated";
  calibrationStatus: "valid" | "missing" | "expired";
  calibrationId: string | null;
  weighting: SPLWeighting;
  timeWeighting: SPLTimeWeighting;
};

export type ZoneUniformitySummary = {
  status: "ready" | "insufficient-data" | "incompatible-measurements";
  sessionId: string | null;
  weighting: SPLWeighting | null;
  timeWeighting: SPLTimeWeighting | null;
  calibrationId: string | null;
  acceptedReadingCount: number;
  rejectedReadingCount: number;
  zoneCount: number;
  zones: Array<{
    zoneId: string;
    pointCount: number;
    repeatCount: number;
    energyAverageDbSpl: number;
  }>;
  minDbSpl: number | null;
  maxDbSpl: number | null;
  spreadDb: number | null;
  energyAverageDbSpl: number | null;
  reason: string | null;
};

const energyAverage = (values: number[]): number =>
  10 * Math.log10(values.reduce((sum, value) => sum + 10 ** (value / 10), 0) / values.length);

const isEligible = (reading: ZoneSPLReading): boolean =>
  reading.unit === "dB_SPL" &&
  reading.evidence === "measured" &&
  reading.calibrationStatus === "valid" &&
  Boolean(reading.calibrationId) &&
  Number.isFinite(reading.value) &&
  reading.value >= 20 &&
  reading.value <= 140 &&
  Boolean(reading.id && reading.zoneId && reading.pointId && reading.sessionId);

export function analyzeZoneUniformity(readings: ZoneSPLReading[]): ZoneUniformitySummary {
  const empty = {
    status: "insufficient-data" as const,
    sessionId: null,
    weighting: null,
    timeWeighting: null,
    calibrationId: null,
    acceptedReadingCount: 0,
    rejectedReadingCount: readings.length,
    zoneCount: 0,
    zones: [],
    minDbSpl: null,
    maxDbSpl: null,
    spreadDb: null,
    energyAverageDbSpl: null,
    reason: "Cần ít nhất hai điểm đo hợp lệ, đã hiệu chuẩn.",
  };
  if (!Array.isArray(readings) || readings.length < 2) return empty;

  const eligible = readings.filter(isEligible);
  if (eligible.length < 2) {
    return { ...empty, rejectedReadingCount: readings.length - eligible.length,
      reason: "Không đủ dữ liệu đo dB SPL hợp lệ; dBFS, số liệu nhập tay, mô phỏng hoặc chưa hiệu chuẩn bị loại." };
  }

  const first = eligible[0];
  const compatible = eligible.filter((reading) =>
    reading.sessionId === first.sessionId &&
    reading.weighting === first.weighting &&
    reading.timeWeighting === first.timeWeighting &&
    reading.calibrationId === first.calibrationId
  );
  if (compatible.length !== eligible.length) {
    return {
      ...empty,
      status: "incompatible-measurements",
      acceptedReadingCount: 0,
      rejectedReadingCount: readings.length,
      reason: "Không trộn phiên đo, weighting, time weighting hoặc chuỗi hiệu chuẩn khác nhau.",
    };
  }

  const points = new Map<string, number[]>();
  for (const reading of compatible) {
    const key = `${reading.zoneId}\u0000${reading.pointId}`;
    const values = points.get(key) ?? [];
    values.push(reading.value);
    points.set(key, values);
  }

  const zonePoints = new Map<string, number[]>();
  for (const [key, repeats] of points) {
    const zoneId = key.split("\u0000")[0];
    const values = zonePoints.get(zoneId) ?? [];
    values.push(energyAverage(repeats));
    zonePoints.set(zoneId, values);
  }

  const zones = [...zonePoints.entries()]
    .map(([zoneId, pointValues]) => ({
      zoneId,
      pointCount: pointValues.length,
      repeatCount: compatible.filter((reading) => reading.zoneId === zoneId).length,
      energyAverageDbSpl: energyAverage(pointValues),
    }))
    .sort((a, b) => a.zoneId.localeCompare(b.zoneId));

  if (zones.length < 2) {
    return {
      ...empty,
      sessionId: first.sessionId,
      weighting: first.weighting,
      timeWeighting: first.timeWeighting,
      calibrationId: first.calibrationId,
      acceptedReadingCount: compatible.length,
      rejectedReadingCount: readings.length - compatible.length,
      reason: "Cần ít nhất hai vùng có số đo hợp lệ để đánh giá độ đồng đều.",
    };
  }

  const values = zones.map((zone) => zone.energyAverageDbSpl);
  const minDbSpl = Math.min(...values);
  const maxDbSpl = Math.max(...values);
  return {
    status: "ready",
    sessionId: first.sessionId,
    weighting: first.weighting,
    timeWeighting: first.timeWeighting,
    calibrationId: first.calibrationId,
    acceptedReadingCount: compatible.length,
    rejectedReadingCount: readings.length - compatible.length,
    zoneCount: zones.length,
    zones,
    minDbSpl,
    maxDbSpl,
    spreadDb: maxDbSpl - minDbSpl,
    energyAverageDbSpl: energyAverage(values),
    reason: null,
  };
}
