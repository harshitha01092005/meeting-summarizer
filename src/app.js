import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { cleanText, validateAudioFile } from "./audio.js";
import { AppError, publicError } from "./errors.js";

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

export function createApp({ config, meetingService, store, publicDir, logger = console }) {
  return async function handler(request, response) {
    const startedAt = Date.now();
    const requestId = randomUUID();
    response.setHeader("x-request-id", requestId);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.setHeader(name, value);
    }

    let status = 500;
    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/api/health") {
        status = sendJson(response, 200, {
          status: "ok",
          aiConfigured: Boolean(config.groq.apiKey),
        });
      } else if (request.method === "GET" && url.pathname === "/api/meetings") {
        status = sendJson(response, 200, { meetings: await store.list() });
      } else if (
        request.method === "GET" &&
        /^\/api\/meetings\/[0-9a-f-]+$/i.test(url.pathname)
      ) {
        const id = url.pathname.slice("/api/meetings/".length);
        const meeting = await store.get(id);
        if (!meeting) throw new AppError("Meeting not found.", 404, "NOT_FOUND");
        status = sendJson(response, 200, { meeting });
      } else if (request.method === "POST" && url.pathname === "/api/meetings") {
        status = await handleCreateMeeting(request, response, config, meetingService);
      } else if (request.method === "GET" || request.method === "HEAD") {
        status = await serveStatic(request, response, url.pathname, publicDir);
      } else {
        throw new AppError("Route not found.", 404, "NOT_FOUND");
      }
    } catch (error) {
      const result = publicError(error);
      status = sendJson(response, result.status, result.body);
      logger.error(JSON.stringify({
        event: "request_error",
        requestId,
        method: request.method,
        path: request.url,
        code: error.code || "INTERNAL_ERROR",
        message: error.message,
      }));
    } finally {
      logger.info(JSON.stringify({
        event: "request_complete",
        requestId,
        method: request.method,
        path: request.url,
        status,
        durationMs: Date.now() - startedAt,
      }));
    }
  };
}

async function handleCreateMeeting(request, response, config, meetingService) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new AppError(
      "Upload the meeting as multipart form data.",
      415,
      "INVALID_CONTENT_TYPE",
    );
  }

  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > config.maxAudioBytes + 64 * 1024) {
    throw new AppError("The upload is too large.", 413, "AUDIO_TOO_LARGE");
  }

  const body = await readBody(request, config.maxAudioBytes + 64 * 1024);
  const webRequest = new Request("http://localhost/api/meetings", {
    method: "POST",
    headers: request.headers,
    body,
  });

  let form;
  try {
    form = await webRequest.formData();
  } catch (error) {
    throw new AppError("The upload form is invalid.", 400, "INVALID_FORM", {
      cause: error,
    });
  }

  const audio = validateAudioFile(form.get("audio"), config.maxAudioBytes);
  const title = cleanText(form.get("title"), {
    name: "Meeting title",
    maxLength: 100,
  });
  const context = cleanText(form.get("context"), {
    name: "Names and vocabulary",
    maxLength: 500,
  });

  const meeting = await meetingService.process({ audio, title, context });
  return sendJson(response, 201, { meeting });
}

async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      throw new AppError("The upload is too large.", 413, "AUDIO_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function serveStatic(request, response, pathname, publicDir) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new AppError("Route not found.", 404, "NOT_FOUND");
  }

  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const root = resolve(publicDir);
  const filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    throw new AppError("Route not found.", 404, "NOT_FOUND");
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") throw new AppError("Route not found.", 404, "NOT_FOUND");
    throw error;
  }
  if (!fileStat.isFile()) throw new AppError("Route not found.", 404, "NOT_FOUND");

  response.statusCode = 200;
  response.setHeader("content-type", CONTENT_TYPES[extname(filePath)] || "application/octet-stream");
  response.setHeader("content-length", fileStat.size);
  response.setHeader("cache-control", "no-cache");
  if (request.method === "HEAD") {
    response.end();
  } else {
    createReadStream(filePath).pipe(response);
  }
  return 200;
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("content-length", Buffer.byteLength(payload));
  response.end(payload);
  return status;
}
