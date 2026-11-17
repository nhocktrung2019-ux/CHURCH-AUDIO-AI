import test from "node:test";
import assert from "node:assert/strict";
import { assessMeasurementReadiness } from "../src/audio/measurementReadiness.ts";
const emptyEvidence = {
  knownInputChain: false, measurementMicCalibrated: false, acousticCalibratorVerified: false,
  dualChannelLoopback: false, sharedHardwareClock: false, latencyCharacterized: false,
  perInputCalibration: false, multiSourceSynchronous: false, manufacturerPolarDataVerified: false,
};
test("unverified chain never claims absolute SPL or coherent delay", () => {
  const result = assessMeasurementReadiness(emptyEvidence);
  assert.equal(result.find((item) => item.id === "spl")?.state, "limited");
  assert.equal(result.find((item) => item.id === "transfer")?.state, "limited");
  assert.equal(result.find((item) => item.id === "delay")?.state, "limited);
  assert.equal(result.find((item) => item.id === "coverage")?.state, "limited");
});
test("absolute SPL requires all input-chain and calibrator evidence", () => {
  const result = assessMeasurementReadiness({ ...emptyEvidence, knownInputChain: true, measurementMicCalibrated: true, acousticCalibratorVerified: true });
  assert.equal(result.find((item) => item.id === "spl")?.state, "ready");
  assert.equal(result.find((item) => item.id === "transfer")?.state, "limited");
});
test("transfer and absolute delay require synchronous reference and characterized latency", () => {
  const evidence = { ...emptyEvidence, dualChannelLoopback: true, sharedHardwareClock: true };
  const transfer = assessMeasurementReadiness(evidence);
  assert.equal(transfer.find((item) => item.id === "transfer")?.state, "ready");
  assert.equal(transfer.find((item) => item.id === "delay")?.state, "limited");
  assert.equal(assessMeasurementReadiness({ ...evidence, latencyCharacterized: true }).find((item) => item.id === "delay")?.state, "ready");
});
test("multi-source phase requires per-input calibration and common-clock synchronization", () => {
  const evidence = { ...emptyEvidence, perInputCalibration: true, multiSourceSynchronous: true };
  assert.equal(assessMeasurementReadiness(evidence).find((item) => item.id === "multi-phase")?.state, "limited");
  assert.equal(assessMeasurementReadiness({ ...evidence, sharedHardwareClock: true }).find((item) => item.id === "multi-phase")?.state, "ready");
});
test("verified manufacturer polar data gates high-confidence coverage claims", () => {
  const result = assessMeasurementReadiness({ ...emptyEvidence, manufacturerPolarDataVerified: true });
  assert.equal(result.find((item) => item.id === "coverage")?.state, "ready");
});
