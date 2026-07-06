import { assert, assertArrayIncludes, assertEquals } from "@std/assert";
import { join } from "@std/path";
import type { JsonReport } from "../src/report/json_report.ts";
import type { ScenarioReport } from "../src/report/scenario_report.ts";
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
  "bb-208-unchanged-rdf-jsonld-pass-equivalent-serialization",
  "bb-209-unchanged-rdf-jsonld-fail-meaningful-change",
  "bb-210-sparql-ask-jsonld-true-pass",
  "bb-211-sparql-ask-jsonld-mismatch-fail",
  "bb-212-rdf-jsonld-remote-context-error",
  "bb-213-rdf-jsonld-parse-error",
  "bb-214-sparql-ask-filter-not-exists-pass",
  "bb-215-sparql-ask-unsupported-service-error",
  "bb-301-json-report-shape",
  "bb-302-text-report-smoke",
  "bb-401-replay-metadata-pass",
  "bb-501-ignore-paths-pass",
  "bb-502-unexpected-asset-change-fail",
  "bb-503-ignore-path-conflict-error",
  "bb-504-ignore-path-absolute-error",
  "bb-505-ignore-path-traversal-error",
  "bb-601-json-not-exists-pass",
  "bb-602-json-not-exists-fail",
  "bb-603-json-equals-count-pass",
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

Deno.test("accord check-scenario reports ordered pass, error, and fail steps", async () => {
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const result = await runAccordCli([
      "check-scenario",
      "testdata/check-scenario-mixed.jsonld",
      "--fixture-repo-path",
      materialized.repoPath,
      "--format",
      "json",
    ]);
    const report = JSON.parse(result.stdout) as ScenarioReport;

    assertEquals(result.code, 2);
    assertEquals(result.stderr.trim(), "");
    assertEquals(report.scenarioPath, "testdata/check-scenario-mixed.jsonld");
    assertEquals(report.scenarioId, "urn:accord:testdata:check-scenario-mixed");
    assertEquals(report.fixtureRepoPath, materialized.repoPath);
    assertEquals(report.status, "error");
    assertEquals(report.summary, { pass: 1, fail: 1, error: 1 });
    assertEquals(report.steps.map((step) => step.stepId), [
      "#pass",
      "#error",
      "#fail",
    ]);
    assertEquals(report.steps.map((step) => step.report.status), [
      "pass",
      "error",
      "fail",
    ]);
    assertEquals(report.steps[0].report.checks[0].kind, "file_presence");
    assertEquals(report.steps[1].report.checks[0].kind, "setup");
    assertEquals(report.steps[1].report.checks[0].code, "manifest_load_error");
    assertEquals(
      report.steps[2].report.checks.some((check) => check.status === "fail"),
      true,
    );
  } finally {
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});

Deno.test("accord check JSON assertions read checked git refs, not the working tree", async () => {
  const materialized = await materializeRepoFixture("repo-files");

  try {
    await Deno.writeTextFile(
      join(materialized.repoPath, "contract.json"),
      JSON.stringify({
        participants: [{ participantAim: "working-tree-only" }],
      }),
    );

    const result = await runAccordCli([
      "check",
      "testdata/manifests/bb-601-json-not-exists-pass.jsonld",
      "--fixture-repo-path",
      materialized.repoPath,
      "--format",
      "json",
    ]);
    const report = JSON.parse(result.stdout) as JsonReport;

    assertEquals(result.code, 0);
    assertEquals(result.stderr.trim(), "");
    assertEquals(report.status, "pass");
    assertEquals(report.summary, { pass: 2, fail: 0, error: 0 });
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

      if (scenario.id === "bb-601-json-not-exists-pass") {
        const jsonChecks = report.checks.filter((check) =>
          check.kind === "json_assertion"
        );

        assertEquals(jsonChecks.length, 1);
        assertEquals(jsonChecks[0].status, "pass");
        assertEquals(jsonChecks[0].code, "json_assertion_ok");
        assertEquals(jsonChecks[0].path, "contract.json");
        assertEquals(jsonChecks[0].jsonPath, "$..participantAim");
        assertEquals(jsonChecks[0].assertionId, "#no-participant-aim-leak");
      }

      if (scenario.id === "bb-602-json-not-exists-fail") {
        const jsonChecks = report.checks.filter((check) =>
          check.kind === "json_assertion"
        );

        assertEquals(jsonChecks.length, 1);
        assertEquals(jsonChecks[0].status, "fail");
        assertEquals(jsonChecks[0].code, "json_assertion_mismatch");
        assertEquals(jsonChecks[0].path, "contract.json");
        assertEquals(jsonChecks[0].jsonPath, "$..participantAim");
      }

      if (scenario.id === "bb-603-json-equals-count-pass") {
        const jsonChecks = report.checks.filter((check) =>
          check.kind === "json_assertion"
        );

        assertEquals(jsonChecks.length, 2);
        assertEquals(jsonChecks.map((check) => check.assertionId), [
          "#status-ok",
          "#two-evidence-pointers",
        ]);
        assertEquals(
          jsonChecks.map((check) => [check.status, check.code]),
          [
            ["pass", "json_assertion_ok"],
            ["pass", "json_assertion_ok"],
          ],
        );
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
