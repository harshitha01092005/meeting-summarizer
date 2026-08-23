import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getConfig, loadEnvFile } from "../src/config.js";

test("getConfig applies defaults and validates numeric settings", () => {
  const config = getConfig({});
  assert.equal(config.port, 3000);
  assert.equal(config.groq.baseUrl, "https://api.groq.com/openai/v1");
  assert.equal(config.groq.transcriptionModel, "whisper-large-v3-turbo");
  assert.equal(config.groq.summaryModel, "openai/gpt-oss-20b");
  assert.equal(
    getConfig({ GROQ_API_KEY: "replace_with_your_api_key" }).groq.apiKey,
    "",
  );
  assert.throws(() => getConfig({ PORT: "zero" }), /PORT must be a positive integer/);
});

test("loadEnvFile loads values without replacing existing environment values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "meeting-config-"));
  const path = join(directory, ".env");
  const original = process.env.TEST_MEETING_ENV;
  const originalExisting = process.env.TEST_MEETING_EXISTING;
  try {
    await writeFile(path, "TEST_MEETING_ENV='loaded'\nTEST_MEETING_EXISTING=new\n");
    process.env.TEST_MEETING_EXISTING = "keep";
    loadEnvFile(path);
    assert.equal(process.env.TEST_MEETING_ENV, "loaded");
    assert.equal(process.env.TEST_MEETING_EXISTING, "keep");
  } finally {
    if (original === undefined) delete process.env.TEST_MEETING_ENV;
    else process.env.TEST_MEETING_ENV = original;
    if (originalExisting === undefined) delete process.env.TEST_MEETING_EXISTING;
    else process.env.TEST_MEETING_EXISTING = originalExisting;
    await rm(directory, { recursive: true });
  }
});
