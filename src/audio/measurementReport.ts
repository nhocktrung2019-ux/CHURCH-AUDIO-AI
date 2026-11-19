export type ReportZoneEntry = {
  id: string;
  name: string;
  splDb: number | null;
  note: string;
  status: "manual-unverified";
};
export type ReportRt60Record = {
  capturedAt: string;
  zone: string;
  position: string;
  inputSelection: string;
  sweepDurationSeconds: number;
  tailSeconds: number;
  sampleRate: number;
  quality: "good" | "limited" | "invalid";
  peakToNoiseDb: number;
  recommendedRt60: number | null;
  bands: Array<{
    centerHz: number;
    rt20Seconds: number | null;
    rt30Seconds: number | null;
    rt60Seconds: number | null;
    fitR2: number | null;
    fitRangeDb: number;
  }>;
  microphoneCorrectionApplied: false;
  operatorNotes: string;
};
export type MeasurementReport = {
  format: "CHURCH_AUDIO_MEASUREMENT_REPORT";
  schemaVersion: "1.0.0";
  generatedAt: string;
  application: { name: "CHURCH AUDIO AI"; version: string };
  project: { name: string; site: string; operator: string; notes: string };
  integrity: {
    measuredSPLZoneEntries: number;
    unverifiedManualSPLZoneEntries: number;
    rt60Records: number;
    transferResponseRecords: number;
    dBfsConvertedToSpl: false;
    simulatedDataIncludedAsMeasured: false;
  };
  calibration: {
    onePointOffsetDb: number | null;
    microphoneCorrectionProfileName: string | null;
    microphoneCorrectionPointCount: number;
    note: string;
  };
  room: { lengthM: number | null; widthM: number | null; heightM: number | null };
  zoneEntries: ReportZoneEntry[];
  rt60: ReportRt60Record | null;
  transferResponse: {
    status: "relative-response-not-absolute-spl";
    sampleRate: number | null;
    pointCount: number;
    captureMetadata: unknown;
    points: Array<{ frequencyHz: number; magnitudeDb: number; phaseDeg: number; coherence: number }>;
  } | null;
  limitations: string[];
};

