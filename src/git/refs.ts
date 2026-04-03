import { GitAccessError, runGitCommand } from "./repo.ts";

export async function gitRefExists(
  repoPath: string,
  ref: string,
): Promise<boolean> {
  try {
    await runGitCommand(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`]);
    return true;
  } catch (error) {
    if (error instanceof GitAccessError) {
      return false;
    }

    throw error;
  }
}
