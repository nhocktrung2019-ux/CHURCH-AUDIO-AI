export type DeviceCategory = "speaker" | "microphone";
export type EvidenceKind = "manufacturer-datasheet" | "measured-file" | "manual-reference";
export type EvidenceStatus = "verified" | "unverified" | "needs-review";
export type CurveUnit = "relative-response-dB" | "dB-SPL";

export type EvidenceRecord = {
  id: string;
  kind: EvidenceKind;
  status: EvidenceStatus;
  sourceName: string;
  sourceUrl?: string;
  revision?: string;
  publishedAt?: string;
  accessedAt?: string;
  notes?: string;
};

export type ResponsePoint = { frequencyHz: number; level: number };
export type ResponseCurve = {
  unit: CurveUnit;
  referenceDescription: string;
  evidenceId: string;
  points: ResponsePoint[];
};

export type PolarPoint = { angleDegrees: number; relativeLevelDb: number };
export type PolarData = {
  plane: "horizontal" | "vertical";
  frequencyHz: number;
  evidenceId: string;
  points: PolarPoint[];
};

export type DeviceProfile = {
  id: string;
  category: DeviceCategory;
  brand: string;
  model: string;
  aliases?: string[];
  identityStatus: EvidenceStatus;
  evidence: EvidenceRecord[];
  frequencyRangeHz?: { min: number; max: number };
  responseCurves?: ResponseCurve[];
  polarData?: PolarData[];
  sensitivity?: { value: number; unit: string; condition?: string };
  impedanceOhms?: number;
  microphonePattern?: string;
  connector?: string;
  phantomPower?: "required" | "not-required" | "optional" | "unknown";
  notes?: string[];
};

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
};

const finite = (value: number) => Number.isFinite(value);

export function validateDeviceProfile(profile: DeviceProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, path: string, message: string, severity: "error" | "warning" = "error") =>
    issues.push({ code, path, message, severity });

  if (!profile.id.trim()) issue("missing-id", "id", "Device ID is required.");
  if (!profile.brand.trim()) issue("missing-brand", "brand", "Brand is required.");
  if (!profile.model.trim()) issue("missing-model", "model", "Model is required.");
  if (profile.identityStatus === "verified" && !profile.evidence.some(e => e.status === "verified")) {
    issue("identity-without-evidence", "evidence", "A verified identity requires at least one verified evidence record.");
  }
  if (profile.identityStatus !== "verified") {
    issue("identity-unverified", "identityStatus", "Model identity has not been verified; do not use this profile for automatic recommendations.", "warning");
  }

  const evidenceIds = new Set<string>();
  for (const [index, evidence] of profile.evidence.entries()) {
    if (!evidence.id.trim() || evidenceIds.has(evidence.id)) issue("duplicate-evidence-id", `evidence[${index}].id`, "Evidence IDs must be non-empty and unique.");
    evidenceIds.add(evidence.id);
    if (!evidence.sourceName.trim()) issue("missing-source-name", `evidence[${index}].sourceName`, "Record the source name.");
    if (evidence.status === "verified" && evidence.kind === "manual-reference") {
      issue("manual-cannot-verify", `evidence[${index}].status`, "Manual references alone cannot establish verified manufacturer specifications.");
    }
  }

  if (profile.frequencyRangeHz) {
    const { min, max } = profile.frequencyRangeHz;
    if (!finite(min) || !finite(max) || min <= 0 || max <= min) {
      issue("invalid-frequency-range", "frequencyRangeHz", "Frequency range must be positive and max must exceed min.");
    }
  }
  if (profile.sensitivity && (!finite(profile.sensitivity.value) || !profile.sensitivity.unit.trim())) {
    issue("invalid-sensitivity", "sensitivity", "Sensitivity requires a finite value and an explicit unit.");
  }
  if (profile.impedanceOhms !== undefined && (!finite(profile.impedanceOhms) || profile.impedanceOhms <= 0)) {
    issue("invalid-impedance", "impedanceOhms", "Impedance must be a positive finite value.");
  }

  for (const [curveIndex, curve] of (profile.responseCurves ?? []).entries()) {
    const path = `responseCurves[${curveIndex}]`;
    if (!evidenceIds.has(curve.evidenceId)) issue("curve-missing-evidence", `${path}.evidenceId`, "Response curve must reference a profile evidence record.");
    if (!curve.referenceDescription.trim()) issue("curve-missing-reference", `${path}.referenceDescription`, "Describe the measurement/reference conditions.");
    if (curve.points.length < 2) issue("curve-too-short", `${path}.points`, "At least two measured or sourced points are required.");
    for (let i = 0; i < curve.points.length; i++) {
      const point = curve.points[i];
      if (!finite(point.frequencyHz) || point.frequencyHz <= 0 || !finite(point.level)) {
        issue("invalid-curve-point", `${path}.points[${i}]`, "Curve points must contain finite positive frequencies and finite levels.");
      }
      if (i > 0 && point.frequencyHz <= curve.points[i - 1].frequencyHz) {
        issue("curve-order", `${path}.points[${i}]`, "Curve frequencies must be strictly increasing; no silent sorting or interpolation is applied.");
      }
    }
    if (curve.unit === "dB-SPL" && !curve.referenceDescription.toLowerCase().includes("calibrat")) {
      issue("spl-reference-warning", `${path}.referenceDescription`, "dB SPL curve should document calibration and measurement conditions.", "warning");
    }
  }

  for (const [polarIndex, polar] of (profile.polarData ?? []).entries()) {
    const path = `polarData[${polarIndex}]`;
    if (!evidenceIds.has(polar.evidenceId)) issue("polar-missing-evidence", `${path}.evidenceId`, "Polar data must reference an evidence record.");
    if (!finite(polar.frequencyHz) || polar.frequencyHz <= 0) issue("invalid-polar-frequency", `${path}.frequencyHz`, "Polar frequency must be positive and finite.");
    for (const [pointIndex, point] of polar.points.entries()) {
      if (!finite(point.angleDegrees) || point.angleDegrees < -180 || point.angleDegrees > 180 || !finite(point.relativeLevelDb)) {
        issue("invalid-polar-point", `${path}.points[${pointIndex}]`, "Polar points require angles from -180 to 180 degrees and finite relative levels.");
      }
    }
  }

  return issues;
}