type Input = {
  generatedAt?: string;
  appVersion: string;
  project: { name: string; site: string; operator: string; notes: string };
  zoneStorage: unknown;
  rt60Storage: unknown;
  transferStorage: unknown;
  offsetStorage: unknown;
  micCalibrationStorage: unknown;
  roomStorage: { length: unknown; width: unknown; height: unknown };
};

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function text(value: unknown, fallback = ""): string { return typeof value === "string" ? value.slice(0, 2000) : fallback; }
function dimension(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 && n <= 500 ? n : null;
}
export function buildMeasurementReport(input: Input): MeasurementReport {
  const zonesRaw = parseJson(input.zoneStorage);
  const zoneEntries: ReportZoneEntry[] = Array.isArray(zonesRaw) ? zonesRaw.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const zone = item as Record<string, unknown>;
    const splDb = zone.splDb === null || zone.splDb === undefined || zone.splDb === "" ? null : Number(zone.splDb);
    if (splDb !== null && (!Number.isFinite(splDb) || splDb < 0 || splDb > 200)) return [];
    return [{
      id: text(zone.id, String(index + 1)),
      name: text(zone.name, "Zone " + (index + 1)),
      splDb,
      note: text(zone.note),
      status: "manual-unverified" as const,
    }];
  }) : [];

  const rtRaw = parseJson(input.rt60Storage);
  let rt60: ReportRt60Record | null = null;
  if (rtRaw && typeof rtRaw === "object") {
    const raw = rtRaw as Record<string, unknown>;
    const result = raw.result && typeof raw.result === "object" ? raw.result as Record<string, unknown> : null;
    if (result && finite(result.sampleRate) && Array.isArray(result.bands)) {
      const bands = result.bands.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const band = item as Record<string, unknown>;
        if (!finite(band.centerHz)) return [];
        const nullable = (v: unknown) => v === null || v === undefined ? null : finite(v) ? v : null;
        return [{
          centerHz: band.centerHz,
          rt20Seconds: nullable(band.rt20Seconds),
          rt30Seconds: nullable(band.rt30Seconds),
          rt60Seconds: nullable(band.rt60Seconds),
          fitR2: nullable(band.fitR2),
          fitRangeDb: finite(band.fitRangeDb) ? band.fitRangeDb : 0,
        }];
      });
      const quality = result.quality === "good" || result.quality === "limited" || result.quality === "invalid" ? result.quality : "invalid";
      rt60 = {
        capturedAt: text(raw.capturedAt),
        zone: text(raw.zone, "Not specified"),
        position: text(raw.position, "Not specified"),
        inputSelection: text(raw.inputSelection, "Not recorded"),
        sweepDurationSeconds: finite(raw.sweepDurationSeconds) ? raw.sweepDurationSeconds : 0,
        tailSeconds: finite(raw.tailSeconds) ? raw.tailSeconds : 0,
        sampleRate: result.sampleRate,
        quality,
        peakToNoiseDb: finite(result.peakToNoiseDb) ? result.peakToNoiseDb : 0,
        recommendedRt60: result.recommendedRt60 === null || result.recommendedRt60 === undefined ? null : finite(result.recommendedRt60) ? result.recommendedRt60 : null,
        bands,
        microphoneCorrectionApplied: false,
        operatorNotes: text(raw.operatorNotes),
      };
    }
  }

  const transferRaw = parseJson(input.transferStorage);
  let transferResponse: MeasurementReport["transferResponse"] = null;
  if (transferRaw && typeof transferRaw === "object") {
    const raw = transferRaw as Record<string, unknown>;
    if (Array.isArray(raw.points)) {
      const points = raw.points.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const p = item as Record<string, unknown>;
        return finite(p.frequencyHz) && finite(p.magnitudeDb) && finite(p.phaseDeg) && finite(p.coherence)
          ? [{ frequencyHz: p.frequencyHz, magnitudeDb: p.magnitudeDb, phaseDeg: p.phaseDeg, coherence: p.coherence }]
          : [];
      });
      if (points.length) transferResponse = {
        status: "relative-response-not-absolute-spl",
        sampleRate: finite(raw.sampleRate) ? raw.sampleRate : null,
        pointCount: points.length,
        captureMetadata: raw.captureMetadata ?? null,
        points,
      };
    }
  }

  const offset = parseJson(input.offsetStorage);
  const offsetNumber = typeof offset === "number" ? offset : typeof offset === "string" && offset.trim() ? Number(offset) : NaN;
  const mic = parseJson(input.micCalibrationStorage);
  const micRecord = mic && typeof mic === "object" ? mic as Record<string, unknown> : {};
  const micPoints = Array.isArray(micRecord.points) ? micRecord.points.length : 0;

  return {
    format: "CHURCH_AUDIO_MEASUREMENT_REPORT",
    schemaVersion: "1.0.0",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    application: { name: "CHURCH AUDIO AI", version: input.appVersion },
    project: {
      name: text(input.project.name, "Church acoustic survey"),
      site: text(input.project.site),
      operator: text(input.project.operator),
      notes: text(input.project.notes),
    },
    integrity: {
      measuredSPLZoneEntries: 0,
      unverifiedManualSPLZoneEntries: zoneEntries.filter(z => z.splDb !== null).length,
      rt60Records: rt60 ? 1 : 0,
      transferResponseRecords: transferResponse ? 1 : 0,
      dBfsConvertedToSpl: false,
      simulatedDataIncludedAsMeasured: false,
    },
    calibration: {
      onePointOffsetDb: Number.isFinite(offsetNumber) ? offsetNumber : null,
      microphoneCorrectionProfileName: text(micRecord.name) || null,
      microphoneCorrectionPointCount: micPoints,
      note: "Offset/profile are recorded as project context only. Manual SPL zone entries have no per-record calibration provenance. The current RT60 sweep workflow does not apply the microphone correction curve.",
    },
    room: {
      lengthM: dimension(input.roomStorage.length),
      widthM: dimension(input.roomStorage.width),
      heightM: dimension(input.roomStorage.height),
    },
    zoneEntries,
    rt60,
    transferResponse,
    limitations: [
      "Manually entered SPL zone values are unverified and are excluded from calibrated SPL summaries.",
      "No dBFS value is converted to dB SPL by this report.",
      "RT60 values are in-situ estimates; inspect fit quality, noise and field conditions. Microphone correction is not applied by the current RT60 sweep workflow.",
      "Transfer response is relative-response data, not absolute SPL.",
      "Simulated and theoretical room/speaker values are not represented as measured results.",
      "This report is advisory and is not an IEC 61672 or ISO 3382 compliance certificate.",
    ],
  };
}

export function measurementReportCsv(report: MeasurementReport): string {
  const quote = (value: unknown) => {
    const raw = value === null || value === undefined ? "" : String(value);
    return '"' + raw.replace(/"/g, '""') + '"';
  };
  const rows: unknown[][] = [
    ["record_type","record_id","name_or_metric","frequency_hz","value","unit","status","notes"],
    ["project","",report.project.name,"","","","metadata",report.project.site],
    ["integrity","","unverified_manual_spl_count","",report.integrity.unverifiedManualSPLZoneEntries,"count","unverified","Not included in calibrated SPL summary"],
    ["calibration","","one_point_offset","",report.calibration.onePointOffsetDb,"dB","context-only",report.calibration.note],
    ...report.zoneEntries.map(z=>["zone",z.id,z.name,"",z.splDb,"dB SPL entered","manual-unverified",z.note]),
    ...(report.rt60?.bands.map(b=>["rt60-band","", "RT60",b.centerHz,b.rt60Seconds,"s",report.rt60?.quality??"unknown","RT20="+b.rt20Seconds+"; RT30="+b.rt30Seconds+"; fitR2="+b.fitR2])??[]),
    ...(report.transferResponse?.points.map(p=>["transfer-bin","","relative magnitude",p.frequencyHz,p.magnitudeDb,"dB relative","measured-response","phase="+p.phaseDeg+" deg; coherence="+p.coherence])??[]),
  ];
  return "\uFEFF" + rows.map(row=>row.map(quote).join(",")).join("\r\n");
}
