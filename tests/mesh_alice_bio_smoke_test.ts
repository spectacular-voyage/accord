import { assert, assertEquals } from "@std/assert";
import { basename, join } from "@std/path";
import type { JsonReport } from "../src/report/json_report.ts";
import { runAccordCli } from "./harness/cli_runner.ts";
import { resolveMeshAliceBioCorpus } from "./harness/mesh_alice_bio.ts";

const corpus = await resolveMeshAliceBioCorpus();

const knownIncompleteManifests = new Map<string, string>([
  [
    "05-alice-knop-created-woven.jsonld",
    "generated mesh inventory/meta resource pages and meta RDF expectations still need manifest coverage",
  ],
  [
    "07-alice-bio-integrated-woven.jsonld",
    "generated mesh and Alice payload resource pages plus meta RDF expectations still need manifest coverage",
  ],
  [
    "09-alice-bio-referenced-woven.jsonld",
    "generated Alice reference-catalog resource pages still need manifest coverage",
  ],
  [
    "13-bob-extracted-woven.jsonld",
    "generated Bob support and mesh support resource pages still need manifest coverage",
  ],
  [
    "15-alice-page-customized-woven.jsonld",
    "generated Alice page-definition support resource pages still need manifest coverage",
  ],
  [
    "17-alice-page-main-integrated-woven.jsonld",
    "generated Alice page-main support and mesh support outputs still need manifest coverage",
  ],
  [
    "19-alice-page-artifact-source-woven.jsonld",
    "generated Alice inventory resource page still needs manifest coverage",
  ],
  [
    "21-bob-page-imported-source-woven.jsonld",
    "generated Bob page-source support resource pages still need manifest coverage",
  ],
  [
    "23-root-knop-created-woven.jsonld",
    "generated root and mesh support resource pages still need manifest coverage",
  ],
  [
    "25-root-page-customized-woven.jsonld",
    "generated root page-definition support resource pages still need manifest coverage",
  ],
]);

const manifestNames = corpus.available
  ? await discoverConformanceManifestNames(corpus.manifestsDir)
  : [];

Deno.test({
  name:
    "mesh-alice-bio manifest discovery covers explicit known-incomplete list",
  ignore: !corpus.available,
  fn() {
    assert(manifestNames.length > 0);
    const manifestNameSet = new Set(manifestNames);
    const missingKnownIncomplete = [...knownIncompleteManifests.keys()]
      .filter((manifestName) => !manifestNameSet.has(manifestName));

    assertEquals(missingKnownIncomplete, []);
  },
});

for (const manifestName of manifestNames) {
  Deno.test({
    name: `accord check smokes mesh-alice-bio manifest ${manifestName}`,
    async fn() {
      const manifestPath = join(corpus.manifestsDir, manifestName);
      const replayManifest = await materializeReplayBranchManifest(
        manifestPath,
      );

      try {
        const result = await runAccordCli([
          "check",
          replayManifest.path,
          "--fixture-repo-path",
          corpus.fixtureRepoPath,
          "--format",
          "json",
        ]);
        const report = JSON.parse(result.stdout) as JsonReport;
        const knownIncompleteReason = knownIncompleteManifests.get(
          manifestName,
        );

        assertEquals(result.stderr.trim(), "");
        assertEquals(report.manifestPath, replayManifest.path);
        assertEquals(report.fixtureRepoPath, corpus.fixtureRepoPath);

        if (knownIncompleteReason !== undefined) {
          assertKnownIncompleteManifestStillFails({
            manifestName,
            reason: knownIncompleteReason,
            resultCode: result.code,
            report,
          });
        } else {
          assertManifestPassed({
            manifestName,
            resultCode: result.code,
            report,
          });
        }
      } finally {
        await Deno.remove(replayManifest.directory, { recursive: true });
      }
    },
  });
}

interface ReplayBranchManifest {
  directory: string;
  path: string;
}

async function discoverConformanceManifestNames(
  manifestsDir: string,
): Promise<string[]> {
  const manifestNames: string[] = [];

  for await (const entry of Deno.readDir(manifestsDir)) {
    if (entry.isFile && entry.name.endsWith(".jsonld")) {
      manifestNames.push(entry.name);
    }
  }

  return manifestNames.sort();
}

async function materializeReplayBranchManifest(
  sourceManifestPath: string,
): Promise<ReplayBranchManifest> {
  const document = JSON.parse(
    await Deno.readTextFile(sourceManifestPath),
  ) as {
    hasCase?: Array<{
      fromRef?: string;
      toRef?: string;
    }>;
  };

  for (const transitionCase of document.hasCase ?? []) {
    transitionCase.fromRef = replayBranchRef(transitionCase.fromRef);
    transitionCase.toRef = replayBranchRef(transitionCase.toRef);
  }

  const directory = await Deno.makeTempDir({
    prefix: "accord-mesh-alice-bio-",
  });
  const path = join(directory, basename(sourceManifestPath));

  try {
    await Deno.writeTextFile(path, `${JSON.stringify(document, null, 2)}\n`);
  } catch (error) {
    await Deno.remove(directory, { recursive: true });
    throw error;
  }

  return { directory, path };
}

function replayBranchRef(ref: string | undefined): string | undefined {
  if (ref === undefined || ref.startsWith("a.") || !/^\d{2}-/.test(ref)) {
    return ref;
  }

  return `a.${ref}`;
}

function assertManifestPassed(
  options: {
    manifestName: string;
    resultCode: number;
    report: JsonReport;
  },
): void {
  assertEquals(options.resultCode, 0, options.manifestName);
  assertEquals(options.report.status, "pass", options.manifestName);
  assertEquals(options.report.summary.fail, 0, options.manifestName);
  assertEquals(options.report.summary.error, 0, options.manifestName);
  assertEquals(
    options.report.checks.length,
    options.report.summary.pass,
    options.manifestName,
  );
  assert(
    options.report.checks.every((check) => check.status === "pass"),
    options.manifestName,
  );
}

function assertKnownIncompleteManifestStillFails(
  options: {
    manifestName: string;
    reason: string;
    resultCode: number;
    report: JsonReport;
  },
): void {
  const message =
    `${options.manifestName} is allowlisted as known incomplete: ${options.reason}`;

  assertEquals(options.resultCode, 1, message);
  assertEquals(options.report.status, "fail", message);
  assert(
    options.report.summary.fail + options.report.summary.error > 0,
    message,
  );
  assert(
    options.report.checks.some((check) => check.status !== "pass"),
    message,
  );
}
