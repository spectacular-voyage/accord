import { dirname, fromFileUrl, join } from "@std/path";

export interface CliRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function runAccordCli(
  args: string[],
  options: { cwd?: string } = {},
): Promise<CliRunResult> {
  const harnessDir = dirname(fromFileUrl(import.meta.url));
  const repoRoot = join(harnessDir, "..", "..");
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "src/main.ts", ...args],
    cwd: options.cwd ?? repoRoot,
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();

  return {
    code: result.code,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}
