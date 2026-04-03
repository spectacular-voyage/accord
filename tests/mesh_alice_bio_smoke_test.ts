import { assertEquals } from "@std/assert";
import { JsonReport } from "../src/report/json_report.ts";
import { runAccordCli } from "./harness/cli_runner.ts";
import {
  conformanceManifestPath,
  resolveMeshAliceBioCorpus,
} from "./harness/mesh_alice_bio.ts";

interface MeshAliceBioSmokeScenario {
  manifestName: string;
  expectedCaseId: string;
  expectedSummary: JsonReport["summary"];
}

const corpus = await resolveMeshAliceBioCorpus();
const smokeScenarios: MeshAliceBioSmokeScenario[] = [
  {
    manifestName: "01-source-only.jsonld",
    expectedCaseId: "#seed-source-only",
    expectedSummary: { pass: 4, fail: 0, error: 0 },
  },
  {
    manifestName: "05-alice-knop-created-woven.jsonld",
    expectedCaseId: "#weave-alice-knop-created",
    expectedSummary: { pass: 37, fail: 0, error: 0 },
  },
  {
    manifestName: "09-alice-bio-referenced-woven.jsonld",
    expectedCaseId: "#weave-alice-reference-catalog",
    expectedSummary: { pass: 31, fail: 0, error: 0 },
  },
  {
    manifestName: "11-alice-bio-v2-woven.jsonld",
    expectedCaseId: "#weave-alice-bio-v2",
    expectedSummary: { pass: 68, fail: 0, error: 0 },
  },
  {
    manifestName: "13-bob-extracted-woven.jsonld",
    expectedCaseId: "#weave-bob-extracted",
    expectedSummary: { pass: 49, fail: 0, error: 0 },
  },
];

for (const scenario of smokeScenarios) {
  Deno.test({
    name:
      `accord check smokes mesh-alice-bio manifest ${scenario.manifestName}`,
    ignore: !corpus.available,
    async fn() {
      const manifestPath = conformanceManifestPath(
        corpus,
        scenario.manifestName,
      );
      const result = await runAccordCli([
        "check",
        manifestPath,
        "--fixture-repo-path",
        corpus.fixtureRepoPath,
        "--format",
        "json",
      ]);
      const report = JSON.parse(result.stdout) as JsonReport;

      assertEquals(result.code, 0);
      assertEquals(result.stderr.trim(), "");
      assertEquals(report.manifestPath, manifestPath);
      assertEquals(report.caseId, scenario.expectedCaseId);
      assertEquals(report.fixtureRepoPath, corpus.fixtureRepoPath);
      assertEquals(report.status, "pass");
      assertEquals(report.summary, scenario.expectedSummary);
      assertEquals(report.checks.length, report.summary.pass);
      assertEquals(
        report.checks.every((check) => check.status === "pass"),
        true,
      );
    },
  });
}
