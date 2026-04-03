export class GitAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitAccessError";
  }
}

export async function runGitCommand(
  repoPath: string,
  args: string[],
): Promise<string> {
  const command = new Deno.Command("git", {
    args: ["-C", repoPath, ...args],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new GitAccessError(
      stderr === "" ? `git ${args.join(" ")} failed` : stderr,
    );
  }

  return new TextDecoder().decode(result.stdout).trim();
}

export async function resolveGitRepositoryRoot(path: string): Promise<string> {
  return await runGitCommand(path, ["rev-parse", "--show-toplevel"]);
}
