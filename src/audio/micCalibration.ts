export type MicCalibrationPoint = { frequencyHz: number; correctionDb: number };
export type MicCalibrationFile = { name: string; points: MicCalibrationPoint[] };

export function parseMicCalibration(text: string, name: string): MicCalibrationFile {
  const points: MicCalibrationPoint[] = [];
  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//") || line.startsWith(";")) continue;
    const cells = line.split(/[;,\t\s]+/).map(cell => cell.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    const numeric = cells.map(cell => Number(cell)).filter(Number.isFinite);
    if (numeric.length < 2) continue;
    const [frequencyHz, correctionDb] = numeric;
    if (frequencyHz >= 10 && frequencyHz <= 40000 && correctionDb >= -30 && correctionDb <= 30) {
      points.push({ frequencyHz, correctionDb });
    }
  }
  points.sort((a,b)=>a.frequencyHz-b.frequencyHz);
  const unique: MicCalibrationPoint[] = [];
  for (const point of points) {
    if (unique.length && unique[unique.length-1].frequencyHz === point.frequencyHz) unique[unique.length-1] = point;
    else unique.push(point);
  }
  if (unique.length < 3) throw new Error("File hiệu chuẩn cần tối thiểu 3 cặp số: tần số (Hz), correction (dB).");
  if (unique[unique.length-1].frequencyHz / unique[0].frequencyHz < 5) throw new Error("Dải tần trong file quá hẹp. Hãy dùng file correction có nhiều điểm và dải rộng.");
  return { name, points: unique };
}

/** Interpolate microphone correction logarithmically by frequency. */
export function micCorrectionAt(points: MicCalibrationPoint[], frequencyHz: number): number {
  if (!points.length || !Number.isFinite(frequencyHz) || frequencyHz <= 0) return 0;
  if (frequencyHz <= points[0].frequencyHz) return points[0].correctionDb;
  const last = points[points.length-1];
  if (frequencyHz >= last.frequencyHz) return last.correctionDb;
  let low = 0, high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle].frequencyHz <= frequencyHz) low = middle;
    else high = middle;
  }
  const a = points[low], b = points[high];
  const position = Math.log(frequencyHz / a.frequencyHz) / Math.log(b.frequencyHz / a.frequencyHz);
  return a.correctionDb + (b.correctionDb - a.correctionDb) * position;
}

export function applyMicCorrectionToLogSpectrum(
  spectrum: number[],
  points: MicCalibrationPoint[],
  minHz = 20,
  maxHz = 20000,
): number[] {
  if (!points.length || spectrum.length === 0) return spectrum;
  const ratio = maxHz / minHz;
  return spectrum.map((value,index)=>{
    const centerHz = minHz * Math.pow(ratio,(index + .5) / spectrum.length);
    return Math.max(-120, Math.min(24, value + micCorrectionAt(points,centerHz)));
  });
}
