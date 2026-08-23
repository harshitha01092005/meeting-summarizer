import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export function loadEnvFile(filePath = resolve(".env")) {
  let contents;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export function getConfig(env = process.env) {
  const suppliedApiKey = env.GROQ_API_KEY || "";
  return {
    host: env.HOST || "127.0.0.1",
    port: positiveInteger(env.PORT, 3000, "PORT"),
    maxAudioBytes: positiveInteger(
      env.MAX_AUDIO_BYTES,
      DEFAULT_MAX_AUDIO_BYTES,
      "MAX_AUDIO_BYTES",
    ),
    groq: {
      apiKey: suppliedApiKey === "replace_with_your_api_key" ? "" : suppliedApiKey,
      baseUrl: env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      transcriptionModel:
        env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
      summaryModel: env.GROQ_SUMMARY_MODEL || "openai/gpt-oss-20b",
      timeoutMs: positiveInteger(env.GROQ_TIMEOUT_MS, 120_000, "GROQ_TIMEOUT_MS"),
    },
  };
}

export { DEFAULT_MAX_AUDIO_BYTES };
