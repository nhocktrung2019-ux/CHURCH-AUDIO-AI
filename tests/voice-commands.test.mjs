import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVoiceCommand, parseVoiceCommand, describeVoiceIntent } from "../src/audio/voiceCommands.ts";

test("normalizes Vietnamese text without losing command meaning", () => {
  assert.equal(normalizeVoiceCommand("Bắt đầu đo MICRO!"), "bat dau do micro");
});

test("routes Vietnamese navigation commands to the correct workspace", () => {
  assert.deepEqual(parseVoiceCommand("Mở RTA"), { type: "navigate", tab: "rta" });
  assert.deepEqual(parseVoiceCommand("Đo tiếng vang RT60"), { type: "navigate", tab: "room" });
  assert.deepEqual(parseVoiceCommand("Mở chống hú"), { type: "navigate", tab: "system" });
  assert.deepEqual(parseVoiceCommand("Thiết kế phủ âm 3D"), { type: "navigate", tab: "design" });
  assert.deepEqual(parseVoiceCommand("Mở DSP X32"), { type: "navigate", tab: "dsp" });
  assert.deepEqual(parseVoiceCommand("Hỗ trợ kỹ thuật"), { type: "navigate", tab: "support" });
});

test("starts and stops measurement with Vietnamese commands", () => {
  assert.deepEqual(parseVoiceCommand("Bắt đầu đo microphone"), { type: "measurement-start" });
  assert.deepEqual(parseVoiceCommand("Dừng đo"), { type: "measurement-stop" });
});

test("parses RTA frequency in Hz and kHz with bounds", () => {
  assert.deepEqual(parseVoiceCommand("Chọn tần số 1000 Hz"), { type: "rta-frequency", frequencyHz: 1000 });
  assert.deepEqual(parseVoiceCommand("Chọn 1,5 kHz"), { type: "rta-frequency", frequencyHz: 1500 });
  assert.deepEqual(parseVoiceCommand("20 kHz"), { type: "rta-frequency", frequencyHz: 20000 });
  assert.deepEqual(parseVoiceCommand("Chọn tần số 21 kHz"), { type: "unknown" });
  assert.deepEqual(parseVoiceCommand("Chọn tần số 10 Hz"), { type: "unknown" });
});

test("help and unknown command responses are safe and descriptive", () => {
  assert.deepEqual(parseVoiceCommand("Trợ giúp"), { type: "help" });
  assert.deepEqual(parseVoiceCommand("mở tab kỳ lạ"), { type: "unknown" });
  assert.match(describeVoiceIntent({ type: "help" }), /bắt đầu đo/);
});
