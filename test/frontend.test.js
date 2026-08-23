import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hidden interface states stay out of the CSS grid layout", async () => {
  const styles = await readFile(
    new URL("../public/styles.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/,
  );
});
