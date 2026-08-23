import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";

const silentLogger = { info() {}, error() {} };

async function withServer(overrides, run) {
  const meetings = [];
  const store = overrides.store || {
    async list() { return meetings; },
    async get(id) { return meetings.find((meeting) => meeting.id === id) || null; },
  };
  const config = {
    maxAudioBytes: 100,
    groq: { apiKey: "configured" },
    ...overrides.config,
  };
  const meetingService = overrides.meetingService || {
    async process({ audio, title }) {
      const meeting = sampleMeeting({ filename: audio.name, title: title || "Generated title" });
      meetings.push(meeting);
      return meeting;
    },
  };
  const server = createServer(createApp({
    config,
    meetingService,
    store,
    publicDir: resolve("public"),
    logger: silentLogger,
  }));
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

test("health and static routes respond with security headers", async () => {
  await withServer({}, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.deepEqual(await health.json(), { status: "ok", aiConfigured: true });
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");

    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /MinuteMind/);

    const missing = await fetch(`${baseUrl}/missing`);
    assert.equal(missing.status, 404);
  });
});

test("meeting upload validates the file and returns a processed meeting", async () => {
  await withServer({}, async (baseUrl) => {
    const invalid = new FormData();
    invalid.set("audio", new File(["x"], "notes.txt", { type: "text/plain" }));
    const invalidResponse = await fetch(`${baseUrl}/api/meetings`, {
      method: "POST",
      body: invalid,
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal((await invalidResponse.json()).code, "UNSUPPORTED_AUDIO");

    const valid = new FormData();
    valid.set("title", "Design sync");
    valid.set("audio", new File(["audio"], "sync.wav", { type: "audio/wav" }));
    const response = await fetch(`${baseUrl}/api/meetings`, {
      method: "POST",
      body: valid,
    });
    assert.equal(response.status, 201);
    const { meeting } = await response.json();
    assert.equal(meeting.title, "Design sync");
    assert.equal(meeting.source.filename, "sync.wav");
  });
});

test("meeting upload rejects the wrong content type", async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/meetings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 415);
    assert.equal((await response.json()).code, "INVALID_CONTENT_TYPE");
  });
});

function sampleMeeting({ filename, title }) {
  return {
    id: "28c08e80-9648-45c3-83ea-064fbd5f3f25",
    createdAt: "2026-08-21T10:00:00.000Z",
    source: { filename, mimeType: "audio/wav", sizeBytes: 5 },
    title,
    transcript: "The team approved the design.",
    summary: {
      title,
      overview: "The design was approved.",
      keyDecisions: ["Approve the design"],
      actionItems: [],
      openQuestions: [],
    },
    processingTimeMs: 20,
  };
}
