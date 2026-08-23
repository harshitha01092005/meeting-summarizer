import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { getConfig, loadEnvFile } from "./config.js";
import { MeetingService } from "./meeting-service.js";
import { MeetingStore } from "./meeting-store.js";
import { GroqClient } from "./groq-client.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadEnvFile(resolve(projectRoot, ".env"));

const config = getConfig();
const store = new MeetingStore(resolve(projectRoot, "data", "meetings.json"));
const aiClient = new GroqClient(config.groq);
const meetingService = new MeetingService({ aiClient, store });
const app = createApp({
  config,
  meetingService,
  store,
  publicDir: resolve(projectRoot, "public"),
});

const server = createServer(app);
server.requestTimeout = config.groq.timeoutMs + 10_000;
server.headersTimeout = 15_000;
server.listen(config.port, config.host, () => {
  console.log(`Meeting Summarizer is running at http://${config.host}:${config.port}`);
  if (!config.groq.apiKey) {
    console.warn("GROQ_API_KEY is not configured; uploads will remain disabled.");
  }
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
