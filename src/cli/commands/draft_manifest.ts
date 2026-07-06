import { renderDraftManifest } from "../../draft/manifest.ts";
import { readGitNameStatusDiff } from "../../git/diff.ts";
import { GitAccessError, resolveGitRepositoryRoot } from "../../git/repo.ts";
import type { DraftManifestCommand } from "../parse_args.ts";

const encoder = new TextEncoder();

export async function handleDraftManifestCommand(
  command: DraftManifestCommand,
): Promise<number> {
  try {
    const repoPath = await resolveDraftFixtureRepoPath(command.fixtureRepoPath);
    const changes = await readGitNameStatusDiff(
      repoPath,
      command.fromRef,
      command.toRef,
    );
    const manifestText = renderDraftManifest({
      fromRef: command.fromRef,
      toRef: command.toRef,
      changes,
    });

    if (command.outPath === undefined) {
      await Deno.stdout.write(encoder.encode(manifestText));
      return 0;
    }

    await writeDraftManifestFile(
      command.outPath,
      manifestText,
      command.force,
    );
    return 0;
  } catch (error) {
    if (
      error instanceof DraftManifestError ||
      error instanceof GitAccessError ||
      error instanceof Deno.errors.NotFound
    ) {
      console.error(error.message);
      return 2;
    }

    throw error;
  }
}

class DraftManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftManifestError";
  }
}

async function resolveDraftFixtureRepoPath(
  fixtureRepoPath: string | undefined,
): Promise<string> {
  const candidatePath = fixtureRepoPath ?? Deno.cwd();

  try {
    return await resolveGitRepositoryRoot(candidatePath);
  } catch (error) {
    if (
      error instanceof GitAccessError || error instanceof Deno.errors.NotFound
    ) {
      throw new DraftManifestError(
        `Fixture repository not found or not a git repository: ${candidatePath}`,
      );
    }

    throw error;
  }
}

async function writeDraftManifestFile(
  outPath: string,
  manifestText: string,
  force: boolean,
): Promise<void> {
  try {
    await Deno.writeTextFile(outPath, manifestText, {
      create: true,
      createNew: !force,
    });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      throw new DraftManifestError(
        `Refusing to overwrite existing output path without --force: ${outPath}`,
      );
    }

    throw error;
  }
}
