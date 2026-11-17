export type PolarPlane = "H" | "V";

export type PolarPoint = {
  frequencyHz: number;
  plane: PolarPlane;
  angleDeg: number;
  levelDb: number;
};

export type NormalizedPolarPoint = PolarPoint & {
  relativeDb: number;
  onAxisLevelDb: number;
};

export type PolarBeamwidth = {
  left: number | null;
  right: number | null;
  width: number | null;
  onAxisLevelDb: number;
};

const MAX_POLAR_FILE_CHARS = 5_000_000;
const MAX_POLAR_POINTS = 100_000;

function parseDelimitedRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV có dấu ngoặc kép chưa đóng.");
  cells.push(cell.trim());
  return cells;
}

function parseFiniteCell(value: string | undefined, rowNumber: number, field: string, decimalComma: boolean): number {
  if (value === undefined || value.trim() === "") {
    throw new Error("Dòng " + rowNumber + ": thiếu cột " + field + ".");
  }
  const normalized = decimalComma ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error("Dòng " + rowNumber + ": giá trị " + field + " không phải số hợp lệ.");
  }
  return parsed;
}

function normalizePlane(value: string | undefined, rowNumber: number): PolarPlane {
  const normalized = (value ?? "V").trim().toUpperCase();
  if (["H", "HOR", "HORIZONTAL"].includes(normalized)) return "H";
  if (["V", "VER", "VERTICAL"].includes(normalized)) return "V";
  throw new Error("Dòng " + rowNumber + ": plane chỉ nhận H/Horizontal hoặc V/Vertical.");
}

/** Strict CSV parser for measured/vendor polar magnitude data. It never fills missing angles. */
export function parsePolarCsv(source: string): PolarPoint[] {
  if (typeof source !== "string" || source.trim().length === 0) {
    throw new Error("File polar đang rỗng.");
  }
  if (source.length > MAX_POLAR_FILE_CHARS) {
    throw new Error("File polar vượt giới hạn 5 MB.");
  }

  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const nonEmptyLines = lines
    .map((line, index) => ({ line: line.trim(), rowNumber: index + 1 }))
    .filter(item => item.line.length > 0);
  if (nonEmptyLines.length < 4) {
    throw new Error("File cần có tiêu đề và ít nhất ba mẫu polar hợp lệ.");
  }

  const headerLine = nonEmptyLines[0].line;
  const delimiter = headerLine.includes("\t") ? "\t" : headerLine.includes(";") ? ";" : ",";
  const headers = parseDelimitedRow(headerLine, delimiter)
    .map(value => value.toLowerCase().replace(/[\s-]+/g, "_"));
  const findColumn = (aliases: string[]) => headers.findIndex(header => aliases.includes(header));
  const frequencyIndex = findColumn(["frequency_hz", "freq_hz", "frequency", "freq", "hz"]);
  const angleIndex = findColumn(["angle_deg", "angle", "degrees", "deg"]);
  const levelIndex = findColumn(["level_db", "spl_db", "relative_db", "magnitude_db", "level", "spl", "db"]);
  const planeIndex = findColumn(["plane", "axis", "orientation"]);
  if (frequencyIndex < 0 || angleIndex < 0 || levelIndex < 0) {
    throw new Error("Không nhận dạng tiêu đề cột. Dùng frequency_hz, angle_deg, level_db và plane (H/V).");
  }

  const decimalComma = delimiter === ";";
  const points: PolarPoint[] = [];
  const seen = new Set<string>();
  for (const item of nonEmptyLines.slice(1)) {
    const row = parseDelimitedRow(item.line, delimiter);
    const frequencyHz = parseFiniteCell(row[frequencyIndex], item.rowNumber, "frequency_hz", decimalComma);
    const angleDeg = parseFiniteCell(row[angleIndex], item.rowNumber, "angle_deg", decimalComma);
    const levelDb = parseFiniteCell(row[levelIndex], item.rowNumber, "level_db", decimalComma);
    const plane = normalizePlane(planeIndex < 0 ? "V" : row[planeIndex], item.rowNumber);

    if (frequencyHz < 20 || frequencyHz > 40000) {
      throw new Error("Dòng " + item.rowNumber + ": frequency_hz phải trong 20–40000 Hz.");
    }
    if (angleDeg < -180 || angleDeg > 180) {
      throw new Error("Dòng " + item.rowNumber + ": angle_deg phải trong −180° đến +180°.");
    }
    if (levelDb < -200 || levelDb > 200) {
      throw new Error("Dòng " + item.rowNumber + ": level_db phải trong −200 đến +200 dB.");
    }

    const roundedAngle = Math.round(angleDeg * 1_000_000) / 1_000_000;
    const key = frequencyHz + "|" + plane + "|" + roundedAngle;
    if (seen.has(key)) {
      throw new Error("Dòng " + item.rowNumber + ": trùng mẫu frequency/plane/angle; không thể xác định đường polar duy nhất.");
    }
    seen.add(key);
    points.push({ frequencyHz, plane, angleDeg, levelDb });
    if (points.length > MAX_POLAR_POINTS) {
      throw new Error("File có quá 100.000 mẫu polar; hãy chia file theo model hoặc dải tần.");
    }
  }

  if (points.length < 3) {
    throw new Error("Không đủ dữ liệu polar. Cần ít nhất ba mẫu có tần số, góc và mức hợp lệ.");
  }
  points.sort((a, b) => a.frequencyHz - b.frequencyHz || a.plane.localeCompare(b.plane) || a.angleDeg - b.angleDeg);
  return points;
}

