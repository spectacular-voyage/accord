import { assert, assertEquals } from "@std/assert";
import type { JsonReport } from "../src/report/json_report.ts";
import type { ValidationReport } from "../src/report/validation_report.ts";
import { runAccordCli } from "./harness/cli_runner.ts";
import { materializeRepoFixture } from "./harness/fixture_materializer.ts";

const validManifest = "testdata/manifests/validate-001-valid.jsonld";

Deno.test("accord validate reports a conformant manifest", async () => {
  const result = await runAccordCli([
    "validate",
    validManifest,
    "--format",
    "json",
  ]);
  const report = JSON.parse(result.stdout) as ValidationReport;

  assertEquals(result.code, 0);
  assertEquals(result.stderr.trim(), "");
  assertEquals(report.status, "conformant");
  assertEquals(report.conforms, true);
  assertEquals(report.summary, { resultCount: 0, errorCount: 0 });
  assertEquals(report.results, []);
});

Deno.test("accord validate reports a conformant scenario index", async () => {
  const scenarioIndexPath =
    "testdata/scenarios/black-box-scenario-index.jsonld";
  const result = await runAccordCli([
    "validate",
    scenarioIndexPath,
    "--format",
    "json",
  ]);
  const report = JSON.parse(result.stdout) as ValidationReport;

  assertEquals(result.code, 0);
  assertEquals(result.stderr.trim(), "");
  assertEquals(report.manifestPath, scenarioIndexPath);
  assertEquals(report.status, "conformant");
  assertEquals(report.conforms, true);
  assertEquals(report.summary, { resultCount: 0, errorCount: 0 });
  assertEquals(report.results, []);
});

Deno.test("accord validate executes compareMode required sh:sparql constraint", async () => {
  const report = await validateNonConformantManifest(
    "testdata/manifests/validate-101-compare-mode-required.jsonld",
  );

  assertSparqlMessage(
    report,
    "File expectations with changeType accord:added, accord:updated, or accord:unchanged must declare compareMode.",
  );
});

Deno.test("accord validate executes compareMode forbidden sh:sparql constraint", async () => {
  const report = await validateNonConformantManifest(
    "testdata/manifests/validate-102-compare-mode-forbidden.jsonld",
  );

  assertSparqlMessage(
    report,
    "File expectations with changeType accord:removed or accord:absent must not declare compareMode.",
  );
});

Deno.test("accord validate executes same-transition-case target sh:sparql constraint", async () => {
  const report = await validateNonConformantManifest(
    "testdata/manifests/validate-103-rdf-target-other-case.jsonld",
  );

  assertSparqlMessage(
    report,
    "An RDF expectation must target a file expectation in the same transition case that contains the RDF expectation.",
  );
});

Deno.test("accord validate executes duplicate path sh:sparql constraint", async () => {
  const report = await validateNonConformantManifest(
    "testdata/manifests/validate-104-duplicate-path.jsonld",
  );

  assertSparqlMessage(
    report,
    "A transition case must not contain two distinct file expectations for the same path.",
  );
});

Deno.test("accord validate rejects malformed JSON assertion authoring", async () => {
  const report = await validateNonConformantManifest(
    "testdata/manifests/validate-201-json-count-missing-expected-count.jsonld",
  );

  assertSparqlMessage(
    report,
    "JSON count assertions must declare expectedCount.",
  );
});

Deno.test("accord check does not run SHACL validation as a preflight", async () => {
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const result = await runAccordCli([
      "check",
      "testdata/manifests/validate-101-compare-mode-required.jsonld",
      "--fixture-repo-path",
      materialized.repoPath,
      "--format",
      "json",
    ]);
    const report = JSON.parse(result.stdout) as JsonReport;

    assertEquals(result.code, 0);
    assertEquals(result.stderr.trim(), "");
    assertEquals(report.status, "pass");
    assertEquals(report.summary.error, 0);
    assertEquals(report.checks.some((check) => check.kind === "setup"), false);
  } finally {
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});

async function validateNonConformantManifest(
  manifestPath: string,
): Promise<ValidationReport> {
  const result = await runAccordCli([
    "validate",
    manifestPath,
    "--format",
    "json",
  ]);
  const report = JSON.parse(result.stdout) as ValidationReport;

  assertEquals(result.code, 1);
  assertEquals(result.stderr.trim(), "");
  assertEquals(report.status, "non_conformant");
  assertEquals(report.conforms, false);
  assert(report.summary.resultCount > 0);
  return report;
}

function assertSparqlMessage(
  report: ValidationReport,
  message: string,
): void {
  assert(
    report.results.some((result) =>
      result.sourceConstraintComponent === "SPARQLConstraintComponent" &&
      result.message === message
    ),
    `Expected SPARQL validation result message: ${message}`,
  );
}
