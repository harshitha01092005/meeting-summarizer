import { extname } from "node:path";
import { AppError } from "./errors.js";

const ALLOWED_EXTENSIONS = new Set([
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".oga",
  ".ogg",
  ".wav",
  ".webm",
]);

export function validateAudioFile(file, maxAudioBytes) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new AppError("Choose a meeting audio file.", 400, "AUDIO_REQUIRED");
  }

  if (!file.name || !ALLOWED_EXTENSIONS.has(extname(file.name).toLowerCase())) {
    throw new AppError(
      "Unsupported audio format. Use MP3, MP4, M4A, WAV, WEBM, MPEG, MPGA, OGG, or FLAC.",
      400,
      "UNSUPPORTED_AUDIO",
    );
  }

  if (file.size <= 0) {
    throw new AppError("The selected audio file is empty.", 400, "EMPTY_AUDIO");
  }

  if (file.size > maxAudioBytes) {
    throw new AppError(
      `The audio file exceeds the ${formatMegabytes(maxAudioBytes)} MB limit.`,
      413,
      "AUDIO_TOO_LARGE",
    );
  }

  return file;
}

export function cleanText(value, { name, maxLength, required = false }) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) {
    throw new AppError(`${name} is required.`, 400, "INVALID_INPUT");
  }
  if (text.length > maxLength) {
    throw new AppError(
      `${name} must be ${maxLength} characters or fewer.`,
      400,
      "INVALID_INPUT",
    );
  }
  return text;
}

export function formatMegabytes(bytes) {
  return Math.floor(bytes / (1024 * 1024));
}
