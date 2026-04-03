import { CliParseError, parseCliArgs, renderUsage } from "./parse_args.ts";
import { handleCheckCommand } from "./commands/check.ts";

export async function runCli(args: string[]): Promise<number> {
  try {
    const command = parseCliArgs(args);

    if (command.kind === "help") {
      console.log(renderUsage());
      return 0;
    }

    return await handleCheckCommand(command);
  } catch (error) {
    if (error instanceof CliParseError) {
      console.error(error.message);
      console.error("");
      console.error(renderUsage());
      return 2;
    }

    throw error;
  }
}
