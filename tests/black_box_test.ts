import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { materializeRepoFixture } from "./harness/fixture_materializer.ts";

interface ScenarioIndex {
  id: string;
  scenarios: Array<{
    id: string;
    manifestPath: string;
    repoId: string;
  }>;
}

Deno.test("black-box scenario index references existing manifests and fixtures", async () => {
  const rawIndex = await Deno.readTextFile("testdata/scenarios/black-box.json");
  const index = JSON.parse(rawIndex) as ScenarioIndex;

  assertEquals(index.id, "accord-black-box-v1");
  assert(index.scenarios.length > 0);

  for (const scenario of index.scenarios) {
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
