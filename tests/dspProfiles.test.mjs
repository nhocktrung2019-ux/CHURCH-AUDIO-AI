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

test("catalog separates mixer and processor models for model-level selection", () => {
  const byId = Object.fromEntries(dspProfiles.map((profile) => [profile.id, profile]));
  assert.equal(byId["yamaha-tf-series"].category, "mixer");
  assert.deepEqual(byId["yamaha-tf-series"].models, ["TF5", "TF3", "TF1", "TF-RACK"]);
  assert.ok(byId["yamaha-dm3-series"].models.includes("DM3S"));
  assert.ok(byId["yamaha-cl-ql-series"].models.includes("CL5"));
  assert.ok(byId["soundcraft-si-vi"].models.includes("Vi7000"));
  assert.ok(byId["dbx-driverack-260"].models.includes("DriveRack 260"));
  assert.ok(byId["dbx-driverack-legacy"].models.includes("DriveRack PA+"));
  assert.ok(byId["db-acoustics-cd48"].models.includes("CD48 Premium"));
  assert.ok(dspProfiles.every((profile) => profile.category === "mixer" || profile.category === "processor"));
});
