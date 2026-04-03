import { runCli } from "./mod.ts";

if (import.meta.main) {
  const exitCode = await runCli(Deno.args);
  Deno.exit(exitCode);
}
