import type { SpeakerSpec } from "../data/speakerModels.ts";

export type SpeakerProfileAudit = {
  model: string;
  manufacturer: string;
  referenceStatus: "reference-listed-unverified" | "missing-reference";
  availableFields: string[];
  unknownFields: string[];
  frequencySpecificCoverage: boolean;
  polarDataVerified: false;
  predictionUse: "reference-only" | "insufficient-data";
  warnings: string[];
};

/**
 * Audits catalogue completeness without fetching or asserting that a linked
 * source is current. A URL in the catalogue is not proof that it matches the
 * exact hardware revision, preset or array configuration.
 */
export function auditSpeakerProfile(spec: SpeakerSpec): SpeakerProfileAudit {
  const fields: Array<[string, number | null | undefined]> = [
    ["horizontalCoverage", spec.horizontalDeg],
    ["verticalCoverage", spec.verticalDeg],
    ["sensitivityDb1W1m", spec.sensitivityDb1W1m],
    ["powerLongTermW", spec.powerLongTermW],
    ["impedanceOhm", spec.impedanceOhm],
  ];
  const availableFields = fields.filter(([, value]) => Number.isFinite(value)).map(([name]) => name);
  const unknownFields = fields.filter(([, value]) => !Number.isFinite(value)).map(([name]) => name);
  const referenceStatus = spec.source?.trim() && spec.sourceNote?.trim()
    ? "reference-listed-unverified"
    : "missing-reference";
  const frequencySpecificCoverage = Boolean(spec.coverageByFrequency?.length);
  const warnings = [
    "Nguồn tham khảo được ghi trong catalogue nhưng chưa được ứng dụng xác minh trực tuyến hoặc đối chiếu revision.",
    "Không suy ra polar, phase, beamwidth theo tần số hoặc đáp tuyến còn thiếu từ tên model.",
    "Dữ liệu thông số không thay thế file GLL/CLF hoặc dữ liệu nhà sản xuất đúng cấu hình.",
  ];
  if (unknownFields.length) warnings.push("Thiếu trường: " + unknownFields.join(", ") + ".");
  if (!frequencySpecificCoverage) warnings.push("Chưa có coverage table theo tần số.");
  return {
    model: spec.model,
    manufacturer: spec.manufacturer,
    referenceStatus,
    availableFields,
    unknownFields,
    frequencySpecificCoverage,
    polarDataVerified: false,
    predictionUse: availableFields.length >= 3 && referenceStatus !== "missing-reference"
      ? "reference-only" : "insufficient-data",
    warnings,
  };
}

export function auditSpeakerCatalogue(specs: Record<string, SpeakerSpec>): SpeakerProfileAudit[] {
  return Object.entries(specs).map(([key, spec]) => ({
    ...auditSpeakerProfile(spec),
    model: spec.model || key,
  })).sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model));
}
