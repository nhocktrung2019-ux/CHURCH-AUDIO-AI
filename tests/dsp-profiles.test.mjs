import test from "node:test";
import assert from "node:assert/strict";
import { dspProfiles, getDspProfile } from "../src/data/dspProfiles.ts";

test("DSP library contains requested model families as separate capability profiles", () => {
  const ids = dspProfiles.map(profile => profile.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    "behringer-x32-midas-m32",
    "soundcraft-ui",
    "soundcraft-si-vi",
    "dbx-driverack-pa2",
    "dbx-driverack-venu360",
    "dbx-driverack-4800-4820",
    "db-acoustics-cd48",
  ]) {
    assert.ok(getDspProfile(id), "missing DSP profile: " + id);
  }
});

test("DSP profiles never claim direct hardware write support without an adapter", () => {
  for (const profile of dspProfiles) {
    assert.equal(profile.controlStatus, "manual-only");
    assert.ok(profile.models.length > 0);
    assert.ok(profile.transport.length > 0);
    assert.ok(profile.validationNeeded.length > 0);
    assert.match(profile.documentationUrl, /^https:\/\//);
  }
});

test("X32/M32 community protocol evidence is distinguished from manufacturer evidence", () => {
  const x32 = getDspProfile("behringer-x32-midas-m32");
  const ui = getDspProfile("soundcraft-ui");
  assert.equal(x32.evidenceGrade, "community-protocol-reference");
  assert.equal(ui.evidenceGrade, "manufacturer-documentation");
});

test("CD48 Ethernet profile evidence is attributed to user-supplied hardware images", () => {
  const cd48 = getDspProfile("db-acoustics-cd48");
  assert.equal(cd48.evidenceGrade, "user-supplied-image");
  assert.match(cd48.transport, /RJ45 100M Ethernet/);
  assert.match(cd48.transport, /192\.168\.20\.20/);
});
