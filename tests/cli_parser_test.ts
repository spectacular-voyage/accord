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

Deno.test("parseCliArgs parses the check-scenario command", () => {
  assertEquals(
    parseCliArgs([
      "check-scenario",
      "testdata/check-scenario-mixed.jsonld",
      "--fixture-repo-path",
      "/tmp/repo",
      "--format",
      "json",
    ]),
    {
      kind: "check-scenario",
      scenarioIndexPath: "testdata/check-scenario-mixed.jsonld",
      fixtureRepoPath: "/tmp/repo",
      format: "json",
    },
  );
});

Deno.test("parseCliArgs parses the validate command", () => {
  assertEquals(
    parseCliArgs([
      "validate",
      "testdata/manifests/validate-001-valid.jsonld",
      "--format",
      "json",
    ]),
    {
      kind: "validate",
      manifestPath: "testdata/manifests/validate-001-valid.jsonld",
      format: "json",
    },
  );
});

Deno.test("parseCliArgs rejects case selection for check-scenario", () => {
  assertThrows(
    () =>
      parseCliArgs([
        "check-scenario",
        "testdata/check-scenario-mixed.jsonld",
        "--case",
        "#case",
      ]),
    CliParseError,
    "check-scenario command only accepts",
  );
});

Deno.test("parseCliArgs rejects unknown commands", () => {
  assertThrows(
    () => parseCliArgs(["status"]),
    CliParseError,
    "Unknown command",
  );
});

Deno.test("renderUsage mentions the check and validate commands", () => {
  const usage = renderUsage();
  assertEquals(usage.includes("accord check"), true);
  assertEquals(usage.includes("accord check-scenario"), true);
  assertEquals(usage.includes("accord validate"), true);
});
