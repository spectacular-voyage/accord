import { assertEquals, assertThrows } from "@std/assert";
import {
  CliParseError,
  parseCliArgs,
  renderUsage,
} from "../src/cli/parse_args.ts";

Deno.test("parseCliArgs returns help when no command is provided", () => {
  assertEquals(parseCliArgs([]), { kind: "help" });
});

Deno.test("parseCliArgs parses the check command", () => {
  assertEquals(
    parseCliArgs([
      "check",
      "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
      "--case",
      "#auto-select-case",
      "--fixture-repo-path",
      "/tmp/repo",
      "--format",
      "json",
    ]),
    {
      kind: "check",
      manifestPath:
        "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
      caseId: "#auto-select-case",
      fixtureRepoPath: "/tmp/repo",
      format: "json",
    },
  );
});

Deno.test("parseCliArgs rejects unknown commands", () => {
  assertThrows(
    () => parseCliArgs(["status"]),
    CliParseError,
    "Unknown command",
  );
});

Deno.test("renderUsage mentions the check command", () => {
  const usage = renderUsage();
  assertEquals(usage.includes("accord check"), true);
});
