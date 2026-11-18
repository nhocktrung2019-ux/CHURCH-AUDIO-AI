import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInputSplOffset,
  createInputSplCalibration,
  estimateOneKilohertzDbfs,
  normalizeInputSplCalibrationRegistry,
  validateInputSplCalibration,
} from "../src/audio/perInputSplCalibration.ts";

test("one-point SPL calibration derives offset from a real 1 kHz reference", () => {
  const profile = createInputSplCalibration("usb-mic-1", 48000, -36.25, 94, "2026-11-18T08:00:00.000Z");
  assert.ok(profile);
  assert.equal(profile.offsetDb, 130.25);
  assert.equal(applyInputSplOffset(-36.25, profile), 94);
});

test("114 dB calibrator reference is supported without changing the measured tone", () => {
  const profile = createInputSplCalibration("usb-mic-2", 48000, -16, 114, "2026-11-18T08:00:00.000Z");
  assert.equal(profile?.offsetDb, 130);
  assert.equal(applyInputSplOffset(-26, profile), 104);
});

test("calibration rejects invalid route, sample rate, level and reference", () => {
  assert.equal(createInputSplCalibration("", 48000, -30, 94), null);
  assert.equal(createInputSplCalibration("mic", 4000, -30, 94), null);
  assert.equal(createInputSplCalibration("mic", 48000, -100, 94), null);
  assert.equal(createInputSplCalibration("mic", 48000, -30, 100), null);
});

test("profile registry isolates exact device IDs and rejects tampering", () => {
  const valid = createInputSplCalibration("usb-a", 48000, -30, 94, "2026-11-18T08:00:00.000Z");
  assert.ok(valid);
  const invalid = { ...valid, offsetDb: 0 };
  const restored = normalizeInputSplCalibrationRegistry({ "usb-a": valid, "usb-b": invalid });
  assert.deepEqual(Object.keys(restored), ["usb-a"]);
  assert.equal(validateInputSplCalibration(valid, "usb-b"), false);
});

test("1 kHz estimator averages spectral power around target frequency", () => {
  const data = new Float32Array(4096).fill(-120);
  // At 48 kHz / 8192 FFT, bins 168–174 straddle 1 kHz.
  data[170] = -30;
  data[171] = -30;
  const level = estimateOneKilohertzDbfs(data, 48000, 8192);
  assert.ok(level !== null && level > -31 && level < -29);
});

test("1 kHz estimator rejects invalid FFT metadata and silence", () => {
  const data = new Float32Array(4096).fill(-120);
  assert.equal(estimateOneKilohertzDbfs(data, 48000, 8192), null);
  assert.equal(estimateOneKilohertzDbfs(data, 48000, 4096), null);
  assert.equal(estimateOneKilohertzDbfs(data, 0, 8192), null);
});
