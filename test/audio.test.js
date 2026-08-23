import assert from "node:assert/strict";
import test from "node:test";
import { cleanText, validateAudioFile } from "../src/audio.js";

test("validateAudioFile accepts a supported non-empty file", () => {
  const file = new File(["audio"], "meeting.wav", { type: "audio/wav" });
  assert.equal(validateAudioFile(file, 100), file);
});

test("validateAudioFile rejects unsupported, empty, and oversized files", () => {
  assert.throws(
    () => validateAudioFile(new File(["x"], "meeting.txt"), 100),
    { code: "UNSUPPORTED_AUDIO" },
  );
  assert.throws(
    () => validateAudioFile(new File([], "meeting.mp3"), 100),
    { code: "EMPTY_AUDIO" },
  );
  assert.throws(
    () => validateAudioFile(new File(["too large"], "meeting.mp3"), 2),
    { code: "AUDIO_TOO_LARGE" },
  );
});

test("cleanText trims input and enforces its maximum", () => {
  assert.equal(cleanText("  weekly sync  ", { name: "Title", maxLength: 20 }), "weekly sync");
  assert.throws(
    () => cleanText("12345", { name: "Title", maxLength: 4 }),
    { code: "INVALID_INPUT" },
  );
});
