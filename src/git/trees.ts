import { GitAccessError } from "./repo.ts";

export interface GitTreeBlob {
  path: string;
  objectId: string;
}

export async function listGitTreeBlobs(
  repoPath: string,
  ref: string,
): Promise<GitTreeBlob[]> {
  const command = new Deno.Command("git", {
    args: ["-C", repoPath, "ls-tree", "-r", "-z", "--full-tree", ref],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new GitAccessError(
      stderr === "" ? `git ls-tree ${ref} failed` : stderr,
    );
  }

  const output = new TextDecoder().decode(result.stdout);
  const entries = output.split("\0").filter((entry) => entry !== "");

  return entries.flatMap((entry) => {
    const match = entry.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
    if (match === null) {
      return [];
    }

    return [{ objectId: match[1], path: match[2] }];
  });
}
