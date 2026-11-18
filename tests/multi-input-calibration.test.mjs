import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInputMicCalibration,
  normalizeMultiInputCalibrationRegistry,
  removeInputCalibration,
  setInputCalibration,
} from "../src/audio/multiInputCalibration.ts";

const profileA = {
  name: "Mic A.csv",
  points: [
    { frequencyHz: 50, correctionDb: 1 },
    { frequencyHz: 1000, correctionDb: 2 },
    { frequencyHz: 10000, correctionDb: 3 },
  ],
};
const profileB = {
  name: "Mic B.csv",
  points: [
    { frequencyHz: 50, correctionDb: -1 },
    { frequencyHz: 1000, correctionDb: -2 },
    { frequencyHz: 10000, correctionDb: -3 },
  ],
};

test("calibration profiles remain independent for each input device", () => {
  const first = setInputCalibration({}, "usb-mic-a", profileA);
  const both = setInputCalibration(first, "usb-mic-b", profileB);
  assert.equal(both["usb-mic-a"].name, "Mic A.csv");
  assert.equal(both["usb-mic-b"].name, "Mic B.csv");
  assert.equal(first["usb-mic-b"], undefined);
  assert.equal(both["usb-mic-a"].points[1].correctionDb, 2);
  assert.equal(both["usb-mic-b"].points[1].correctionDb, -2);
});

test("removing one input calibration keeps other input profiles", () => {
  const both = setInputCalibration(setInputCalibration({}, "a", profileA), "b", profileB);
  const next = removeInputCalibration(both, "a");
  assert.equal(next.a, undefined);
  assert.equal(next.b.name, "Mic B.csv");
  assert.equal(both.a.name, "Mic A.csv");
});

test("persisted calibration registry rejects malformed and incomplete profiles", () => {
  const restored = normalizeMultiInputCalibrationRegistry({
    valid: profileA,
    incomplete: { name: "short.csv", points: [{ frequencyHz: 100, correctionDb: 0 }] },
    malformed: { name: "", points: profileA.points },
    invalid: null,
  });
  assert.deepEqual(Object.keys(restored), ["valid"]);
  assert.equal(restored.valid.points.length, 3);
});

test("RTA correction is applied at the log-band center inside calibration range", () => {
  const corrected = applyInputMicCalibration([0], profileA.points, 1000, 1000);
  assert.equal(corrected[0], 2);
});

test("RTA correction does not extrapolate outside microphone calibration range", () => {
  const below = applyInputMicCalibration([0], profileA.points, 20, 20);
  const above = applyInputMicCalibration([0], profileA.points, 20000, 20000);
  assert.equal(below[0], 0);
  assert.equal(above[0], 0);
});

test("invalid ranges and empty profiles leave raw RTA values unchanged", () => {
  assert.deepEqual(applyInputMicCalibration([-30], profileA.points, 0, 20000), [-30]);
  assert.deepEqual(applyInputMicCalibration([-30], [], 20, 20000), [-30]);
});
