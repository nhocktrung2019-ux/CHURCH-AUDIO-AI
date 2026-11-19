import test from "node:test";
import assert from "node:assert/strict";
import { validateProjectBackup, PROJECT_BACKUP_MAX_ENTRIES, PROJECT_BACKUP_MAX_BYTES } from "../src/audio/projectBackupValidation.ts";

const valid = (data = { "church-audio-room-length": "28", "church-audio-room-speakers": "[]" }) => ({
  format: "Church Audio Project", schemaVersion: 1, exportedAt: "2026-11-19T05:00:00.000Z", data,
});

test("accepts a valid project backup and reports its size", () => {
  const result = validateProjectBackup(valid());
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.entries.length, 2);
    assert.ok(result.totalBytes > 0);
  }
});

test("rejects wrong format, schema, and malformed timestamp", () => {
  assert.equal(validateProjectBackup({ ...valid(), format: "other" }).valid, false);
  assert.equal(validateProjectBackup({ ...valid(), schemaVersion: 2 }).valid, false);
  assert.equal(validateProjectBackup({ ...valid(), exportedAt: "not-a-date" }).valid, false);
});

test("rejects foreign keys and non-string values instead of silently skipping them", () => {
  assert.equal(validateProjectBackup(valid({ "unrelated-key": "x" })).valid, false);
  assert.equal(validateProjectBackup(valid({ "church-audio-room-length": 28 })).valid, false);
});

test("rejects empty, oversized entry count, and oversized payload", () => {
  assert.equal(validateProjectBackup(valid({})).valid, false);
  const many = Object.fromEntries(Array.from({ length: PROJECT_BACKUP_MAX_ENTRIES + 1 }, (_, i) => [`church-audio-${i}`, "x"]));
  assert.equal(validateProjectBackup(valid(many)).valid, false);
  const large = "x".repeat(PROJECT_BACKUP_MAX_BYTES + 1);
  assert.equal(validateProjectBackup(valid({ "church-audio-large": large })).valid, false);
});

test("rejects arrays and primitive payloads", () => {
  assert.equal(validateProjectBackup([]).valid, false);
  assert.equal(validateProjectBackup(null).valid, false);
});
