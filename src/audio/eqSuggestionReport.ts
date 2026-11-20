export type EqSuggestionFilter = {
  frequencyHz: number;
  gainDb: number;
  q: number;
  coherence: number;
};
export type EqSuggestionReportInput = {
  generatedAt: string;
  targetProfile: { id: string; label: string; description: string };
  source: "single" | "multi-position";
  measurement: Record<string, unknown> | null;
  filters: readonly EqSuggestionFilter[];
};

/** Builds a portable, versioned PEQ worksheet. It never represents a DSP write. */
export function buildEqSuggestionReport(input: EqSuggestionReportInput) {
  if (!input.generatedAt || !Number.isFinite(Date.parse(input.generatedAt))) {
    throw new Error("Thời điểm tạo báo cáo EQ không hợp lệ.");
  }
  if (!input.targetProfile.id.trim() || !input.targetProfile.label.trim()) {
    throw new Error("Thiếu thông tin đường cong mục tiêu EQ.");
  }
  if (input.source !== "single" && input.source !== "multi-position") {
    throw new Error("Nguồn dữ liệu EQ không hợp lệ.");
  }
  if (!Array.isArray(input.filters) || input.filters.length < 1 || input.filters.length > 6) {
    throw new Error("Báo cáo PEQ cần từ 1 đến 6 filter.");
  }
  const filters = input.filters.map((filter, index) => {
    if (!Number.isFinite(filter.frequencyHz) || filter.frequencyHz < 80 || filter.frequencyHz > 10000
      || !Number.isFinite(filter.gainDb) || filter.gainDb > 0 || filter.gainDb < -4
      || !Number.isFinite(filter.q) || filter.q < 0.7 || filter.q > 10
      || !Number.isFinite(filter.coherence) || filter.coherence < 0.8 || filter.coherence > 1) {
      throw new Error("Filter PEQ số " + (index + 1) + " nằm ngoài giới hạn an toàn.");
    }
    return {
      band: index + 1,
      type: "PEQ" as const,
      frequencyHz: Math.round(filter.frequencyHz),
      gainDb: Math.round(filter.gainDb * 10) / 10,
      q: Math.round(filter.q * 10) / 10,
      coherence: Number(filter.coherence.toFixed(3)),
    };
  });
  return {
    schema: "church-audio.eq-suggestion-report",
    schemaVersion: "1.0.0",
    status: "advisory-not-applied" as const,
    generatedAt: input.generatedAt,
    targetProfile: input.targetProfile,
    source: input.source,
    measurement: input.measurement,
    filters,
    safety: {
      operatorReviewRequired: true,
      operatorReviewed: false,
      hardwareWriteEnabled: false,
      automaticDspWrite: false,
      instruction: "Verify by listening and repeat measurement before manual DSP entry. No parameters are written to hardware.",
    },
  };
}
