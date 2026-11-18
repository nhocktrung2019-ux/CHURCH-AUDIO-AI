import test from "node:test";
import assert from "node:assert/strict";
import { buildFrequencyResponseSurvey, type FrequencyPositionSession } from "../src/audio/frequencyResponseSurvey.ts";
import { assessRt60Session, type Rt60SessionCapture } from "../src/audio/rt60Session.ts";
import { auditSpeakerCatalogue, auditSpeakerProfile } from "../src/audio/speakerProfileAudit.ts";
import { SPEAKER_SPECS } from "../src/data/speakerModels.ts";
import { assessDspProtocolEvidence } from "../src/audio/dspProtocolSafety.ts";
import type { TransferResult } from "../src/audio/transfer.ts";

function transferResult(offsetDb = 0, rmsDbfs = -20, inputChannelCount = 1): TransferResult {
  const points = Array.from({ length: 48 }, (_, index) => {
    const frequencyHz = 80 * Math.pow(10000 / 80, index / 47);
    return {
      frequencyHz,
      magnitudeDb: offsetDb + Math.sin(index / 5) * 0.3,
      phaseDeg: index * 2,
      coherence: 0.96,
    };
  });
  return {
    points, estimatedDelayMs: 0, confidence: 0.95, averageCoherence: 0.96,
    reliableBandPercent: 90, sampleRate: 48000, framesAveraged: 16,
    captureQuality: {
      peakDbfs: -3, rmsDbfs, clippedSamplePercent: 0,
      invalidSamplePercent: 0, sampleCount: 48000,
    },
    captureMetadata: {
      captureEngine: "AudioWorklet", inputChannelCount, pcmChannelCount: 1,
      channelMix: "arithmetic-mean", trackChannelCount: 1, trackSampleRate: 48000,
      analysisMode: "mono-acoustic",
    },
    analysisMode: "mono-acoustic",
  };
}
function position(zone: string, label: string, offset = 0): FrequencyPositionSession {
  return { zone, position: label, repeats: [transferResult(offset), transferResult(offset + 0.1), transferResult(offset - 0.1)] };
}

test("frequency response survey aggregates only repeatability-approved positions", () => {
  const result = buildFrequencyResponseSurvey([
    position("Front", "Seat A", 0),
    position("Front", "Seat B", 1),
    position("Front", "Seat C", 2),
    position("Rear", "Seat A", -1),
    position("Rear", "Seat B", 0),
    position("Rear", "Seat C", 1),
  ]);
  assert.equal(result.status, "ready");
  assert.equal(result.zones.length, 2);
  assert.equal(result.zones[0].acceptedPositionCount, 3);
  assert.ok(result.zones[0].bands.some((band) => band.status === "supported"));
});

test("frequency response survey rejects mixed acquisition chains across positions", () => {
  const mixed = position("Front", "Seat B", 0);
  mixed.repeats = mixed.repeats.map((capture) => ({
    ...capture,
    captureMetadata: { ...capture.captureMetadata!, inputChannelCount: 2 },
  }));
  const result = buildFrequencyResponseSurvey([
    position("Front", "Seat A"), mixed, position("Front", "Seat C"),
  ]);
  assert.equal(result.status, "blocked");
  assert.ok(result.notes.some((note) => note.includes("cùng cấu hình")));
});

test("frequency response survey reports insufficient spatial positions without inventing bins", () => {
  const result = buildFrequencyResponseSurvey([
    position("Front", "Seat A"), position("Front", "Seat B"),
  ]);
  assert.equal(result.status, "review");
  assert.equal(result.zones[0].bands.length, 0);
  assert.equal(result.zones[0].acceptedPositionCount, 2);
});

function rt60Result(offset = 0, quality: "good" | "limited" | "invalid" = "good") {
  return {
    sampleRate: 48000, peakIndex: 800, peakToNoiseDb: quality === "good" ? 42 : 24,
    recommendedRt60: 1.3 + offset, quality,
    bands: [125, 250, 500, 1000, 2000, 4000].map((centerHz) => ({
      centerHz, rt20Seconds: 1.2 + offset, rt30Seconds: 1.25 + offset,
      rt60Seconds: 1.3 + offset, fitR2: quality === "good" ? 0.92 : 0.78, fitRangeDb: 30,
    })),
  };
}
function rtCapture(id: string, positionName: string, offset = 0): Rt60SessionCapture {
  return {
    id, position: positionName, roomCondition: "unoccupied",
    inputLabel: "USB measurement microphone", usedFallbackInput: false,
    capturedAt: 1000 + Number(id), result: rt60Result(offset),
  };
}

