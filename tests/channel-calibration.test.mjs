import test from "node:test";
import assert from "node:assert/strict";
import {
  applyChannelCalibration,
  correctLoopbackDelayMs,
  interpolateChannelCalibration,
  isChannelCalibrationCompatible,
  validateChannelCalibrationProfile,
} from "../src/audio/channelCalibration.ts";

const profile = {
  schemaVersion: 1,
  deviceKey: "usb-interface-A",
  inputChannel: 1,
  outputKey: "usb-interface-A-out-1",
  sampleRate: 48000,
  loopbackDelayMs: 1.25,
  points: [
    { frequencyHz: 50, magnitudeDb: 2, phaseDeg: 10 },
    { frequencyHz: 1000, magnitudeDb: 4, phaseDeg: 20 },
    { frequencyHz: 10000, magnitudeDb: 6, phaseDeg: 30 },
  ],
};

test("accepts a bounded, ordered calibration profile", () => {
  assert.deepEqual(validateChannelCalibrationProfile(profile), { valid: true });
});

test("rejects duplicate frequencies and insufficient bandwidth", () => {
  assert.equal(validateChannelCalibrationProfile({ ...profile, points: [
    profile.points[0], profile.points[0], profile.points[2],
  ] }).valid, false);
  assert.equal(validateChannelCalibrationProfile({ ...profile, points: profile.points.slice(1) }).valid, false);
});

test("calibration compatibility requires exact interface, channel, output and sample rate", () => {
  assert.equal(isChannelCalibrationCompatible(profile, {
    deviceKey: "usb-interface-A", inputChannel: 1, outputKey: "usb-interface-A-out-1", sampleRate: 48000,
  }), true);
  assert.equal(isChannelCalibrationCompatible(profile, {
    deviceKey: "usb-interface-A", inputChannel: 0, outputKey: "usb-interface-A-out-1", sampleRate: 48000,
  }), false);
  assert.equal(isChannelCalibrationCompatible(profile, {
    deviceKey: "usb-interface-A", inputChannel: 1, outputKey: "usb-interface-A-out-1", sampleRate: 44100,
  }), false);
});

test("log-frequency interpolation is bounded and does not extrapolate", () => {
  const midpoint = interpolateChannelCalibration(profile.points, Math.sqrt(50 * 1000));
  assert.ok(midpoint);
  assert.ok(Math.abs(midpoint.magnitudeDb - 3) < 1e-9);
  assert.equal(interpolateChannelCalibration(profile.points, 20), null);
});

test("removes calibrated loopback magnitude, phase and delay", () => {
  const corrected = applyChannelCalibration([{
    frequencyHz: 1000, magnitudeDb: 10, phaseDeg: 90, coherence: 0.98,
  }], profile);
  assert.ok(corrected);
  assert.equal(corrected[0].magnitudeDb, 6);
  assert.equal(corrected[0].phaseDeg, 70);
  assert.equal(corrected[0].coherence, 0.98);
  assert.equal(correctLoopbackDelayMs(4.25, profile), 3);
});
