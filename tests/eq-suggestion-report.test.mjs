import test from "node:test";
import assert from "node:assert/strict";
import { buildEqSuggestionReport } from "../src/audio/eqSuggestionReport.ts";

const input = (overrides = {}) => ({
  generatedAt: "2026-11-20T06:30:00.000Z",
  targetProfile: { id: "flat", label: "Flat", description: "Reference target" },
  source: "multi-position",
  measurement: { sampleRate: 48000, positions: 3 },
  filters: [{ frequencyHz: 250, gainDb: -3, q: 2.4, coherence: 0.96 }],
  ...overrides,
});

test("creates a versioned advisory report with hardware writes disabled", () => {
  const report = buildEqSuggestionReport(input());
  assert.equal(report.schema, "church-audio.eq-suggestion-report");
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.status, "advisory-not-applied");
  assert.equal(report.source, "multi-position");
  assert.equal(report.safety.hardwareWriteEnabled, false);
  assert.equal(report.safety.operatorReviewed, false);
  assert.equal(report.filters[0].gainDb, -3);
});

test("accepts only bounded cut-only PEQ filters with adequate coherence", () => {
  assert.throws(() => buildEqSuggestionReport(input({ filters: [{ frequencyHz: 1000, gainDb: 1, q: 2, coherence: 0.95 }] })));
  assert.throws(() => buildEqSuggestionReport(input({ filters: [{ frequencyHz: 1000, gainDb: -5, q: 2, coherence: 0.95 }] })));
  assert.throws(() => buildEqSuggestionReport(input({ filters: [{ frequencyHz: 1000, gainDb: -2, q: 2, coherence: 0.79 }] })));
  assert.throws(() => buildEqSuggestionReport(input({ filters: [{ frequencyHz: 15000, gainDb: -2, q: 2, coherence: 0.95 }] })));
});

test("rejects malformed metadata, source and filter counts", () => {
  assert.throws(() => buildEqSuggestionReport(input({ generatedAt: "not-a-date" })));
  assert.throws(() => buildEqSuggestionReport(input({ source: "unknown" })));
  assert.throws(() => buildEqSuggestionReport(input({ filters: [] })));
  assert.throws(() => buildEqSuggestionReport(input({ filters: Array.from({ length: 7 }, () => ({ frequencyHz: 1000, gainDb: -2, q: 2, coherence: 0.95 })) })));
});
