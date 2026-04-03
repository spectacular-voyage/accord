import { parseArgs } from "@std/cli/parse-args";

export type OutputFormat = "json" | "text";

export interface HelpCommand {
  kind: "help";
}

export interface CheckCommand {
  kind: "check";
  manifestPath: string;
  caseId?: string;
  fixtureRepoPath?: string;
  format: OutputFormat;
}

export type ParsedCommand = CheckCommand | HelpCommand;

export class CliParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliParseError";
  }
}

export function renderUsage(): string {
  return [
    "Usage:",
    "  accord check <manifest-path> [--case <case-id>] [--fixture-repo-path <path>] [--format <text|json>]",
    "  accord --help",
  ].join("\n");
}

export function parseCliArgs(args: string[]): ParsedCommand {
  const parsed = parseArgs(args, {
    string: ["case", "fixture-repo-path", "format"],
    boolean: ["help"],
    alias: { h: "help" },
    unknown: (argument) => {
      if (argument === "-h" || !argument.startsWith("-")) {
        return true;
      }

      throw new CliParseError(`Unknown argument: ${argument}`);
    },
  });

  const positionals = parsed._.map(String);
  const [subcommand, ...rest] = positionals;

  if (parsed.help || subcommand === undefined) {
    return { kind: "help" };
  }

  if (subcommand !== "check") {
    throw new CliParseError(`Unknown command: ${subcommand}`);
  }

  if (rest.length !== 1) {
    throw new CliParseError(
      "The check command requires exactly one manifest path.",
    );
  }

  const format = parseOutputFormat(parsed.format);

  return {
    kind: "check",
    manifestPath: rest[0],
    caseId: parsed.case,
    fixtureRepoPath: parsed["fixture-repo-path"],
    format,
  };
}

function parseOutputFormat(rawFormat: string | undefined): OutputFormat {
  if (rawFormat === undefined) {
    return "text";
  }

  if (rawFormat === "json" || rawFormat === "text") {
    return rawFormat;
  }

  throw new CliParseError(
    `Unsupported output format: ${rawFormat}. Expected "text" or "json".`,
  );
}
