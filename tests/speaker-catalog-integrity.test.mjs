import test from "node:test";
import assert from "node:assert/strict";
import { SPEAKER_MODELS, SPEAKER_SPECS } from "../src/data/speakerModels.ts";

test("every published speaker specification has a source and source note", () => {
  for (const [key, spec] of Object.entries(SPEAKER_SPECS)) {
    assert.ok(SPEAKER_MODELS.includes(key), `catalog selector is missing ${key}`);
    assert.match(spec.source, /^https:\/\//, `${key} must cite HTTPS source`);
    assert.ok(spec.sourceNote.trim().length >= 20, `${key} needs a provenance note`);
    assert.ok(spec.manufacturer.trim().length > 0);
    assert.ok(spec.model.trim().length > 0);
  }
});

test("numeric speaker specifications are finite and physically bounded", () => {
  for (const [key, spec] of Object.entries(SPEAKER_SPECS)) {
    for (const field of ["horizontalDeg", "verticalDeg"]) {
      const value = spec[field];
      if (value !== null) {
        assert.ok(Number.isFinite(value) && value > 0 && value <= 360, `${key} ${field}`);
      }
    }
    for (const field of ["sensitivityDb1W1m", "powerLongTermW", "impedanceOhm"]) {
      const value = spec[field];
      if (value !== null) {
        assert.ok(Number.isFinite(value) && value > 0, `${key} ${field}`);
      }
    }
    for (const coverage of spec.coverageByFrequency ?? []) {
      assert.ok(Number.isFinite(coverage.frequencyHz) && coverage.frequencyHz > 0, `${key} coverage frequency`);
      for (const angle of [coverage.horizontalDeg, coverage.verticalDeg]) {
        if (angle !== null) assert.ok(Number.isFinite(angle) && angle > 0 && angle <= 360);
      }
    }
  }
});

test("models with unverified revisions remain selectable but have no invented specification", () => {
  for (const model of [
    "Bose 402 V (verify revision)",
    "Bose 802 V (verify revision)",
    "Bose 502 (verify revision)",
    "Column 600",
    "Column 800",
  ]) {
    assert.ok(SPEAKER_MODELS.includes(model));
    assert.equal(Object.hasOwn(SPEAKER_SPECS, model), false);
  }
});

test("catalog does not silently replace missing measurements with numeric zero", () => {
  for (const spec of Object.values(SPEAKER_SPECS)) {
    assert.notEqual(spec.horizontalDeg, 0);
    assert.notEqual(spec.verticalDeg, 0);
    assert.notEqual(spec.sensitivityDb1W1m, 0);
    assert.notEqual(spec.powerLongTermW, 0);
    assert.notEqual(spec.impedanceOhm, 0);
  }
});