export function isProfileUsableForEngineering(profile: DeviceProfile): boolean {
  return validateDeviceProfile(profile).every(item => item.severity !== "error") &&
    profile.identityStatus === "verified" &&
    profile.evidence.some(item => item.status === "verified" && item.kind !== "manual-reference");
}

export type ProcessingContext = {
  deviceId: string;
  signalRole: "speech-microphone" | "wireless-microphone" | "main-speaker" | "fill-speaker" | "subwoofer";
  hasMeasuredNoiseFloor: boolean;
  hasGainBeforeFeedbackCheck: boolean;
  hasVerifiedManufacturerLimits: boolean;
};

export type ProcessingAdvisory = {
  stage: "gate" | "compressor" | "limiter";
  status: "review-required" | "blocked";
  recommendation: string;
  requiredChecks: string[];
  automaticWrite: false;
};

/** Qualitative checklist only. It deliberately does not invent threshold, ratio, attack, release or limiter values. */
export function buildProcessingAdvisories(context: ProcessingContext): ProcessingAdvisory[] {
  const microphone = context.signalRole === "speech-microphone" || context.signalRole === "wireless-microphone";
  const advisories: ProcessingAdvisory[] = [];
  if (microphone) {
    advisories.push({
      stage: "gate",
      status: "review-required",
      recommendation: "Consider an expander/gate only after checking speech tails, room decay, microphone distance and bleed. Prefer gentle attenuation over abrupt chopping.",
      requiredChecks: ["Measure room/noise floor with the microphone open.", "Check quiet speech and word endings.", "Check bleed and feedback margin.", "A/B test with the actual speaker routing."],
      automaticWrite: false,
    });
    advisories.push({
      stage: "compressor",
      status: "review-required",
      recommendation: "Set compression from the speaker's real vocal dynamics and desired gain consistency; avoid excessive gain compensation that reduces feedback margin.",
      requiredChecks: ["Observe representative speech peaks and average level.", "Check gain reduction during loud and quiet phrases.", "Re-check feedback margin after makeup gain.", "Document operator-approved settings."],
      automaticWrite: false,
    });
  } else {
    advisories.push({
      stage: "compressor",
      status: "review-required",
      recommendation: "Use speaker-bus compression only when the system role and program dynamics justify it; preserve transient clarity and avoid using compression to conceal coverage or alignment faults.",
      requiredChecks: ["Confirm speaker model and manufacturer operating limits.", "Measure representative program peaks.", "Check amplifier/DSP headroom and gain structure.", "Compare bypass and processed response."],
      automaticWrite: false,
    });
    advisories.push({
      stage: "limiter",
      status: context.hasVerifiedManufacturerLimits ? "review-required" : "blocked",
      recommendation: context.hasVerifiedManufacturerLimits
        ? "A peak/RMS protection design may be reviewed against verified loudspeaker and amplifier limits."
        : "Limiter values are blocked until loudspeaker and amplifier limits are verified from authoritative documentation.",
      requiredChecks: ["Verify loudspeaker continuous/peak ratings and impedance.", "Verify amplifier output and DSP limiter topology.", "Confirm voltage, time-constant and detector conventions.", "Bench-test protection before live use."],
      automaticWrite: false,
    });
  }
  if (!context.hasMeasuredNoiseFloor) {
    advisories.forEach(item => item.requiredChecks.push("Measure the actual noise floor before setting thresholds."));
  }
  if (!context.hasGainBeforeFeedbackCheck) {
    advisories.forEach(item => item.requiredChecks.push("Re-check gain-before-feedback at the installed microphone and loudspeaker positions."));
  }
  if (!isNonEmpty(context.deviceId)) {
    advisories.forEach(item => { item.status = "blocked"; });
  }
  return advisories;
}

