import { CheckCommand } from "../parse_args.ts";

export async function handleCheckCommand(
  command: CheckCommand,
): Promise<number> {
  try {
    await Deno.stat(command.manifestPath);
  } catch {
    console.error(`Manifest not found: ${command.manifestPath}`);
    return 2;
  }

  console.error(
    "accord check is scaffolded but not implemented yet.",
  );
  return 2;
}
