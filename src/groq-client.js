import { AppError } from "./errors.js";
import {
  SUMMARY_INSTRUCTIONS,
  SUMMARY_SCHEMA,
  buildSummaryInput,
} from "./prompt.js";

export class GroqClient {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  ensureConfigured() {
    if (!this.config.apiKey) {
      throw new AppError(
        "Groq is not configured. Add GROQ_API_KEY to your .env file.",
        503,
        "GROQ_NOT_CONFIGURED",
      );
    }
  }

  async transcribe({ buffer, filename, mimeType, context = "" }) {
    this.ensureConfigured();

    const form = new FormData();
    form.set(
      "file",
      new Blob([buffer], { type: mimeType || "application/octet-stream" }),
      filename,
    );
    form.set("model", this.config.transcriptionModel);
    form.set("response_format", "json");
    if (context) form.set("prompt", context);

    const result = await this.request("/audio/transcriptions", {
      method: "POST",
      body: form,
    });

    const transcript = typeof result.text === "string" ? result.text.trim() : "";
    if (!transcript) {
      throw new AppError(
        "The transcription service returned an empty transcript.",
        502,
        "EMPTY_TRANSCRIPT",
      );
    }
    return transcript;
  }

  async summarize({ transcript, meetingTitle = "" }) {
    this.ensureConfigured();

    const result = await this.request("/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.config.summaryModel,
        messages: [
          { role: "system", content: SUMMARY_INSTRUCTIONS },
          {
            role: "user",
            content: buildSummaryInput(transcript, meetingTitle),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meeting_summary",
            strict: true,
            schema: SUMMARY_SCHEMA,
          },
        },
      }),
    });

    const outputText = extractMessageContent(result);
    try {
      return JSON.parse(outputText);
    } catch (error) {
      throw new AppError(
        "The summary service returned an invalid result.",
        502,
        "INVALID_SUMMARY",
        { cause: error },
      );
    }
  }

  async request(path, options) {
    let response;
    try {
      response = await this.fetch(`${this.config.baseUrl}${path}`, {
        ...options,
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          ...options.headers,
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
      throw new AppError(
        timedOut
          ? "The AI service timed out. Please try a shorter recording."
          : "The AI service could not be reached. Please try again.",
        502,
        timedOut ? "AI_TIMEOUT" : "AI_UNAVAILABLE",
        { cause: error },
      );
    }

    const raw = await response.text();
    let payload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = {};
      }
    }

    if (!response.ok) {
      const upstreamMessage = payload?.error?.message;
      const message = response.status === 401
        ? "The Groq API key is invalid or expired."
        : response.status === 429
          ? "The Groq free-tier limit was reached. Please try again later."
          : upstreamMessage || "The AI service rejected the request.";
      throw new AppError(message, 502, "AI_REQUEST_FAILED");
    }

    return payload;
  }
}

export function extractMessageContent(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AppError(
      "The summary service returned no text.",
      502,
      "EMPTY_SUMMARY",
    );
  }
  return content;
}
