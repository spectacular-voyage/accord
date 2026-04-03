import { fromFileUrl, join, resolve } from "@std/path";

export interface MeshAliceBioCorpus {
  available: boolean;
  fixtureRepoPath: string;
  manifestsDir: string;
}

const repoRoot = fromFileUrl(new URL("../../", import.meta.url));
const githubDependenciesRoot = resolve(repoRoot, "..", "..");

export async function resolveMeshAliceBioCorpus(): Promise<MeshAliceBioCorpus> {
  const fixtureRepoPath = join(
    githubDependenciesRoot,
    "semantic-flow",
    "mesh-alice-bio",
  );
  const manifestsDir = join(
    githubDependenciesRoot,
    "semantic-flow",
    "semantic-flow-framework",
    "examples",
    "alice-bio",
    "conformance",
  );

  return {
    available: await pathExists(fixtureRepoPath) &&
      await pathExists(manifestsDir),
    fixtureRepoPath,
    manifestsDir,
  };
}

export function conformanceManifestPath(
  corpus: MeshAliceBioCorpus,
  manifestName: string,
): string {
  return join(corpus.manifestsDir, manifestName);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }

    throw error;
  }
}
