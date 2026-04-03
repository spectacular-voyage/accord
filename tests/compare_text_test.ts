import { assertEquals, assertThrows } from "@std/assert";
import {
  compareTextContents,
  TextDecodeError,
} from "../src/checker/compare_text.ts";

Deno.test("compareTextContents treats LF and CRLF as equal", async () => {
  const lf = await Deno.readFile(
    "testdata/repos/repo-files/refs/r3-text-lf/note.txt",
  );
  const crlf = await Deno.readFile(
    "testdata/repos/repo-files/refs/r4-text-crlf/note.txt",
  );

  assertEquals(compareTextContents(lf, crlf), true);
});

Deno.test("compareTextContents detects meaningful text changes", async () => {
  const lf = await Deno.readFile(
    "testdata/repos/repo-files/refs/r3-text-lf/note.txt",
  );
  const changed = await Deno.readFile(
    "testdata/repos/repo-files/refs/r5-text-changed/note.txt",
  );

  assertEquals(compareTextContents(lf, changed), false);
});

Deno.test("compareTextContents rejects invalid UTF-8 input", async () => {
  const invalid = await Deno.readFile(
    "testdata/repos/repo-files/refs/r6-text-invalid-utf8/note.txt",
  );

  assertThrows(
    () => compareTextContents(invalid, invalid),
    TextDecodeError,
  );
});
