import { assert, assertArrayIncludes, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { JsonReport } from "../src/report/json_report.ts";
import { runAccordCli } from "./harness/cli_runner.ts";
import { materializeRepoFixture } from "./harness/fixture_materializer.ts";

interface ScenarioIndex {
  id: string;
  scenarios: Array<{
    id: string;
    manifestPath: string;
    repoId: string;
    selectedCaseId?: string;
    expectedExitCode?: number;
    expectedStatus?: JsonReport["status"];
    expectedCaseId?: string;
    expectedSummary?: JsonReport["summary"];
    expectedCodes?: string[];
  }>;
}

const executableScenarioIds = [
  "bb-001-single-case-auto-select-pass",
  "bb-002-explicit-case-pass",
  "bb-003-multi-case-selector-required",
  "bb-004-unknown-case-id",
  "bb-005-remote-context-disallowed",
  "bb-006-unresolved-ref",
  "bb-101-added-bytes-pass",
  "bb-102-updated-bytes-pass",
  "bb-103-unchanged-text-pass-with-crlf-normalization",
  "bb-104-unchanged-text-fail",
  "bb-105-removed-pass",
  "bb-106-absent-pass-even-if-previously-present",
  "bb-107-absent-fail-when-still-present",
  "bb-108-text-invalid-utf8-error",
  "bb-201-unchanged-rdf-pass-equivalent-serialization",
  "bb-202-unchanged-rdf-pass-ignored-predicate-only",
  "bb-203-unchanged-rdf-fail-meaningful-change",
  "bb-204-rdf-parse-error",
  "bb-205-sparql-ask-true-pass",
  "bb-206-sparql-ask-false-pass",
  "bb-207-sparql-ask-mismatch-fail",
  "bb-301-json-report-shape",
  "bb-302-text-report-smoke",
] as const;

const scenarioIndex = await loadScenarioIndex();

Deno.test("black-box scenario index references existing manifests and fixtures", async () => {
  assertEquals(scenarioIndex.id, "accord-black-box-v1");
  assert(scenarioIndex.scenarios.length > 0);

  for (const scenario of scenarioIndex.scenarios) {
    const manifestInfo = await Deno.stat(scenario.manifestPath);
    assert(manifestInfo.isFile, `Expected manifest file for ${scenario.id}`);

    const repoInfo = await Deno.stat(
      join("testdata", "repos", scenario.repoId, "repo.json"),
    );
    assert(repoInfo.isFile, `Expected repo fixture for ${scenario.id}`);
  }
});

Deno.test("fixture materializer creates git repos with the declared refs", async () => {
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const command = new Deno.Command("git", {
      args: ["-C", materialized.repoPath, "tag", "--list"],
      stdout: "piped",
    });
    const result = await command.output();
    const tags = new TextDecoder().decode(result.stdout).trim().split("\n");

    assertEquals(tags.includes("r0-empty"), true);
    assertEquals(tags.includes("r6-text-invalid-utf8"), true);
  } finally {
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});

for (const scenarioId of executableScenarioIds) {
  const scenario = getScenario(scenarioId);

  Deno.test(`accord check executes ${scenario.id}`, async () => {
    const materialized = await materializeRepoFixture(scenario.repoId);

    try {
      const args = ["check", scenario.manifestPath];

      if (scenario.selectedCaseId !== undefined) {
        args.push("--case", scenario.selectedCaseId);
      }

      if (scenario.id === "bb-302-text-report-smoke") {
        args.push("--fixture-repo-path", materialized.repoPath);
        const result = await runAccordCli(args);

        assertEquals(result.code, scenario.expectedExitCode);
        assertEquals(result.stderr.trim(), "");
        assert(result.stdout.includes(`manifest: ${scenario.manifestPath}`));
        assert(result.stdout.includes("status: fail"));
        assert(result.stdout.includes("summary: pass=1 fail=1 error=0"));
        assert(result.stdout.includes("file_content_mismatch"));
        assert(result.stdout.includes("note.txt"));
        return;
      }

      args.push(
        "--fixture-repo-path",
        materialized.repoPath,
        "--format",
        "json",
      );
      const result = await runAccordCli(args);
      const report = JSON.parse(result.stdout) as JsonReport;

      assertEquals(result.code, scenario.expectedExitCode);
      assertEquals(result.stderr.trim(), "");
      assertEquals(report.manifestPath, scenario.manifestPath);
      assertEquals(report.fixtureRepoPath, materialized.repoPath);
      assertEquals(report.status, scenario.expectedStatus);
      assertEquals(report.summary, scenario.expectedSummary);
      assertEquals(typeof report.caseId, "string");
      assertEquals(Array.isArray(report.checks), true);
      assertEquals(
        report.checks.length,
        report.summary.pass + report.summary.fail + report.summary.error,
      );

      if (scenario.expectedCaseId !== undefined) {
        assertEquals(report.caseId, scenario.expectedCaseId);
      }

      if (scenario.expectedCodes !== undefined) {
        const actualCodes = report.checks
          .filter((check) => check.status !== "pass")
          .map((check) => check.code);
        assertArrayIncludes(actualCodes, scenario.expectedCodes);
      }
    } finally {
      await Deno.remove(materialized.repoPath, { recursive: true });
    }
  });
}

async function loadScenarioIndex(): Promise<ScenarioIndex> {
  const rawIndex = await Deno.readTextFile("testdata/scenarios/black-box.json");
  return JSON.parse(rawIndex) as ScenarioIndex;
}

function getScenario(
  scenarioId: string,
): ScenarioIndex["scenarios"][number] {
  const scenario = scenarioIndex.scenarios.find((entry) =>
    entry.id === scenarioId
  );

  if (scenario === undefined) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }

  return scenario;
}