/** Determine the measured on-axis level at 0 degrees; interpolate only when both sides exist. */
export function getPolarOnAxisLevel(points: PolarPoint[]): number | null {
  if (!Array.isArray(points) || points.length === 0) return null;
  const exact = points.find(point => Math.abs(point.angleDeg) < 1e-9);
  if (exact) return exact.levelDb;

  let negative: PolarPoint | null = null;
  let positive: PolarPoint | null = null;
  for (const point of points) {
    if (point.angleDeg < 0 && (!negative || point.angleDeg > negative.angleDeg)) negative = point;
    if (point.angleDeg > 0 && (!positive || point.angleDeg < positive.angleDeg)) positive = point;
  }
  if (!negative || !positive) return null;
  const span = positive.angleDeg - negative.angleDeg;
  if (span <= 0) return null;
  const ratio = (0 - negative.angleDeg) / span;
  return negative.levelDb + (positive.levelDb - negative.levelDb) * ratio;
}

/** Return no normalized curve when the actual 0-degree axis cannot be established. */
export function normalizePolarCurve(points: PolarPoint[]): NormalizedPolarPoint[] | null {
  const onAxisLevelDb = getPolarOnAxisLevel(points);
  if (onAxisLevelDb === null) return null;
  return points.map(point => ({ ...point, relativeDb: point.levelDb - onAxisLevelDb, onAxisLevelDb }));
}

function interpolateThreshold(
  a: NormalizedPolarPoint,
  b: NormalizedPolarPoint,
  thresholdDb: number,
): number {
  const span = b.relativeDb - a.relativeDb;
  if (Math.abs(span) < 1e-9) return (a.angleDeg + b.angleDeg) / 2;
  return a.angleDeg + ((thresholdDb - a.relativeDb) / span) * (b.angleDeg - a.angleDeg);
}

export function calculatePolarBeamwidth(
  points: NormalizedPolarPoint[],
  thresholdDb = -6,
): PolarBeamwidth | null {
  if (!Array.isArray(points) || points.length < 3 || !Number.isFinite(thresholdDb) || thresholdDb >= 0) return null;
  const axis = points[0].onAxisLevelDb;
  const positive = points.filter(point => point.angleDeg >= 0).sort((a, b) => a.angleDeg - b.angleDeg);
  const negative = points.filter(point => point.angleDeg <= 0).sort((a, b) => b.angleDeg - a.angleDeg);
  const findEdge = (side: NormalizedPolarPoint[]): number | null => {
    for (let index = 1; index < side.length; index++) {
      const previous = side[index - 1];
      const next = side[index];
      if (previous.relativeDb > thresholdDb && next.relativeDb <= thresholdDb) {
        return interpolateThreshold(previous, next, thresholdDb);
      }
    }
    return null;
  };
  const left = findEdge(negative);
  const right = findEdge(positive);
  return {
    left,
    right,
    width: left !== null && right !== null ? Math.abs(right - left) : null,
    onAxisLevelDb: axis,
  };
}
