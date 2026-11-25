import test from "node:test";
import assert from "node:assert/strict";
import { cd48Rs232, isCd48Rs232Command } from "../src/audio/cd48Rs232.ts";

test("encodes global mute exactly as supplied in the vendor table", () => {
  const command = cd48Rs232.globalMute(true);
  assert.equal(command.command, "setnr 0 d0/data/d0/pros/gnOut0/arg/allMute true 0;");
  assert.equal(command.asciiHex.slice(0, 17), "73 65 74 6E 72 20 30 20");
  assert.equal(command.transport, "RS232");
  assert.equal(command.baudRate, 115200);
  assert.equal(command.requiresExplicitConfirmation, true);
  assert.equal(command.readbackSupportedBySuppliedTable, false);
});

test("uses zero-based channel indices while exposing one-based UI channels", () => {
  assert.equal(
    cd48Rs232.inputMute(1, false).command,
    "setnr 0 d0/data/d0/pros/gnIn0/arg/chns/0/mute false 0;",
  );
  assert.equal(
    cd48Rs232.inputGainStep(4, "down").command,
    "setnr 0 d0/data/d0/pros/gnIn0/arg/chns/3/incGain -1.00 0;",
  );
  assert.equal(
    cd48Rs232.outputMute(8, true).command,
    "setnr 0 d0/data/d0/pros/gnOut0/arg/chns/7/mute true 0;",
  );
  assert.equal(
    cd48Rs232.outputGainStep(1, "up").command,
    "setnr 0 d0/data/d0/pros/gnOut0/arg/chns/0/incGain 1.00 0;",
  );
});

test("maps scene labels 1-8 to vendor zero-based scene IDs", () => {
  assert.equal(
    cd48Rs232.recallScene(1).command,
    "setnr 0 m/dev/arg/autoFiles/scene/curId 0 0;",
  );
  assert.equal(
    cd48Rs232.recallScene(8).command,
    "setnr 0 m/dev/arg/autoFiles/scene/curId 7 0;",
  );
});

test("supports all four documented input and output group command families", () => {
  assert.equal(
    cd48Rs232.inputGroupMute(4, true).command,
    "setnr 0 d0/data/d0/pros/gnIn0/arg/groups/3/mute true 0;",
  );
  assert.equal(
    cd48Rs232.inputGroupVolumeStep(2, "down").command,
    "setnr 0 d0/data/d0/pros/gnIn0/arg/groups/1/incPercent -1 0;",
  );
  assert.equal(
    cd48Rs232.outputGroupMute(3, false).command,
    "setnr 0 d0/data/d0/pros/gnOut0/arg/groups/2/mute false 0;",
  );
  assert.equal(
    cd48Rs232.outputGroupVolumeStep(1, "up").command,
    "setnr 0 d0/data/d0/pros/gnOut0/arg/groups/0/incPercent 1 0;",
  );
});

test("rejects channel, group and scene indices outside documented ranges", () => {
  assert.throws(() => cd48Rs232.inputMute(0, true), RangeError);
  assert.throws(() => cd48Rs232.inputMute(5, true), RangeError);
  assert.throws(() => cd48Rs232.outputMute(9, true), RangeError);
  assert.throws(() => cd48Rs232.inputGroupMute(5, true), RangeError);
  assert.throws(() => cd48Rs232.outputGroupVolumeStep(-1, "up"), RangeError);
  assert.throws(() => cd48Rs232.recallScene(9), RangeError);
});

test("validator rejects arbitrary or modified command objects", () => {
  const valid = cd48Rs232.outputMute(2, true);
  assert.equal(isCd48Rs232Command(valid), true);
  assert.equal(isCd48Rs232Command({ ...valid, command: "DROP TABLE;" }), false);
  assert.equal(isCd48Rs232Command({ ...valid, asciiHex: "00" }), false);
  assert.equal(isCd48Rs232Command(null), false);
});
