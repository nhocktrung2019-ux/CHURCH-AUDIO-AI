import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDeviceProfile,
  isProfileUsableForEngineering,
  buildProcessingAdvisories,
  requestedCatalogueSeeds,
} from "../src/audio/deviceCatalogue.ts";

const verifiedProfile = {
  id: "speaker-test",
  category: "speaker",
  brand: "Example",
  model: "Model A",
  identityStatus: "verified",
  evidence: [{
    id: "datasheet-1",
    kind: "manufacturer-datasheet",
    status: "verified",
    sourceName: "Official manufacturer datasheet",
    sourceUrl: "https://example.invalid/datasheet",
    revision: "Rev A",
  }],
  frequencyRangeHz: { min: 80, max: 18000 },
  responseCurves: [{
    unit: "relative-response-dB",
    referenceDescription: "Manufacturer-published relative response, reference axis documented",
    evidenceId: "datasheet-1",
    points: [{ frequencyHz: 100, level: -2 }, { frequencyHz: 1000, level: 0 }, { frequencyHz: 10000, level: -3 }],
  }],
};

test("accepts a traceable verified profile without changing curve values", () => {
  assert.deepEqual(validateDeviceProfile(verifiedProfile), []);
  assert.equal(isProfileUsableForEngineering(verifiedProfile), true);
  assert.deepEqual(verifiedProfile.responseCurves[0].points.map(p => p.frequencyHz), [100, 1000, 10000]);
});

test("blocks verified identity without verified evidence", () => {
  const profile = { ...verifiedProfile, evidence: verifiedProfile.evidence.map(e => ({ ...e, status: "unverified" })) };
  assert.ok(validateDeviceProfile(profile).some(item => item.code === "identity-without-evidence"));
  assert.equal(isProfileUsableForEngineering(profile), false);
});

test("rejects non-monotonic frequency curves and orphan evidence references", () => {
  const profile = {
    ...verifiedProfile,
    responseCurves: [{
      ...verifiedProfile.responseCurves[0],
      evidenceId: "missing",
      points: [{ frequencyHz: 1000, level: 0 }, { frequencyHz: 500, level: -1 }],
    }],
  };
  const issues = validateDeviceProfile(profile);
  assert.ok(issues.some(item => item.code === "curve-missing-evidence"));
  assert.ok(issues.some(item => item.code === "curve-order"));
});

test("keeps unverified intake candidates separate from engineering-ready profiles", () => {
  assert.ok(requestedCatalogueSeeds.length >= 15);
  assert.ok(requestedCatalogueSeeds.some(item => item.model === "CU7120"));
  assert.ok(requestedCatalogueSeeds.every(item => item.note.length > 0));
});

test("microphone processing advice is qualitative and never writes DSP values", () => {
  const items = buildProcessingAdvisories({
    deviceId: "mic-1",
    signalRole: "speech-microphone",
    hasMeasuredNoiseFloor: false,
    hasGainBeforeFeedbackCheck: false,
    hasVerifiedManufacturerLimits: false,
  });
  assert.deepEqual(items.map(item => item.stage), ["gate", "compressor"]);
  assert.ok(items.every(item => item.automaticWrite === false));
  assert.ok(items.every(item => item.requiredChecks.some(check => check.includes("noise floor"))));
});

test("blocks speaker limiter guidance until manufacturer limits are verified", () => {
  const items = buildProcessingAdvisories({
    deviceId: "speaker-1",
    signalRole: "main-speaker",
    hasMeasuredNoiseFloor: true,
    hasGainBeforeFeedbackCheck: true,
    hasVerifiedManufacturerLimits: false,
  });
  assert.equal(items.find(item => item.stage === "limiter").status, "blocked");
});

test("blocks all processing guidance when device identity is missing", () => {
  const items = buildProcessingAdvisories({
    deviceId: "",
    signalRole: "fill-speaker",
    hasMeasuredNoiseFloor: true,
    hasGainBeforeFeedbackCheck: true,
    hasVerifiedManufacturerLimits: true,
  });
  assert.ok(items.every(item => item.status === "blocked"));
});
