import { assertEquals } from "@std/assert";
import { gitBlobExists, readGitBlobText } from "../src/git/blobs.ts";
import { resolveGitRepositoryRoot } from "../src/git/repo.ts";
import { gitRefExists } from "../src/git/refs.ts";
import { materializeRepoFixture } from "./harness/fixture_materializer.ts";

Deno.test("git helpers resolve refs and blobs inside a materialized fixture repo", async () => {
  const materialized = await materializeRepoFixture("repo-files");

  try {
    const repoRoot = await resolveGitRepositoryRoot(materialized.repoPath);
    assertEquals(repoRoot, materialized.repoPath);
    assertEquals(await gitRefExists(repoRoot, "r1-bytes-a"), true);
    assertEquals(await gitRefExists(repoRoot, "r9-missing"), false);
    assertEquals(
      await gitBlobExists(repoRoot, "r1-bytes-a", "artifact.bin"),
      true,
    );
    assertEquals(
      await gitBlobExists(repoRoot, "r0-empty", "artifact.bin"),
      false,
    );
    assertEquals(
      await readGitBlobText(repoRoot, "r1-bytes-a", "artifact.bin"),
      "artifact-a-001\n",
    );
  } finally {
    await Deno.remove(materialized.repoPath, { recursive: true });
  }
});
