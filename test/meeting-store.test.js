import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MeetingStore } from "../src/meeting-store.js";

test("MeetingStore persists concurrent writes and returns newest first", async () => {
  const directory = await mkdtemp(join(tmpdir(), "meeting-store-"));
  try {
    const store = new MeetingStore(join(directory, "meetings.json"));
    await Promise.all([
      store.save({ id: "first", createdAt: "2026-01-01T00:00:00.000Z" }),
      store.save({ id: "second", createdAt: "2026-01-02T00:00:00.000Z" }),
    ]);
    assert.deepEqual((await store.list()).map(({ id }) => id), ["second", "first"]);
    assert.equal((await store.get("first")).id, "first");
    assert.equal(await store.get("missing"), null);
  } finally {
    await rm(directory, { recursive: true });
  }
});
