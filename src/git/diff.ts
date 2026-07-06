import { GitAccessError } from "./repo.ts";

export type GitNameStatusChange =
  | { status: "A" | "D" | "M" | "T"; path: string }
  | { status: "R"; oldPath: string; newPath: string };

export async function readGitNameStatusDiff(
  repoPath: string,
  fromRef: string,
  toRef: string,
): Promise<GitNameStatusChange[]> {
  const command = new Deno.Command("git", {
    args: [
      "-C",
      repoPath,
      "diff",
      "--name-status",
      "--find-renames",
      "-z",
      fromRef,
      toRef,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new GitAccessError(
      stderr === ""
        ? `git diff --name-status ${fromRef} ${toRef} failed`
        : stderr,
    );
  }

  return parseGitNameStatusDiff(new TextDecoder().decode(result.stdout));
}

export function parseGitNameStatusDiff(
  output: string,
): GitNameStatusChange[] {
  const fields = output.split("\0").filter((field) => field !== "");
  const changes: GitNameStatusChange[] = [];
  let index = 0;

  while (index < fields.length) {
    const status = fields[index++];

    if (
      status === "A" || status === "D" || status === "M" || status === "T"
    ) {
      const path = fields[index++];
      if (path === undefined) {
        throw new GitAccessError(
          `Unparsable git diff --name-status output: missing path for ${status}.`,
        );
      }
      changes.push({ status, path });
      continue;
    }

    if (status.startsWith("R")) {
      const oldPath = fields[index++];
      const newPath = fields[index++];
      if (oldPath === undefined || newPath === undefined) {
        throw new GitAccessError(
          `Unparsable git diff --name-status output: missing rename paths for ${status}.`,
        );
      }
      changes.push({ status: "R", oldPath, newPath });
      continue;
    }

    throw new GitAccessError(
      `Unsupported git diff --name-status code: ${status}`,
    );
  }

  return changes;
}
