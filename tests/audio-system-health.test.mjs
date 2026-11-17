import test from "node:test";
import assert from "node:assert/strict";
import { assessAudioSystem } from "../src/audio/audioSystemHealth.ts";

const healthySnapshot = {
  secureContext: true,
  mediaDevicesAvailable: true,
  microphoneCaptureAvailable: true,
  audioContextAvailable: true,
  audioWorkletAvailable: true,
  outputSelectionAvailable: true,
  speechRecognitionAvailable: true,
  microphonePermission: "granted",
  inputCount: 2,
  outputCount: 1,
  online: true,
};

test("marks a fully available API environment as ready without claiming hardware validation", () => {
  const result = assessAudioSystem(healthySnapshot);
  assert.equal(result.overall, "ready");
  assert.equal(result.measurementGate, "available");
  assert.equal(result.synchronousCaptureGate, "hardware-verification-required");
});

test("requires a user permission request when microphone permission is prompt or unknown", () => {
  const prompt = assessAudioSystem({ ...healthySnapshot, microphonePermission: "prompt" });
  const unknown = assessAudioSystem({ ...healthySnapshot, microphonePermission: "unknown" });
  assert.equal(prompt.measurementGate, "permission-required");
  assert.equal(unknown.measurementGate, "permission-required");
});

test("blocks measurement when secure context or microphone permission is unavailable", () => {
  const insecure = assessAudioSystem({ ...healthySnapshot, secureContext: false });
  const denied = assessAudioSystem({ ...healthySnapshot, microphonePermission: "denied" });
  assert.equal(insecure.measurementGate, "blocked");
  assert.equal(denied.measurementGate, "blocked");
  assert.equal(denied.overall, "blocked");
});

test("marks optional capabilities and missing enumerated devices as warnings", () => {
  const result = assessAudioSystem({
    ...healthySnapshot,
    audioWorkletAvailable: false,
    outputSelectionAvailable: false,
    speechRecognitionAvailable: false,
    inputCount: 0,
    outputCount: null,
    online: false,
  });
  assert.equal(result.overall, "warning");
  assert.equal(result.synchronousCaptureGate, "worklet-unavailable");
  assert.equal(result.measurementGate, "available");
});

test("blocks when required browser audio APIs are missing", () => {
  const result = assessAudioSystem({
    ...healthySnapshot,
    mediaDevicesAvailable: false,
    microphoneCaptureAvailable: false,
    audioContextAvailable: false,
  });
  assert.equal(result.overall, "blocked");
  assert.equal(result.measurementGate, "blocked");
});
