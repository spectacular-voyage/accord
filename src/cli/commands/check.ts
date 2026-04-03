import { compareBytes } from "../../checker/compare_bytes.ts";
import {
  compareTextContents,
  TextDecodeError,
} from "../../checker/compare_text.ts";
import {
  evaluatePresenceExpectation,
  FileChangeType,
} from "../../checker/file_expectations.ts";
import { gitBlobExists, readGitBlob } from "../../git/blobs.ts";
import { gitRefExists } from "../../git/refs.ts";
import { GitAccessError, resolveGitRepositoryRoot } from "../../git/repo.ts";
import { FileExpectation, TransitionCase } from "../../manifest/model.ts";
import {
  ManifestLoadError,
  readManifestSource,
} from "../../manifest/load_jsonld.ts";
import {
  CaseSelectionError,
  selectTransitionCase,
} from "../../manifest/select_case.ts";
import { CHECK_CODES, CheckCode } from "../../report/codes.ts";
import {
  CheckRecord,
  countCheckStatuses,
  deriveReportStatus,
  JsonReport,
} from "../../report/json_report.ts";
import { renderTextReport } from "../../report/text_report.ts";
import { CheckCommand } from "../parse_args.ts";

export async function handleCheckCommand(
  command: CheckCommand,
): Promise<number> {
  let caseId = command.caseId ?? "";
  let fixtureRepoPath = command.fixtureRepoPath ?? "";

  try {
    const manifest = await readManifestSource(command.manifestPath);
    const transitionCase = selectTransitionCase(
      manifest.document,
      command.caseId,
    );
    caseId = transitionCase.id ?? caseId;

    fixtureRepoPath = await resolveFixtureRepoPath(command.fixtureRepoPath);
    await assertRefExists(fixtureRepoPath, transitionCase.fromRef);
    await assertRefExists(fixtureRepoPath, transitionCase.toRef);

    const checks = await evaluateCaseChecks(fixtureRepoPath, transitionCase);
    const report = buildReport({
      manifestPath: command.manifestPath,
      caseId,
      fixtureRepoPath,
      checks,
    });
    writeReport(command, report);
    return exitCodeForStatus(report.status);
  } catch (error) {
    if (
      error instanceof ManifestLoadError ||
      error instanceof CaseSelectionError ||
      error instanceof SetupCheckError
    ) {
      const report = buildReport({
        manifestPath: command.manifestPath,
        caseId,
        fixtureRepoPath,
        checks: [
          {
            kind: "setup",
            status: "error",
            code: error.code,
            message: error.message,
          },
        ],
      });
      writeReport(command, report);
      return 2;
    }

    if (error instanceof Deno.errors.NotFound) {
      console.error(`Manifest not found: ${command.manifestPath}`);
      return 2;
    }

    throw error;
  }
}

class SetupCheckError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "SetupCheckError";
    this.code = code;
  }
}

async function resolveFixtureRepoPath(
  fixtureRepoPathOverride: string | undefined,
): Promise<string> {
  const candidatePath = fixtureRepoPathOverride ?? Deno.cwd();

  try {
    return await resolveGitRepositoryRoot(candidatePath);
  } catch (error) {
    if (
      error instanceof GitAccessError || error instanceof Deno.errors.NotFound
    ) {
      throw new SetupCheckError(
        CHECK_CODES.FIXTURE_REPO_NOT_FOUND,
        `Fixture repository not found or not a git repository: ${candidatePath}`,
      );
    }

    throw error;
  }
}

async function assertRefExists(
  repoPath: string,
  ref: string | undefined,
): Promise<void> {
  if (ref === undefined || ref === "") {
    throw new SetupCheckError(
      CHECK_CODES.GIT_REF_UNRESOLVED,
      "Manifest case is missing fromRef or toRef.",
    );
  }

  if (!await gitRefExists(repoPath, ref)) {
    throw new SetupCheckError(
      CHECK_CODES.GIT_REF_UNRESOLVED,
      `Git ref could not be resolved: ${ref}`,
    );
  }
}