const isNonEmpty = (value: string) => typeof value === "string" && value.trim().length > 0;

export type CatalogueSeed = { brand: string; model: string; category: DeviceCategory; note: string };

/** User-requested names are intake candidates, not verified specifications or manufacturer claims. */
export const requestedCatalogueSeeds: CatalogueSeed[] = [
  { brand: "JBL", model: "CBT 50", category: "speaker", note: "Exact suffix/variant and manufacturer datasheet required." },
  { brand: "JBL", model: "CBT 70", category: "speaker", note: "Exact suffix/variant and manufacturer datasheet required." },
  { brand: "JBL", model: "CBT 100", category: "speaker", note: "Exact suffix/variant and manufacturer datasheet required." },
  { brand: "Unconfirmed", model: "Column 600", category: "speaker", note: "Brand and exact model identity required." },
  { brand: "Unconfirmed", model: "Column 800", category: "speaker", note: "Brand and exact model identity required." },
  { brand: "Unconfirmed", model: "MA12", category: "speaker", note: "Confirm exact model and regional datasheet." },
  { brand: "Unconfirmed", model: "MA12 EX", category: "speaker", note: "Confirm exact model spelling and manufacturer source." },
  { brand: "Bose", model: "402 IV", category: "speaker", note: "Confirm generation and exact product designation." },
  { brand: "Bose", model: "402 V", category: "speaker", note: "Confirm generation and exact product designation." },
  { brand: "Bose", model: "802 V", category: "speaker", note: "Confirm generation and exact product designation." },
  { brand: "Bose", model: "502", category: "speaker", note: "Confirm exact 502 product family and variant." },
  { brand: "Inter-M", model: "CU7120", category: "speaker", note: "Exact manufacturer datasheet required." },
  { brand: "Inter-M", model: "CU7060", category: "speaker", note: "Exact manufacturer datasheet required." },
  { brand: "TOA", model: "BS1030", category: "speaker", note: "Confirm exact suffix and regional datasheet." },
  { brand: "Shure", model: "Dynamic microphone (model unspecified)", category: "microphone", note: "Select exact model before importing response/sensitivity." },
  { brand: "Unconfirmed", model: "Gooseneck microphone (model unspecified)", category: "microphone", note: "Brand, capsule model and polar pattern required." },
];
