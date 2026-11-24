export type SpectrumEvidence = "measured" | "manual" | "simulated";
export type SpectrumBin = {
  frequencyHz: number;
  levelDb: number;
  evidence: SpectrumEvidence;
};
export type Rt60OctaveBand = {
  centerHz: number;
  rt20Seconds: number | null;
  rt30Seconds: number | null;
  rt60Seconds: number | null;
  fitR2: number | null;
};
export type TransferDiagnosticPoint = {
  frequencyHz: number;
  coherence: number;
  magnitudeDb: number;
};
export type AcousticSnapshot = {
  spectrum: SpectrumBin[];
  rt60Bands?: Rt60OctaveBand[];
  transferPoints?: TransferDiagnosticPoint[];
  capture?: {
    sampleRate: number;
    rmsDbfs: number;
    peakDbfs: number;
    clippedSamplePercent: number;
    invalidSamplePercent: number;
    calibratedSpl: boolean;
    calibrationId?: string | null;
  };
};
export type DiagnosticSeverity = "info" | "warning" | "critical";
export type AcousticFinding = {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  detail: string;
  action: string;
};
export type SpectrumBandSummary = {
  name: string;
  lowHz: number;
  highHz: number;
  binCount: number;
  energyAverageDb: number | null;
};
export type AcousticDiagnosticReport = {
  status: "ready" | "limited" | "insufficient-data";
  measuredBinCount: number;
  excludedBinCount: number;
  spectrumBands: SpectrumBandSummary[];
  spectralSpreadDb: number | null;
  rt60: {
    validBandCount: number;
    medianSeconds: number | null;
    minimumSeconds: number | null;
    maximumSeconds: number | null;
    spreadSeconds: number | null;
  };
  transfer: {
    validPointCount: number;
    averageCoherence: number | null;
    reliableBandPercent: number | null;
  };
  splStatus: "calibrated" | "uncalibrated" | "unavailable";
  findings: AcousticFinding[];
};

const BAND_DEFINITIONS = [
  { name: "Sub / Bass", lowHz: 20, highHz: 125 },
  { name: "Bass / Low-mid", lowHz: 125, highHz: 500 },
  { name: "Mid", lowHz: 500, highHz: 2000 },
  { name: "Presence", lowHz: 2000, highHz: 6000 },
  { name: "High", lowHz: 6000, highHz: 20000 },
] as const;

function energyAverageDb(values: number[]): number | null {
  if (!values.length) return null;
  const power = values.reduce((sum, value) => sum + 10 ** (value / 10), 0) / values.length;
  return Number.isFinite(power) && power > 0 ? 10 * Math.log10(power) : null;
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const a = sorted[middle];
  const b = sorted[middle - 1];
  return a === undefined ? null : sorted.length % 2 ? a : b === undefined ? a : (a + b) / 2;
}
function finding(code: string, severity: DiagnosticSeverity, title: string, detail: string, action: string): AcousticFinding {
  return { code, severity, title, detail, action };
}
function validRt60Band(band: Rt60OctaveBand): boolean {
  return Number.isFinite(band.centerHz) && band.centerHz > 0
    && Number.isFinite(band.rt60Seconds) && (band.rt60Seconds as number) >= 0.1
    && (band.rt60Seconds as number) <= 10
    && Number.isFinite(band.fitR2) && (band.fitR2 as number) >= 0.75;
}

