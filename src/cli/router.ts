import { CliParseError, parseCliArgs, renderUsage } from "./parse_args.ts";
import { handleCheckCommand } from "./commands/check.ts";
import { handleValidateCommand } from "./commands/validate.ts";

export async function runCli(args: string[]): Promise<number> {
  try {
    const command = parseCliArgs(args);

    if (command.kind === "help") {
      console.log(renderUsage());
      return 0;
    }

    if (command.kind === "check") {
      return await handleCheckCommand(command);
    }

    return await handleValidateCommand(command);
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
