import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  readScenarioIndexSource,
  ScenarioIndexValidationError,
  validateScenarioIndexDocument,
} from "../src/scenario/load_jsonld.ts";
import type { ScenarioIndexDocument } from "../src/scenario/model.ts";

const scenarioIndexPath = "testdata/scenarios/black-box-scenario-index.jsonld";

Deno.test("readScenarioIndexSource preserves compact scenario topology", async () => {
  const loaded = await readScenarioIndexSource(scenarioIndexPath);
  const document = loaded.document;
  const steps = document.hasStep ?? [];
  const firstStep = steps[0];
  const secondStep = steps[1];
  const sourceBinding = firstStep?.hasLaneBinding?.find((binding) =>
    binding.lane === "#source-lane"
  );
  const publicationBinding = firstStep?.hasLaneBinding?.find((binding) =>
    binding.lane === "#publication-lane"
  );

  assertEquals(document.id, "urn:accord:testdata:black-box-scenario-index");
  assertEquals(document.type, "ScenarioIndex");
  assertEquals(document.defaultFixtureRepo, "testdata/repos/repo-files");
  assertEquals(document.branchPrefix, "r");
  assertEquals(document.assetRoot, [".assets"]);
  assertEquals(document.hasStateLane?.map((lane) => lane.laneKey), [
    "source",
    "publication",
  ]);
  assertEquals(steps.map((step) => step.id), [
    "#bytes-added",
    "#bytes-updated",
  ]);
  assertEquals(
    firstStep?.manifestPath,
    "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
  );
  assertEquals(firstStep?.caseId, "#auto-select-case");
  assertEquals(
    secondStep?.manifestPath,
    "testdata/manifests/bb-102-updated-bytes-pass.jsonld",
  );
  assertEquals(sourceBinding?.fromLaneState?.ref, "source-r0");
  assertEquals(sourceBinding?.toLaneState?.ref, "source-r1");
  assertEquals(publicationBinding?.fromLaneState?.ref, "r0-empty");
  assertEquals(publicationBinding?.toLaneState?.ref, "r1-bytes-a");
});

Deno.test("validateScenarioIndexDocument accepts existing manifest references", async () => {
  const loaded = await readScenarioIndexSource(scenarioIndexPath);

  await validateScenarioIndexDocument(loaded.document);
});

Deno.test("readScenarioIndexSource preserves expanded scenario topology", async () => {
  const loaded = await readScenarioIndexSource(
    "testdata/scenarios/support/expanded-scenario-index.jsonld",
  );
  const step = loaded.document.hasStep?.[0];
  const binding = step?.hasLaneBinding?.[0];

  assertEquals(
    loaded.document.id,
    "urn:accord:testdata:expanded-scenario-index",
  );
  assertEquals(loaded.document.hasStateLane?.[0].laneKey, "publication");
  assertEquals(
    step?.id,
    "urn:accord:testdata:expanded-scenario-index#bytes-added",
  );
  assertEquals(
    step?.manifestPath,
    "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
  );
  assertEquals(binding?.fromLaneState?.locatorKind, "gitRefState");
  assertEquals(binding?.toLaneState?.ref, "r1-bytes-a");

  await validateScenarioIndexDocument(loaded.document);
});

Deno.test("validateScenarioIndexDocument rejects duplicate step ids", async () => {
  const document = await loadClonedScenarioIndex();

  document.hasStep![1].id = "#bytes-added";

  await assertRejects(
    () => validateScenarioIndexDocument(document),
    ScenarioIndexValidationError,
    "duplicate step id",
  );
});

Deno.test("validateScenarioIndexDocument rejects missing manifest references", async () => {
  const document = await loadClonedScenarioIndex();

  document.hasStep![0].manifestPath = "testdata/manifests/missing.jsonld";

  await assertRejects(
    () => validateScenarioIndexDocument(document),
    ScenarioIndexValidationError,
    "missing manifestPath",
  );
});

Deno.test("validateScenarioIndexDocument rejects undeclared lane references", async () => {
  const document = await loadClonedScenarioIndex();

  document.hasStep![0].hasLaneBinding![0].lane = "#missing-lane";

  await assertRejects(
    () => validateScenarioIndexDocument(document),
    ScenarioIndexValidationError,
    "undeclared lane",
  );
});

Deno.test("validateScenarioIndexDocument rejects unsafe manifest paths", async () => {
  const document = await loadClonedScenarioIndex();

  document.hasStep![0].manifestPath =
    "../manifests/bb-001-single-case-auto-select-pass.jsonld";

  await assertRejects(
    () => validateScenarioIndexDocument(document),
    ScenarioIndexValidationError,
    "repository-relative POSIX path",
  );
});

Deno.test("scenario index vocabulary is present in ontology, SHACL, and context", async () => {
  const [ontology, shacl, contextText] = await Promise.all([
    Deno.readTextFile("accord-ontology.ttl"),
    Deno.readTextFile("accord-shacl.ttl"),
    Deno.readTextFile("testdata/manifests/support/accord-context.jsonld"),
  ]);
  const context = JSON.parse(contextText) as {
    "@context": Record<string, unknown>;
  };
  const hasStepContext = context["@context"].hasStep as Record<
    string,
    unknown
  >;
  const laneContext = context["@context"].lane as Record<string, unknown>;

  for (
    const term of [
      "ScenarioIndex",
      "ScenarioStep",
      "StateLane",
      "LaneStateBinding",
      "hasStep",
      "manifestPath",
      "fromLaneState",
      "toLaneState",
    ]
  ) {
    assert(
      ontology.includes(`accord:${term}`),
      `Expected ontology term accord:${term}`,
    );
  }

  for (
    const shape of [
      "ScenarioIndexShape",
      "ScenarioStepShape",
      "StateLaneShape",
      "LaneStateBindingShape",
    ]
  ) {
    assert(
      shacl.includes(`accord-sh:${shape}`),
      `Expected SHACL shape accord-sh:${shape}`,
    );
  }

  assertEquals(hasStepContext["@container"], "@list");
  assertEquals(laneContext["@type"], "@id");
});

async function loadClonedScenarioIndex(): Promise<ScenarioIndexDocument> {
  const loaded = await readScenarioIndexSource(scenarioIndexPath);
  return structuredClone(loaded.document);
}
