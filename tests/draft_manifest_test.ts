import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  draftFileExpectations,
  inferCompareMode,
  renderDraftManifest,
} from "../src/draft/manifest.ts";
import { parseGitNameStatusDiff } from "../src/git/diff.ts";
import type { JsonReport } from "../src/report/json_report.ts";
import type { ValidationReport } from "../src/report/validation_report.ts";
import { runAccordCli } from "./harness/cli_runner.ts";
import { materializeRepoFixture } from "./harness/fixture_materializer.ts";

Deno.test("parseGitNameStatusDiff parses add, modify, delete, type-change, and rename records", () => {
  assertEquals(
    parseGitNameStatusDiff(
      "A\0docs/readme.md\0M\0graph.ttl\0D\0old.bin\0T\0script.sh\0R100\0old.md\0new.md\0",
    ),
    [
      { status: "A", path: "docs/readme.md" },
      { status: "M", path: "graph.ttl" },
      { status: "D", path: "old.bin" },
      { status: "T", path: "script.sh" },
      { status: "R", oldPath: "old.md", newPath: "new.md" },
    ],
  );
});

Deno.test("draftFileExpectations maps statuses and mints deterministic ids", () => {
  const expectations = draftFileExpectations([
    { status: "R", oldPath: "old.md", newPath: "new.md" },
    { status: "A", path: "docs/readme.md" },
    { status: "M", path: "graph.ttl" },
    { status: "T", path: "script.sh" },
    { status: "D", path: "old.bin" },
  ]);

  assertEquals(expectations, [
    {
      id: "#added-docs-readme-md",
      type: "FileExpectation",
      path: "docs/readme.md",
      changeType: "added",
      compareMode: "text",
    },
    {
      id: "#updated-graph-ttl",
      type: "FileExpectation",
      path: "graph.ttl",
      changeType: "updated",
      compareMode: "rdfCanonical",
    },
    {
      id: "#removed-old-bin",
      type: "FileExpectation",
      path: "old.bin",
      changeType: "removed",
    },
    {
      id: "#removed-old-md",
      type: "FileExpectation",
      path: "old.md",
      changeType: "removed",
    },
    {
      id: "#added-new-md",
      type: "FileExpectation",
      path: "new.md",
      changeType: "added",
      compareMode: "text",
    },
    {
      id: "#updated-script-sh",
      type: "FileExpectation",
      path: "script.sh",
      changeType: "updated",
      compareMode: "text",
    },
  ]);
});

Deno.test("draftFileExpectations sorts paths by ordinal string order", () => {
  const expectations = draftFileExpectations([
    { status: "M", path: "a.txt" },
    { status: "M", path: "B.txt" },
  ]);

  assertEquals(expectations.map((expectation) => expectation.path), [
    "B.txt",
    "a.txt",
  ]);
});

Deno.test("inferCompareMode follows the documented extension table", () => {
  assertEquals(inferCompareMode("graph.TTL"), "rdfCanonical");
  assertEquals(inferCompareMode("data/graph.jsonld"), "rdfCanonical");
  assertEquals(inferCompareMode("docs/readme.md"), "text");
  assertEquals(inferCompareMode("config/settings.yaml"), "text");
  assertEquals(inferCompareMode("image.bin"), "bytes");
  assertEquals(inferCompareMode(".nojekyll"), "bytes");
});

Deno.test("renderDraftManifest is byte-identical for the same input", () => {
  const input = {
    fromRef: "r10-draft-from",
    toRef: "r11-draft-to",
    changes: [
      { status: "M" as const, path: "note.txt" },
      { status: "A" as const, path: "docs/readme.md" },
    ],
  };

  assertEquals(renderDraftManifest(input), renderDraftManifest(input));
  assertStringIncludes(
    renderDraftManifest(input),
    '"id": "urn:accord:draft:r10-draft-from-to-r11-draft-to"',
  );
});

Deno.test("accord draft-manifest round trips through check and validate", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "accord-draft-" });
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const args = [
      "draft-manifest",
      "--from",
      "r10-draft-from",
      "--to",
      "r11-draft-to",
      "--fixture-repo-path",
      materialized.repoPath,
    ];
    const first = await runAccordCli(args);
    const second = await runAccordCli(args);
    const draftPath = join(tempDir, "draft.jsonld");

    assertEquals(first.code, 0);
    assertEquals(first.stderr.trim(), "");
    assertEquals(first.stdout, second.stdout);
    assertEquals(
      JSON.parse(first.stdout).hasCase[0].hasRdfExpectation,
      undefined,
    );
    assertEquals(
      JSON.parse(first.stdout).hasCase[0].hasJsonExpectation,
      undefined,
    );

    await Deno.writeTextFile(draftPath, first.stdout);

    const check = await runAccordCli([
      "check",
      draftPath,
      "--fixture-repo-path",
      materialized.repoPath,
      "--format",
      "json",
    ]);
    const checkReport = JSON.parse(check.stdout) as JsonReport;

    assertEquals(check.code, 0);
    assertEquals(check.stderr.trim(), "");
    assertEquals(checkReport.status, "pass");

    const validate = await runAccordCli([
      "validate",
      draftPath,
      "--format",
      "json",
    ]);
    const validationReport = JSON.parse(validate.stdout) as ValidationReport;

    assertEquals(validate.code, 0);
    assertEquals(validate.stderr.trim(), "");
    assertEquals(validationReport.status, "conformant");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});

Deno.test("accord draft-manifest refuses to overwrite --out without --force", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "accord-draft-" });
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const outPath = join(tempDir, "draft.jsonld");
    await Deno.writeTextFile(outPath, "keep me");

    const refused = await runAccordCli([
      "draft-manifest",
      "--from",
      "r10-draft-from",
      "--to",
      "r11-draft-to",
      "--fixture-repo-path",
      materialized.repoPath,
      "--out",
      outPath,
    ]);

    assertEquals(refused.code, 2);
    assertEquals(refused.stdout, "");
    assertStringIncludes(refused.stderr, "Refusing to overwrite");
    assertEquals(await Deno.readTextFile(outPath), "keep me");

    const forced = await runAccordCli([
      "draft-manifest",
      "--from",
      "r10-draft-from",
      "--to",
      "r11-draft-to",
      "--fixture-repo-path",
      materialized.repoPath,
      "--out",
      outPath,
      "--force",
    ]);

    assertEquals(forced.code, 0);
    assertEquals(forced.stderr.trim(), "");
    assertStringIncludes(await Deno.readTextFile(outPath), "r10-draft-from");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});
