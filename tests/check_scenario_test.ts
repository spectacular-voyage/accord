import { assertEquals } from "@std/assert";
import { basename, join, relative } from "@std/path";
import { CHECK_CODES } from "../src/report/codes.ts";
import { runScenarioCheck } from "../src/cli/commands/check_scenario.ts";
import { materializeRepoFixture } from "./harness/fixture_materializer.ts";

Deno.test("runScenarioCheck preserves step ordering and resolves manifests relative to the index", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "accord-scenario-" });
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const scenarioDir = join(tempDir, "scenario");
    const manifestsDir = join(scenarioDir, "manifests");
    await Deno.mkdir(manifestsDir, { recursive: true });
    await Deno.copyFile(
      "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
      join(manifestsDir, "first.jsonld"),
    );
    await Deno.copyFile(
      "testdata/manifests/bb-102-updated-bytes-pass.jsonld",
      join(manifestsDir, "second.jsonld"),
    );
    const scenarioPath = join(scenarioDir, "scenario-index.jsonld");
    await writeScenarioIndex(scenarioPath, {
      steps: [
        {
          id: "#first",
          manifestPath: "manifests/first.jsonld",
          caseId: "#auto-select-case",
        },
        {
          id: "#second",
          manifestPath: "manifests/second.jsonld",
          caseId: "#updated-bytes-case",
        },
      ],
    });

    const report = await runScenarioCheck({
      scenarioIndexPath: scenarioPath,
      fixtureRepoPath: materialized.repoPath,
    });

    assertEquals(report.steps.map((step) => step.stepId), [
      "#first",
      "#second",
    ]);
    assertEquals(
      report.steps[0].manifestPath,
      join(manifestsDir, "first.jsonld"),
    );
    assertEquals(
      report.steps[1].manifestPath,
      join(manifestsDir, "second.jsonld"),
    );
    assertEquals(report.summary, { pass: 2, fail: 0, error: 0 });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});

Deno.test("runScenarioCheck honors defaultFixtureRepo relative to the index", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "accord-scenario-" });
  const materialized = await materializeRepoFixture("repo-files", {
    parentDir: tempDir,
  });

  try {
    const scenarioDir = join(tempDir, "scenario");
    await Deno.mkdir(scenarioDir, { recursive: true });
    const scenarioPath = join(scenarioDir, "scenario-index.jsonld");
    await writeScenarioIndex(scenarioPath, {
      defaultFixtureRepo: relative(scenarioDir, materialized.repoPath),
      steps: [
        {
          id: "#default-fixture",
          manifestPath: manifestPathFromScenarioDir(
            scenarioDir,
            "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
          ),
          caseId: "#auto-select-case",
        },
      ],
    });

    const report = await runScenarioCheck({ scenarioIndexPath: scenarioPath });

    assertEquals(report.fixtureRepoPath, materialized.repoPath);
    assertEquals(report.steps[0].report.fixtureRepoPath, materialized.repoPath);
    assertEquals(report.status, "pass");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("runScenarioCheck lets --fixture-repo-path override defaultFixtureRepo", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "accord-scenario-" });
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const scenarioDir = join(tempDir, "scenario");
    await Deno.mkdir(scenarioDir, { recursive: true });
    const scenarioPath = join(scenarioDir, "scenario-index.jsonld");
    await writeScenarioIndex(scenarioPath, {
      defaultFixtureRepo: "missing-default-repo",
      steps: [
        {
          id: "#override-fixture",
          manifestPath: manifestPathFromScenarioDir(
            scenarioDir,
            "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
          ),
          caseId: "#auto-select-case",
        },
      ],
    });

    const report = await runScenarioCheck({
      scenarioIndexPath: scenarioPath,
      fixtureRepoPath: materialized.repoPath,
    });

    assertEquals(report.fixtureRepoPath, materialized.repoPath);
    assertEquals(report.status, "pass");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});

