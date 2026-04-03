import { GitAccessError, runGitCommand } from "./repo.ts";

export async function gitBlobExists(
  repoPath: string,
  ref: string,
  relativePath: string,
): Promise<boolean> {
  try {
    await runGitCommand(repoPath, ["cat-file", "-e", `${ref}:${relativePath}`]);
    return true;
  } catch (error) {
    if (error instanceof GitAccessError) {
      return false;
    }

    throw error;
  }
}

export async function readGitBlob(
  repoPath: string,
  ref: string,
  relativePath: string,
): Promise<Uint8Array> {
  const command = new Deno.Command("git", {
    args: ["-C", repoPath, "show", `${ref}:${relativePath}`],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new GitAccessError(
      stderr === "" ? `git show ${ref}:${relativePath} failed` : stderr,
    );
  }

  return result.stdout;
}

export async function readGitBlobText(
  repoPath: string,
  ref: string,
  relativePath: string,
): Promise<string> {
  const blob = await readGitBlob(repoPath, ref, relativePath);
  return new TextDecoder().decode(blob);
}
