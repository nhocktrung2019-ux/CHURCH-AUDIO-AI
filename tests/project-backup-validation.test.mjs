import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProjectBackup,
  createProjectBackupChecksum,
  verifyProjectBackupChecksum,
  PROJECT_BACKUP_MAX_ENTRIES,
  PROJECT_BACKUP_MAX_BYTES,
} from "../src/audio/projectBackupValidation.ts";

const data = {
  "church-audio-room-length": "28",
  "church-audio-room-speakers": "[]",
};

// Keep the supplied entries in the fixture. Previously this returned the
// outer default data object, causing invalid-input tests to validate good data.
const legacy = (entries = data) => ({
  format: "Church Audio Project",
  schemaVersion: 1,
  exportedAt: "2026-11-19T05:00:00.000Z",
  data: entries,
});

test("accepts v1 legacy backup and marks it unverified", () => {
  const result = validateProjectBackup(legacy());
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.integrity, "legacy-unverified");
    assert.equal(result.entries.length, 2);
  }
});

test("SHA-256 is deterministic regardless of object insertion order", async () => {
  const first = await createProjectBackupChecksum(data);
  const second = await createProjectBackupChecksum({
    "church-audio-room-speakers": "[]",
    "church-audio-room-length": "28",
  });
  assert.equal(first, second);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);
});

test("v2 import passes only when complete data checksum matches", async () => {
  const payload = {
    format: "Church Audio Project",
    schemaVersion: 2,
    exportedAt: "2026-11-19T05:00:00.000Z",
    data,
    checksum: await createProjectBackupChecksum(data),
  };
  assert.equal(validateProjectBackup(payload).valid, true);
  assert.equal(await verifyProjectBackupChecksum(payload), true);
  assert.equal(
    await verifyProjectBackupChecksum({
      ...payload,
      data: { ...data, "church-audio-room-length": "30" },
    }),
    false,
  );
});

test("rejects missing or malformed v2 checksum", () => {
  assert.equal(
    validateProjectBackup({ format: "Church Audio Project", schemaVersion: 2, data }).valid,
    false,
  );
  assert.equal(
    validateProjectBackup({
      format: "Church Audio Project",
      schemaVersion: 2,
      data,
      checksum: "sha256:bad",
    }).valid,
    false,
  );
});

test("rejects wrong format, schema, malformed timestamp, foreign keys and non-string values", () => {
  assert.equal(validateProjectBackup({ ...legacy(), format: "other" }).valid, false);
  assert.equal(validateProjectBackup({ ...legacy(), schemaVersion: 3 }).valid, false);
  assert.equal(validateProjectBackup({ ...legacy(), exportedAt: "not-a-date" }).valid, false);
  assert.equal(validateProjectBackup(legacy({ "unrelated-key": "x" })).valid, false);
  assert.equal(
    validateProjectBackup(legacy({ "church-audio-room-length": 28 })).valid,
    false,
  );
});

test("rejects empty, oversized entry count and oversized payload", () => {
  assert.equal(validateProjectBackup(legacy({})).valid, false);

  const manyEntries = Object.fromEntries(
    Array.from({ length: PROJECT_BACKUP_MAX_ENTRIES + 1 }, (_, index) => [
      `church-audio-${index}`,
      "x",
    ]),
  );
  assert.equal(validateProjectBackup(legacy(manyEntries)).valid, false);

  const oversizedValue = "x".repeat(PROJECT_BACKUP_MAX_BYTES + 1);
  assert.equal(
    validateProjectBackup(legacy({ "church-audio-large": oversizedValue })).valid,
    false,
  );
});

test("rejects arrays and primitive payloads", () => {
  assert.equal(validateProjectBackup([]).valid, false);
  assert.equal(validateProjectBackup(null).valid, false);
});