Deno.test("runScenarioCheck isolates per-step manifest errors and continues", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "accord-scenario-" });
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const scenarioDir = join(tempDir, "scenario");
    await Deno.mkdir(scenarioDir, { recursive: true });
    const scenarioPath = join(scenarioDir, "scenario-index.jsonld");
    await writeScenarioIndex(scenarioPath, {
      steps: [
        {
          id: "#pass",
          manifestPath: manifestPathFromScenarioDir(
            scenarioDir,
            "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
          ),
          caseId: "#auto-select-case",
        },
        {
          id: "#error",
          manifestPath: "missing-manifest.jsonld",
        },
        {
          id: "#fail",
          manifestPath: manifestPathFromScenarioDir(
            scenarioDir,
            "testdata/manifests/bb-104-unchanged-text-fail.jsonld",
          ),
          caseId: "#unchanged-text-fail-case",
        },
      ],
    });

    const report = await runScenarioCheck({
      scenarioIndexPath: scenarioPath,
      fixtureRepoPath: materialized.repoPath,
    });

    assertEquals(report.status, "error");
    assertEquals(report.summary, { pass: 1, fail: 1, error: 1 });
    assertEquals(report.steps.map((step) => step.report.status), [
      "pass",
      "error",
      "fail",
    ]);
    assertEquals(
      report.steps[1].report.checks[0].code,
      CHECK_CODES.MANIFEST_LOAD_ERROR,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});

Deno.test("runScenarioCheck reports lane bindings as ignored warnings", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "accord-scenario-" });
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const scenarioDir = join(tempDir, "scenario");
    await Deno.mkdir(scenarioDir, { recursive: true });
    const scenarioPath = join(scenarioDir, "scenario-index.jsonld");
    await writeScenarioIndex(scenarioPath, {
      stateLanes: [
        {
          id: "#publication-lane",
          laneKey: "publication",
        },
      ],
      steps: [
        {
          id: "#lane-bound",
          manifestPath: manifestPathFromScenarioDir(
            scenarioDir,
            "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
          ),
          caseId: "#auto-select-case",
          laneBindings: [
            {
              lane: "#publication-lane",
              fromRef: "r0-empty",
              toRef: "r1-bytes-a",
            },
          ],
        },
      ],
    });

    const report = await runScenarioCheck({
      scenarioIndexPath: scenarioPath,
      fixtureRepoPath: materialized.repoPath,
    });

    assertEquals(report.steps[0].warnings.map((warning) => warning.code), [
      "lane_bindings_ignored",
    ]);
    assertEquals(report.steps[0].fromRef, "r0-empty");
    assertEquals(report.steps[0].toRef, "r1-bytes-a");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});

interface ScenarioIndexInput {
  defaultFixtureRepo?: string;
  stateLanes?: Array<{
    id: string;
    laneKey: string;
  }>;
  steps: Array<{
    id: string;
    manifestPath: string;
    caseId?: string;
    laneBindings?: Array<{
      lane: string;
      fromRef: string;
      toRef: string;
    }>;
  }>;
}

function manifestPathFromScenarioDir(
  scenarioDir: string,
  manifestPath: string,
): string {
  return relative(scenarioDir, join(Deno.cwd(), manifestPath));
}

async function writeScenarioIndex(
  scenarioPath: string,
  input: ScenarioIndexInput,
): Promise<void> {
  const document = {
    "@context": {
      "@vocab": "https://spectacular-voyage.github.io/accord/ontology/",
      id: "@id",
      type: "@type",
      hasStep: {
        "@container": "@list",
      },
      lane: {
        "@type": "@id",
      },
    },
    type: "ScenarioIndex",
    id: `urn:accord:test:${basename(scenarioPath)}`,
    defaultFixtureRepo: input.defaultFixtureRepo,
    hasStateLane: input.stateLanes?.map((lane) => ({
      id: lane.id,
      type: "StateLane",
      laneKey: lane.laneKey,
    })),
    hasStep: input.steps.map((step) => ({
      id: step.id,
      type: "ScenarioStep",
      manifestPath: step.manifestPath,
      caseId: step.caseId,
      hasLaneBinding: step.laneBindings?.map((binding) => ({
        type: "LaneStateBinding",
        lane: binding.lane,
        fromLaneState: {
          type: "StateLocator",
          locatorKind: "gitRefState",
          ref: binding.fromRef,
        },
        toLaneState: {
          type: "StateLocator",
          locatorKind: "gitRefState",
          ref: binding.toRef,
        },
      })),
    })),
  };

  await Deno.writeTextFile(scenarioPath, JSON.stringify(document, null, 2));
}