test("RT60 session summarizes multiple positions using per-band medians and spread", () => {
  const result = assessRt60Session([
    rtCapture("1", "Front left", 0),
    rtCapture("2", "Center", 0.1),
    rtCapture("3", "Rear", -0.1),
  ]);
  assert.equal(result.status, "ready");
  assert.equal(result.distinctPositionCount, 3);
  const band = result.bands.find((item) => item.centerHz === 1000);
  assert.equal(band?.status, "supported");
  assert.ok(Math.abs((band?.medianRt60Seconds ?? 0) - 1.3) < 1e-9);
});

test("RT60 session blocks mixed input or sample rates and warns for fallback routing", () => {
  const mixed = [rtCapture("1", "A"), rtCapture("2", "B"), rtCapture("3", "C")];
  mixed[2].inputLabel = "Built-in phone mic";
  assert.equal(assessRt60Session(mixed).status, "blocked");

  const fallback = [rtCapture("4", "A"), rtCapture("5", "B"), rtCapture("6", "C")];
  fallback[0].usedFallbackInput = true;
  assert.equal(assessRt60Session(fallback).status, "review");
});

test("RT60 session flags inadequate positions and inconsistent room condition", () => {
  const few = assessRt60Session([rtCapture("1", "A"), rtCapture("2", "B")]);
  assert.equal(few.status, "review");
  const changed = [rtCapture("3", "A"), rtCapture("4", "B"), rtCapture("5", "C")];
  changed[2].roomCondition = "occupied";
  assert.equal(assessRt60Session(changed).status, "review");
});

test("speaker catalogue audit preserves unknown values and does not claim verified polar data", () => {
  const cbt = auditSpeakerProfile(SPEAKER_SPECS["CBT 70J-1 (CBT 70)"]);
  assert.equal(cbt.polarDataVerified, false);
  assert.ok(cbt.unknownFields.includes("sensitivityDb1W1m"));
  assert.equal(cbt.referenceStatus, "reference-listed-unverified");
  const all = auditSpeakerCatalogue(SPEAKER_SPECS);
  assert.equal(all.length, Object.keys(SPEAKER_SPECS).length);
});

test("DSP protocol evidence gate stays fail-closed even with complete documentation", () => {
  const base = {
    manufacturer: "Vendor", model: "Exact model", hardwareRevision: "Rev B", firmwareVersion: "1.2.3",
    officialProtocolReference: "Official protocol manual rev 4",
    transportDocumented: true, authenticationDocumented: true,
    readOnlyIdentityTested: true, parameterReadBackTested: true,
    configurationSnapshotVerified: true, rollbackTested: true,
    benchTestCompleted: true, technicianApproval: true,
  };
  const result = assessDspProtocolEvidence(base);
  assert.equal(result.status, "read-only-candidate");
  assert.equal(result.writeReviewEvidenceComplete, true);
  assert.equal(result.liveControlEnabled, false);
  assert.equal(result.hardwareWriteEnabled, false);
});

test("DSP protocol evidence gate remains manual-only without exact model/firmware", () => {
  const result = assessDspProtocolEvidence({
    manufacturer: "Vendor", model: "", hardwareRevision: "", firmwareVersion: "",
    officialProtocolReference: "", transportDocumented: false,
    authenticationDocumented: false, readOnlyIdentityTested: false,
    parameterReadBackTested: false, configurationSnapshotVerified: false,
    rollbackTested: false, benchTestCompleted: false, technicianApproval: false,
  });
  assert.equal(result.status, "manual-only");
  assert.equal(result.exactDeviceIdentified, false);
  assert.ok(result.missingEvidence.length >= 8);
  assert.equal(result.hardwareWriteEnabled, false);
});
