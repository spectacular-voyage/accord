import { fromFileUrl, join } from "@std/path";

interface RepoRefDefinition {
  name: string;
  empty?: boolean;
  description?: string;
}

interface RepoFixtureDefinition {
  id: string;
  refs: RepoRefDefinition[];
}

export interface MaterializedRepo {
  fixtureId: string;
  repoPath: string;
  refs: string[];
}

const EMPTY_REF_SENTINEL = ".accord-empty-ref";
const repoRoot = fromFileUrl(new URL("../../", import.meta.url));

export async function materializeRepoFixture(
  fixtureId: string,
  options: { parentDir?: string } = {},
): Promise<MaterializedRepo> {
  const sourceRoot = join(repoRoot, "testdata", "repos", fixtureId);
  const fixture = await readRepoFixtureDefinition(sourceRoot);
  const repoPath = await Deno.makeTempDir({
    dir: options.parentDir,
    prefix: `accord-${fixtureId}-`,
  });

  await git(repoPath, ["init"]);
  await git(repoPath, ["config", "user.name", "Accord Test Harness"]);
  await git(repoPath, ["config", "user.email", "accord-test@example.invalid"]);

  for (const ref of fixture.refs) {
    const snapshotPath = join(sourceRoot, "refs", ref.name);
    await resetWorkingTree(repoPath);
    await copySnapshotTree(snapshotPath, repoPath);
    await git(repoPath, ["add", "-A"]);
    await git(repoPath, [
      "commit",
      "--allow-empty",
      "-m",
      `fixture ${fixtureId} ${ref.name}`,
    ]);
    await git(repoPath, ["tag", "-f", ref.name]);
  }

  return {
    fixtureId,
    repoPath,
    refs: fixture.refs.map((ref) => ref.name),
  };
}

async function readRepoFixtureDefinition(
  sourceRoot: string,
): Promise<RepoFixtureDefinition> {
  const rawText = await Deno.readTextFile(join(sourceRoot, "repo.json"));
  return JSON.parse(rawText) as RepoFixtureDefinition;
}

async function resetWorkingTree(repoPath: string): Promise<void> {
  for await (const entry of Deno.readDir(repoPath)) {
    if (entry.name === ".git") {
      continue;
    }

    await Deno.remove(join(repoPath, entry.name), { recursive: true });
  }
}

async function copySnapshotTree(
  sourceRoot: string,
  destinationRoot: string,
): Promise<void> {
  for await (const entry of Deno.readDir(sourceRoot)) {
    if (entry.name === EMPTY_REF_SENTINEL) {
      continue;
    }

    const sourcePath = join(sourceRoot, entry.name);
    const destinationPath = join(destinationRoot, entry.name);

    if (entry.isDirectory) {
      await Deno.mkdir(destinationPath, { recursive: true });
      await copySnapshotTree(sourcePath, destinationPath);
      continue;
    }

    if (entry.isFile) {
      await Deno.mkdir(join(destinationPath, ".."), { recursive: true });
      await Deno.copyFile(sourcePath, destinationPath);
    }
  }
}

async function git(repoPath: string, args: string[]): Promise<void> {
  const command = new Deno.Command("git", {
    args: ["-C", repoPath, ...args],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(stderr === "" ? `git ${args.join(" ")} failed` : stderr);
  }
}