export function analyzeAcousticSnapshot(snapshot: AcousticSnapshot): AcousticDiagnosticReport {
  const spectrum = Array.isArray(snapshot.spectrum) ? snapshot.spectrum : [];
  const measured = spectrum.filter((bin) =>
    bin.evidence === "measured" &&
    Number.isFinite(bin.frequencyHz) && bin.frequencyHz >= 20 && bin.frequencyHz <= 20000 &&
    Number.isFinite(bin.levelDb) && bin.levelDb >= -120 && bin.levelDb <= 24
  );
  const excludedBinCount = spectrum.length - measured.length;
  const spectrumBands: SpectrumBandSummary[] = BAND_DEFINITIONS.map((band) => {
    const values = measured.filter((bin) => bin.frequencyHz >= band.lowHz && bin.frequencyHz < band.highHz).map((bin) => bin.levelDb);
    return { ...band, binCount: values.length, energyAverageDb: energyAverageDb(values) };
  });
  const populated = spectrumBands.filter((band) => band.binCount >= 3 && band.energyAverageDb !== null);
  const populatedLevels = populated.map((band) => band.energyAverageDb as number);
  const spectralSpreadDb = populatedLevels.length >= 2 ? Math.max(...populatedLevels) - Math.min(...populatedLevels) : null;

  const validRt60 = (snapshot.rt60Bands ?? []).filter(validRt60Band);
  const rtValues = validRt60.map((band) => band.rt60Seconds as number);
  const rtMedian = median(rtValues);
  const rtMin = rtValues.length ? Math.min(...rtValues) : null;
  const rtMax = rtValues.length ? Math.max(...rtValues) : null;

  const transfer = (snapshot.transferPoints ?? []).filter((point) =>
    Number.isFinite(point.frequencyHz) && point.frequencyHz >= 20 && point.frequencyHz <= 20000 &&
    Number.isFinite(point.coherence) && point.coherence >= 0 && point.coherence <= 1 &&
    Number.isFinite(point.magnitudeDb)
  );
  const averageCoherence = transfer.length
    ? transfer.reduce((sum, point) => sum + point.coherence, 0) / transfer.length
    : null;
  const reliableBandPercent = transfer.length
    ? 100 * transfer.filter((point) => point.coherence >= 0.8).length / transfer.length
    : null;

  const findings: AcousticFinding[] = [];
  if (measured.length < 15) {
    findings.push(finding("spectrum-insufficient", "warning", "Thiếu dữ liệu phổ đo",
      "Cần thêm các bin RTA hợp lệ trong dải 20 Hz–20 kHz; số liệu nhập tay và mô phỏng không được dùng trong phân tích này.",
      "Giữ nguyên vị trí micro, gain và cấu hình; thu lại phổ ổn định trong môi trường phù hợp."));
  }
  if (excludedBinCount > 0) {
    findings.push(finding("spectrum-excluded", "info", "Đã loại dữ liệu không phải phép đo hợp lệ",
      `${excludedBinCount} bin bị loại do nguồn dữ liệu không phải measured hoặc giá trị/tần số không hợp lệ.`,
      "Kiểm tra nguồn dữ liệu trước khi xuất báo cáo."));
  }
  const low = spectrumBands[0]?.energyAverageDb;
  const lowMid = spectrumBands[1]?.energyAverageDb;
  const mid = spectrumBands[2]?.energyAverageDb;
  const presence = spectrumBands[3]?.energyAverageDb;
  const high = spectrumBands[4]?.energyAverageDb;
  const referenceUpper = [mid, presence].filter((value): value is number => value !== null && value !== undefined);
  if (referenceUpper.length && low !== null && low !== undefined && lowMid !== null && lowMid !== undefined) {
    const upperReference = median(referenceUpper);
    const lowAverage = energyAverageDb([low, lowMid]);
    if (upperReference !== null && lowAverage !== null && lowAverage - upperReference >= 6) {
      findings.push(finding("low-frequency-build-up", "warning", "Năng lượng dải trầm cao hơn dải trung",
        `Mức năng lượng tổng hợp 20–500 Hz cao hơn vùng trung tham chiếu khoảng ${(lowAverage - upperReference).toFixed(1)} dB. Đây là dấu hiệu cần kiểm tra, không phải kết luận nguyên nhân.`,
        "Kiểm tra vị trí loa/micro, cộng hưởng phòng, crossover và đáp tuyến loa trước khi cân EQ."));
    }
  }
  if (high !== null && high !== undefined && mid !== null && mid !== undefined && mid - high >= 8) {
    findings.push(finding("high-frequency-rolloff", "info", "Dải cao thấp hơn dải trung",
      `Dải 6–20 kHz thấp hơn dải 500 Hz–2 kHz khoảng ${(mid - high).toFixed(1)} dB.`,
      "Kiểm tra hướng loa, vật cản, khoảng cách, đáp tuyến micro và file correction trước khi thay đổi EQ."));
  }
  if (spectralSpreadDb !== null && spectralSpreadDb >= 10) {
    findings.push(finding("spectral-imbalance", "warning", "Phổ tần có chênh lệch rộng",
      `Chênh lệch giữa các dải tổng hợp đạt ${spectralSpreadDb.toFixed(1)} dB.`,
      "Đo lặp tại nhiều vị trí và kiểm tra coherence/đáp tuyến trước khi áp dụng EQ."));
  }

  if (!validRt60.length) {
    findings.push(finding("rt60-unavailable", "warning", "Chưa có RT60 đủ điều kiện",
      "Không có octave band nào đạt ngưỡng fit tối thiểu và thời gian suy giảm hợp lệ.",
      "Tăng SNR, giảm tiếng ồn nền, kiểm tra sweep/loa/micro và đo lặp."));
  } else if (validRt60.length < 4) {
    findings.push(finding("rt60-limited-bands", "info", "RT60 chỉ có một phần dải tần",
      `Hiện có ${validRt60.length} octave band đạt điều kiện; không nên suy rộng sang toàn dải.`,
      "Cải thiện dynamic range và đo lại các dải còn thiếu."));
  }
  if (validRt60.length >= 2 && rtMin !== null && rtMax !== null && rtMax - rtMin >= 0.5) {
    findings.push(finding("rt60-frequency-variation", "warning", "RT60 thay đổi theo tần số",
      `Chênh lệch RT60 giữa các octave band hợp lệ là ${(rtMax - rtMin).toFixed(2)} giây.`,
      "Xem biểu đồ từng octave band; kiểm tra hấp thụ trầm, vật liệu và vị trí đo. Không dùng một giá trị trung bình để che mất khác biệt."));
  }
  if (transfer.length && averageCoherence !== null && averageCoherence < 0.8) {
    findings.push(finding("transfer-low-coherence", "warning", "Coherence thấp",
      `Coherence trung bình là ${averageCoherence.toFixed(2)}; transfer/phase và gợi ý EQ có thể không đáng tin.`,
      "Kiểm tra tỷ lệ tín hiệu/nhiễu, đồng bộ clock, loopback, clipping và tiếng ồn nền."));
  }
  if (snapshot.capture) {
    const capture = snapshot.capture;
    const invalid = !Number.isFinite(capture.sampleRate) || capture.sampleRate < 8000 || capture.sampleRate > 192000
      || !Number.isFinite(capture.rmsDbfs) || capture.rmsDbfs < -90 || capture.rmsDbfs > 0
      || !Number.isFinite(capture.peakDbfs) || capture.peakDbfs > 0
      || !Number.isFinite(capture.clippedSamplePercent) || capture.clippedSamplePercent > 0.1
      || !Number.isFinite(capture.invalidSamplePercent) || capture.invalidSamplePercent > 0.01;
    if (invalid) {
      findings.push(finding("capture-quality-fail", "critical", "Chất lượng bản ghi không đạt",
        "Sample rate, RMS/peak, clipping hoặc mẫu PCM không hợp lệ vượt ngưỡng kiểm soát.",
        "Không dùng bản ghi này để kết luận âm học hoặc tạo khuyến nghị Auto EQ; sửa gain/thiết bị và thu lại."));
    }
  }
  const splStatus = snapshot.capture?.calibratedSpl && Boolean(snapshot.capture.calibrationId) ? "calibrated" : snapshot.capture ? "uncalibrated" : "unavailable";
  if (splStatus !== "calibrated") {
    findings.push(finding("spl-not-calibrated", "info", "Không xác nhận mức dB SPL tuyệt đối",
      "Phân tích phổ có thể mô tả hình dạng tương đối, nhưng không được hiển thị như mức dB SPL đã hiệu chuẩn.",
      "Dùng acoustic calibrator và lưu hồ sơ hiệu chuẩn riêng cho đúng microphone/input chain."));
  }
  const critical = findings.some((item) => item.severity === "critical");
  const hasUsefulData = measured.length >= 15 || validRt60.length > 0 || transfer.length > 0;
  const status = !hasUsefulData ? "insufficient-data" : critical || excludedBinCount > spectrum.length * 0.5 ? "limited" : "ready";

  return {
    status,
    measuredBinCount: measured.length,
    excludedBinCount,
    spectrumBands,
    spectralSpreadDb,
    rt60: {
      validBandCount: validRt60.length,
      medianSeconds: rtMedian,
      minimumSeconds: rtMin,
      maximumSeconds: rtMax,
      spreadSeconds: rtMin === null || rtMax === null ? null : rtMax - rtMin,
    },
    transfer: { validPointCount: transfer.length, averageCoherence, reliableBandPercent },
    splStatus,
    findings,
  };
}
