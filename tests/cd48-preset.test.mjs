import test from "node:test";
import assert from "node:assert/strict";
import { createCD48PresetDraft, validateCD48PresetDraft } from "../src/audio/cd48Preset.ts";

test("creates an empty-safe 4 input by 8 output draft with 11 PEQ slots per channel", () => {
  const draft = createCD48PresetDraft();
  assert.equal(draft.inputs.length, 4);
  assert.equal(draft.outputs.length, 8);
  assert.equal(draft.matrix.length, 4);
  assert.ok(draft.matrix.every((row) => row.length === 8 && row.every((route) => route === false)));
  assert.ok([...draft.inputs, ...draft.outputs].every((channel) => channel.peq.length === 11));
  assert.deepEqual(validateCD48PresetDraft(draft), []);
});

test("accepts delay up to 2000 ms and rejects values outside the documented range", () => {
  const draft = createCD48PresetDraft();
  draft.outputs[0].delayMs = 2000;
  assert.deepEqual(validateCD48PresetDraft(draft), []);
  draft.outputs[0].delayMs = 2000.01;
  assert.ok(validateCD48PresetDraft(draft).some((issue) => issue.path === "OUT1.delayMs"));
});

test("rejects invalid scene slots, matrix dimensions and malformed IP", () => {
  const draft = createCD48PresetDraft();
  draft.sceneSlot = 129;
  draft.matrix = [[true]];
  draft.deviceIp = "192.168.20.999";
  const paths = validateCD48PresetDraft(draft).map((issue) => issue.path);
  assert.ok(paths.includes("sceneSlot"));
  assert.ok(paths.includes("matrix"));
  assert.ok(paths.includes("deviceIp"));
});

test("rejects invalid PEQ values and any attempt to enable hardware writes", () => {
  const draft = createCD48PresetDraft();
  draft.inputs[0].peq[0] = { frequencyHz: 30000, gainDb: Number.NaN, q: 0 };
  draft.hardwareWriteEnabled = true;
  const paths = validateCD48PresetDraft(draft).map((issue) => issue.path);
  assert.ok(paths.includes("IN1.peq[0].frequencyHz"));
  assert.ok(paths.includes("IN1.peq[0].gainDb"));
  assert.ok(paths.includes("IN1.peq[0].q"));
  assert.ok(paths.includes("hardwareWriteEnabled"));
});
