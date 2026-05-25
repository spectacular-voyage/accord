import { assertEquals, assertThrows } from "@std/assert";
import {
  compileIgnorePathPatterns,
  IgnorePathPatternError,
} from "../src/checker/ignore_paths.ts";

Deno.test("compileIgnorePathPatterns supports exact and subtree patterns", () => {
  const patterns = compileIgnorePathPatterns([
    "artifact.txt",
    ".assets/**",
  ]);

  assertEquals(patterns[0].matches("artifact.txt"), true);
  assertEquals(patterns[0].matches("nested/artifact.txt"), false);
  assertEquals(patterns[1].matches(".assets/source.ttl"), true);
  assertEquals(patterns[1].matches(".assets/nested/source.ttl"), true);
  assertEquals(patterns[1].matches("other/source.ttl"), false);
});

Deno.test("compileIgnorePathPatterns supports single-segment stars", () => {
  const [pattern] = compileIgnorePathPatterns(["generated/*.ttl"]);

  assertEquals(pattern.matches("generated/source.ttl"), true);
  assertEquals(pattern.matches("generated/source.jsonld"), false);
  assertEquals(pattern.matches("generated/nested/source.ttl"), false);
});

Deno.test("compileIgnorePathPatterns rejects invalid patterns", () => {
  assertThrows(
    () => compileIgnorePathPatterns([""]),
    IgnorePathPatternError,
    "must not be empty",
  );
  assertThrows(
    () => compileIgnorePathPatterns(["/absolute.ttl"]),
    IgnorePathPatternError,
    "repo-relative",
  );
  assertThrows(
    () => compileIgnorePathPatterns(["../source.ttl"]),
    IgnorePathPatternError,
    "traversal",
  );
  assertThrows(
    () => compileIgnorePathPatterns(["generated\\source.ttl"]),
    IgnorePathPatternError,
    "POSIX",
  );
});