async function evaluateCaseChecks(
  repoPath: string,
  transitionCase: TransitionCase,
): Promise<CheckRecord[]> {
  const checks: CheckRecord[] = [];

  for (const fileExpectation of transitionCase.hasFileExpectation ?? []) {
    const path = fileExpectation.path;
    const changeType = fileExpectation.changeType as FileChangeType | undefined;

    if (path === undefined || changeType === undefined) {
      continue;
    }

    const fromRef = transitionCase.fromRef!;
    const toRef = transitionCase.toRef!;
    const fromExists = await gitBlobExists(repoPath, fromRef, path);
    const toExists = await gitBlobExists(repoPath, toRef, path);
    const presence = evaluatePresenceExpectation(
      changeType,
      fromExists,
      toExists,
    );

    checks.push({
      kind: "file_presence",
      status: presence.passed ? "pass" : "fail",
      code: presence.passed
        ? CHECK_CODES.FILE_PRESENCE_OK
        : CHECK_CODES.FILE_PRESENCE_MISMATCH,
      message: presence.passed
        ? `Path presence matched the ${changeType} expectation.`
        : presence.reason,
      path,
    });

    if (!presence.passed || !requiresComparison(changeType)) {
      continue;
    }

    checks.push(
      await evaluateFileComparison({
        repoPath,
        fromRef,
        toRef,
        fileExpectation,
      }),
    );
  }

  return checks;
}

function requiresComparison(changeType: FileChangeType): boolean {
  return changeType === "updated" || changeType === "unchanged";
}

async function evaluateFileComparison(
  options: {
    repoPath: string;
    fromRef: string;
    toRef: string;
    fileExpectation: FileExpectation;
  },
): Promise<CheckRecord> {
  const { repoPath, fromRef, toRef, fileExpectation } = options;
  const path = fileExpectation.path!;
  const changeType = fileExpectation.changeType as FileChangeType;
  const compareMode = fileExpectation.compareMode;
  const expectationMessage = describeComparisonExpectation(
    changeType,
    compareMode,
  );

  const fromBytes = await readGitBlob(repoPath, fromRef, path);
  const toBytes = await readGitBlob(repoPath, toRef, path);

  if (compareMode === "bytes") {
    const contentsEqual = compareBytes(fromBytes, toBytes);
    return fileComparisonRecord(
      path,
      changeType,
      expectationMessage,
      contentsEqual,
    );
  }

  if (compareMode === "text") {
    try {
      const contentsEqual = compareTextContents(fromBytes, toBytes);
      return fileComparisonRecord(
        path,
        changeType,
        expectationMessage,
        contentsEqual,
      );
    } catch (error) {
      if (error instanceof TextDecodeError) {
        return {
          kind: "file_compare",
          status: "error",
          code: CHECK_CODES.TEXT_DECODE_ERROR,
          message: error.message,
          path,
        };
      }

      throw error;
    }
  }

  throw new Error(
    `Unsupported compare mode for file expectation: ${compareMode}`,
  );
}

function fileComparisonRecord(
  path: string,
  changeType: FileChangeType,
  expectationMessage: string,
  contentsEqual: boolean,
): CheckRecord {
  const passed = changeType === "updated" ? !contentsEqual : contentsEqual;

  return {
    kind: "file_compare",
    status: passed ? "pass" : "fail",
    code: passed
      ? CHECK_CODES.FILE_CONTENT_OK
      : CHECK_CODES.FILE_CONTENT_MISMATCH,
    message: expectationMessage,
    path,
  };
}

function describeComparisonExpectation(
  changeType: FileChangeType,
  compareMode: string | undefined,
): string {
  if (changeType === "updated") {
    return `Expected contents to differ under ${compareMode} comparison.`;
  }

  return `Expected contents to match under ${compareMode} comparison.`;
}

function buildReport(
  input: {
    manifestPath: string;
    caseId: string;
    fixtureRepoPath: string;
    checks: CheckRecord[];
  },
): JsonReport {
  return {
    manifestPath: input.manifestPath,
    caseId: input.caseId,
    fixtureRepoPath: input.fixtureRepoPath,
    status: deriveReportStatus(input.checks),
    summary: countCheckStatuses(input.checks),
    checks: input.checks,
  };
}

function writeReport(command: CheckCommand, report: JsonReport): void {
  if (command.format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderTextReport(report));
}

function exitCodeForStatus(status: JsonReport["status"]): number {
  switch (status) {
    case "pass":
      return 0;
    case "fail":
      return 1;
    case "error":
      return 2;
  }
}
