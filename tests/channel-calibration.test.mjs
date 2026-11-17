import test from "node:test";
import assert from "node:assert/strict";
import {
  applyChannelCalibration,
  applyDifferentialChannelCalibration,
  assessChannelCalibrationRepeatability,
  channelCalibrationStorageKey,
  correctDifferentialLoopbackDelayMs,
  correctLoopbackDelayMs,
  deleteChannelCalibrationProfile,
  interpolateChannelCalibration,
  isChannelCalibrationCompatible,
  loadChannelCalibrationProfile,
  saveChannelCalibrationProfile,
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

const target = {
  deviceKey: "usb-interface-A",
  inputChannel: 1,
  outputKey: "usb-interface-A-out-1",
  sampleRate: 48000,
};

function createMemoryStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test("accepts a bounded, ordered calibration profile", () => {
  assert.deepEqual(validateChannelCalibrationProfile(profile), { valid: true });
});

test("rejects malformed profiles, duplicate frequencies and insufficient bandwidth", () => {
  assert.equal(validateChannelCalibrationProfile(null).valid, false);
  assert.equal(validateChannelCalibrationProfile({ ...profile, points: [
    profile.points[0], null, profile.points[2],
  ] }).valid, false);
  assert.equal(validateChannelCalibrationProfile({ ...profile, points: [
    profile.points[0], profile.points[0], profile.points[2],
  ] }).valid, false);
  assert.equal(validateChannelCalibrationProfile({ ...profile, points: profile.points.slice(1) }).valid, false);
});

test("calibration compatibility requires exact interface, channel, output and sample rate", () => {
  assert.equal(isChannelCalibrationCompatible(profile, target), true);
  assert.equal(isChannelCalibrationCompatible(profile, { ...target, inputChannel: 0 }), false);
  assert.equal(isChannelCalibrationCompatible(profile, { ...target, sampleRate: 44100 }), false);
  assert.equal(isChannelCalibrationCompatible(profile, { ...target, outputKey: "other-output" }), false);
  assert.equal(isChannelCalibrationCompatible(profile, { ...target, deviceKey: "other-interface" }), false);
});

test("log-frequency interpolation is bounded and does not extrapolate", () => {
  const midpoint = interpolateChannelCalibration(profile.points, Math.sqrt(50 * 1000));
  assert.ok(midpoint);
  assert.ok(Math.abs(midpoint.magnitudeDb - 3) < 1e-9);
  assert.equal(interpolateChannelCalibration(profile.points, 20), null);
});

test("phase interpolation follows the nearest 360-degree branch", () => {
  const wrapped = [
    { frequencyHz: 50, magnitudeDb: 0, phaseDeg: 170 },
    { frequencyHz: 1000, magnitudeDb: 0, phaseDeg: -170 },
    { frequencyHz: 10000, magnitudeDb: 0, phaseDeg: -160 },
  ];
  const midpoint = interpolateChannelCalibration(wrapped, Math.sqrt(50 * 1000));
  assert.ok(midpoint);
  assert.ok(Math.abs(midpoint.phaseDeg - 180) < 1e-9);
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

test("does not pass uncalibrated or invalid transfer points through", () => {
  assert.equal(applyChannelCalibration([
    { frequencyHz: 1000, magnitudeDb: 1, phaseDeg: 0, coherence: 0.9 },
    { frequencyHz: 12000, magnitudeDb: 1, phaseDeg: 0, coherence: 0.9 },
  ], profile), null);
  assert.equal(applyChannelCalibration([
    { frequencyHz: 1000, magnitudeDb: 1, phaseDeg: 0, coherence: 1.1 },
  ], profile), null);
});

test("stores profiles under exact interface/channel/output/sample-rate identity", () => {
  const storage = createMemoryStorage();
  const key = channelCalibrationStorageKey(target);
  assert.ok(key);
  assert.equal(saveChannelCalibrationProfile(storage, profile), true);
  assert.deepEqual(loadChannelCalibrationProfile(storage, target), profile);
  assert.equal(loadChannelCalibrationProfile(storage, { ...target, inputChannel: 0 }), null);
  assert.equal(loadChannelCalibrationProfile(storage, { ...target, sampleRate: 44100 }), null);
  assert.equal(deleteChannelCalibrationProfile(storage, target), true);
  assert.equal(loadChannelCalibrationProfile(storage, target), null);
});

test("ignores malformed or tampered persisted profiles", () => {
  const storage = createMemoryStorage();
  const key = channelCalibrationStorageKey(target);
  assert.ok(key);
  storage.setItem(key, "{not-json");
  assert.equal(loadChannelCalibrationProfile(storage, target), null);
  storage.setItem(key, JSON.stringify({ ...profile, outputKey: "another-output" }));
  assert.equal(loadChannelCalibrationProfile(storage, target), null);
  assert.equal(saveChannelCalibrationProfile(storage, { ...profile, loopbackDelayMs: 999 }), false);
});


test("corrects synchronous Reference-to-Measurement transfer by channel calibration delta", () => {
  const referenceProfile = { ...profile, inputChannel: 0, loopbackDelayMs: 1.25 };
  const measurementProfile = {
    ...profile,
    inputChannel: 1,
    loopbackDelayMs: 1.75,
    points: [
      { frequencyHz: 50, magnitudeDb: 3, phaseDeg: 15 },
      { frequencyHz: 1000, magnitudeDb: 6, phaseDeg: 40 },
      { frequencyHz: 10000, magnitudeDb: 8, phaseDeg: 50 },
    ],
  };
  const corrected = applyDifferentialChannelCalibration([{
    frequencyHz: 1000, magnitudeDb: 10, phaseDeg: 90, coherence: 0.97,
  }], referenceProfile, measurementProfile);
  assert.ok(corrected);
  assert.equal(corrected[0].magnitudeDb, 8);
  assert.equal(corrected[0].phaseDeg, 70);
  assert.equal(corrected[0].coherence, 0.97);
  assert.equal(correctDifferentialLoopbackDelayMs(5, referenceProfile, measurementProfile), 4.5);
});

test("rejects differential profiles from different interfaces or incomplete overlap", () => {
  const referenceProfile = { ...profile, inputChannel: 0 };
  const otherInterface = { ...profile, inputChannel: 1, deviceKey: "usb-interface-B" };
  assert.equal(applyDifferentialChannelCalibration([
    { frequencyHz: 1000, magnitudeDb: 1, phaseDeg: 0, coherence: 0.9 },
  ], referenceProfile, otherInterface), null);
  const narrowMeasurement = {
    ...profile,
    inputChannel: 1,
    points: [
      { frequencyHz: 1000, magnitudeDb: 0, phaseDeg: 0 },
      { frequencyHz: 5000, magnitudeDb: 0, phaseDeg: 0 },
      { frequencyHz: 10000, magnitudeDb: 0, phaseDeg: 0 },
    ],
  };
  assert.equal(applyDifferentialChannelCalibration([
    { frequencyHz: 500, magnitudeDb: 1, phaseDeg: 0, coherence: 0.9 },
  ], referenceProfile, narrowMeasurement), null);
});

test("differential calibration trims uncalibrated bins to the shared measured band", () => {
  const referenceProfile = { ...profile, inputChannel: 0 };
  const measurementProfile = {
    ...profile,
    inputChannel: 1,
    points: [
      { frequencyHz: 50, magnitudeDb: 2, phaseDeg: 5 },
      { frequencyHz: 1000, magnitudeDb: 3, phaseDeg: 10 },
      { frequencyHz: 5000, magnitudeDb: 4, phaseDeg: 20 },
      { frequencyHz: 10000, magnitudeDb: 5, phaseDeg: 30 },
    ],
  };
  const corrected = applyDifferentialChannelCalibration([
    { frequencyHz: 1000, magnitudeDb: 10, phaseDeg: 50, coherence: 0.95 },
    { frequencyHz: 12000, magnitudeDb: 11, phaseDeg: 60, coherence: 0.9 },
  ], referenceProfile, measurementProfile);
  assert.ok(corrected);
  assert.equal(corrected.length, 1);
  assert.equal(corrected[0].frequencyHz, 1000);
  assert.equal(corrected[0].magnitudeDb, 9);
  assert.equal(corrected[0].phaseDeg, 40);
});


test("requires two repeatable captures with matching profile identity", () => {
  const repeat = {
    ...profile,
    points: profile.points.map(point => ({
      ...point,
      magnitudeDb: point.magnitudeDb + 0.2,
      phaseDeg: point.phaseDeg + 2,
    })),
    loopbackDelayMs: profile.loopbackDelayMs + 0.05,
  };
  const measured = assessChannelCalibrationRepeatability(profile, repeat, { minComparedPoints: 3 });
  assert.ok(measured);
  assert.equal(measured.stable, true);
  assert.ok(measured.meanMagnitudeDeltaDb <= 0.75);
  assert.ok(measured.rmsPhaseDeltaDeg <= 10);
  assert.ok(measured.delayDeltaMs <= 0.15);

  const unstable = {
    ...repeat,
    loopbackDelayMs: profile.loopbackDelayMs + 0.5,
  };
  assert.equal(
    assessChannelCalibrationRepeatability(profile, unstable, { minComparedPoints: 3 })?.stable,
    false,
  );
  assert.equal(
    assessChannelCalibrationRepeatability(profile, { ...repeat, inputChannel: 0 }, { minComparedPoints: 3 }),
    null,
  );
});
