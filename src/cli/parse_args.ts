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

export interface CheckScenarioCommand {
  kind: "check-scenario";
  scenarioIndexPath: string;
  fixtureRepoPath?: string;
  format: OutputFormat;
}

export interface ValidateCommand {
  kind: "validate";
  manifestPath: string;
  format: OutputFormat;
}

export type ParsedCommand =
  | CheckCommand
  | CheckScenarioCommand
  | HelpCommand
  | ValidateCommand;

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
    "  accord check-scenario <scenario-index-path> [--fixture-repo-path <path>] [--format <text|json>]",
    "  accord validate <manifest-path> [--format <text|json>]",
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

  if (
    subcommand !== "check" && subcommand !== "check-scenario" &&
    subcommand !== "validate"
  ) {
    throw new CliParseError(`Unknown command: ${subcommand}`);
  }

  const format = parseOutputFormat(parsed.format);

  if (subcommand === "validate") {
    if (rest.length !== 1) {
      throw new CliParseError(
        "The validate command requires exactly one manifest path.",
      );
    }

    if (
      parsed.case !== undefined || parsed["fixture-repo-path"] !== undefined
    ) {
      throw new CliParseError(
        "The validate command only accepts --format.",
      );
    }

    return {
      kind: "validate",
      manifestPath: rest[0],
      format,
    };
  }

  if (subcommand === "check-scenario") {
    if (rest.length !== 1) {
      throw new CliParseError(
        "The check-scenario command requires exactly one scenario index path.",
      );
    }

    if (parsed.case !== undefined) {
      throw new CliParseError(
        "The check-scenario command only accepts --fixture-repo-path and --format.",
      );
    }

    return {
      kind: "check-scenario",
      scenarioIndexPath: rest[0],
      fixtureRepoPath: parsed["fixture-repo-path"],
      format,
    };
  }

  if (rest.length !== 1) {
    throw new CliParseError(
      "The check command requires exactly one manifest path.",
    );
  }

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
