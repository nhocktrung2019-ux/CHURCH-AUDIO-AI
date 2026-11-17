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
