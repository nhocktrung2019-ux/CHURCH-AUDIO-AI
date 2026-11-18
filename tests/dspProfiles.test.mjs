import test from "node:test";
import assert from "node:assert/strict";
import { dspProfiles, getDspProfile } from "../src/data/dspProfiles.ts";
test("the requested mixer and DSP families are represented", () => {
  const names = dspProfiles.map((profile) => profile.name);
  assert.ok(names.some((name) => name.includes("X32")));
  assert.ok(names.some((name) => name.includes("Soundcraft")));
  assert.ok(names.some((name) => name.includes("DriveRack")));
  assert.ok(names.some((name) => name.includes("CD48")));
});
test("no DSP profile is exposed as connected or write-enabled without a validated adapter", () => {
  assert.ok(dspProfiles.length >= 4);
  assert.ok(dspProfiles.every((profile) => profile.controlStatus === "manual-only"));
  assert.equal(getDspProfile("missing-model"), undefined);
});

test("named mixer and DSP models are individually selectable in the catalogue", () => {
  const models = dspProfiles.flatMap((profile) => profile.models);
  for (const model of [
    "X32 Compact",
    "M32R Live",
    "WING",
    "XR18",
    "HD96-24-CC-IP",
    "DM7",
    "DM3",
    "CL5",
    "QL5",
    "TF-RACK",
    "DME7",
    "MRX7-D",
    "Ui24R",
    "Si Expression 3",
    "Vi7000",
    "DriveRack 260",
    "DriveRack 4820",
  ]) {
    assert.ok(models.includes(model), `missing model profile: ${model}`);
  }
  assert.equal(new Set(dspProfiles.map((profile) => profile.id)).size, dspProfiles.length);
  assert.ok(dspProfiles.every((profile) => profile.controlStatus === "manual-only"));
});
