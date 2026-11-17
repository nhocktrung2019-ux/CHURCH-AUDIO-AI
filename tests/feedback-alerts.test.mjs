import test from "node:test";
import assert from "node:assert/strict";
import { describeVietnameseFeedbackAlert } from "../src/audio/feedbackAlerts.ts";

const candidate = (overrides = {}) => ({
  index: 20,
  frequencyHz: 1250,
  prominenceDb: 9.5,
  levelDb: -52,
  recommendedCutDb: -3,
  q: 6.2,
  persistence: 90,
  confidence: "high",
  ...overrides,
});

test("empty candidate list produces a clear Vietnamese status", () => {
  const alert = describeVietnameseFeedbackAlert([]);
  assert.equal(alert.severity, "clear");
  assert.match(alert.title, /Chưa phát hiện/);
  assert.match(alert.summary, /RTA/);
});

test("medium-confidence narrow peak produces a check warning, not a confirmed howl", () => {
  const alert = describeVietnameseFeedbackAlert([candidate({ confidence: "medium", persistence: 70 })]);
  assert.equal(alert.severity, "watch");
  assert.match(alert.title, /Cần kiểm tra/);
  assert.match(alert.summary, /chưa phải xác nhận vòng hú/);
  assert.match(alert.recommendation, /cô lập từng micro/);
});

test("persistent high-confidence peak produces a high-priority Vietnamese warning", () => {
  const alert = describeVietnameseFeedbackAlert([candidate()]);
  assert.equal(alert.severity, "high");
  assert.match(alert.title, /Cảnh báo cao/);
  assert.match(alert.summary, /1,25 kHz/);
  assert.match(alert.recommendation, /Hạ gain/);
});

test("multiple candidate frequencies are summarized in Vietnamese", () => {
  const alert = describeVietnameseFeedbackAlert([
    candidate({ frequencyHz: 1000, prominenceDb: 12 }),
    candidate({ frequencyHz: 630, prominenceDb: 8, confidence: "medium" }),
    candidate({ frequencyHz: 2500, prominenceDb: 7, confidence: "medium" }),
    candidate({ frequencyHz: 4000, prominenceDb: 6, confidence: "medium" }),
  ]);
  assert.equal(alert.severity, "high");
  assert.match(alert.summary, /1 kHz/);
  assert.match(alert.summary, /630 Hz/);
  assert.match(alert.summary, /2,5 kHz/);
  assert.doesNotMatch(alert.summary, /4 kHz/);
});
