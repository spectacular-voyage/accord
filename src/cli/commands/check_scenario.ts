import { dirname, isAbsolute, resolve } from "@std/path";
import { exitCodeForStatus, runSingleCheck } from "./check.ts";
import { CHECK_CODES, type CheckCode } from "../../report/codes.ts";
import {
  type CheckRecord,
  countCheckStatuses,
  deriveReportStatus,
  type JsonReport,
} from "../../report/json_report.ts";
import {
  buildScenarioReport,
  type ScenarioReport,
  type ScenarioStepReport,
  type ScenarioStepWarning,
} from "../../report/scenario_report.ts";
import { renderScenarioTextReport } from "../../report/scenario_text_report.ts";
import {
  readScenarioIndexSource,
  ScenarioIndexLoadError,
} from "../../scenario/load_jsonld.ts";
import type { ScenarioStep } from "../../scenario/model.ts";
import type { CheckScenarioCommand } from "../parse_args.ts";

const LANE_BINDINGS_IGNORED_WARNING: ScenarioStepWarning = {
  code: "lane_bindings_ignored",
  message:
    "Lane bindings are loaded as topology metadata but are not used for execution in this runner slice.",
};

export interface ScenarioCheckRunOptions {
  scenarioIndexPath: string;
  fixtureRepoPath?: string;
}

export async function handleCheckScenarioCommand(
  command: CheckScenarioCommand,
): Promise<number> {
  const report = await runScenarioCheck({
    scenarioIndexPath: command.scenarioIndexPath,
    fixtureRepoPath: command.fixtureRepoPath,
  });
  writeScenarioReport(command, report);
  return exitCodeForStatus(report.status);
}

export async function runScenarioCheck(
  options: ScenarioCheckRunOptions,
): Promise<ScenarioReport> {
  try {
    const loaded = await readScenarioIndexSource(options.scenarioIndexPath);
    const scenarioDir = dirname(resolve(options.scenarioIndexPath));
    const fixtureRepoCandidate = resolveFixtureRepoCandidate({
      fixtureRepoPathOverride: options.fixtureRepoPath,
      defaultFixtureRepo: loaded.document.defaultFixtureRepo,
      scenarioDir,
    });
    const steps = await runScenarioSteps({
      scenarioDir,
      fixtureRepoCandidate,
      steps: loaded.document.hasStep ?? [],
    });
    const fixtureRepoPath = steps[0]?.report.fixtureRepoPath ??
      fixtureRepoCandidate ?? Deno.cwd();

    return buildScenarioReport({
      scenarioPath: options.scenarioIndexPath,
      scenarioId: loaded.document.id ?? loaded.document.resolvedId ?? "",
      fixtureRepoPath,
      steps,
    });
  } catch (error) {
    if (error instanceof ScenarioIndexLoadError) {
      return buildScenarioSetupErrorReport({
        scenarioPath: options.scenarioIndexPath,
        fixtureRepoPath: options.fixtureRepoPath ?? "",
        code: error.code,
        message: error.message,
      });
    }

    throw error;
  }
}

async function runScenarioSteps(options: {
  scenarioDir: string;
  fixtureRepoCandidate?: string;
  steps: ScenarioStep[];
}): Promise<ScenarioStepReport[]> {
  const stepReports: ScenarioStepReport[] = [];

  for (const [index, step] of options.steps.entries()) {
    const stepId = step.id ?? step.resolvedId ?? `#step-${index + 1}`;
    const warnings = scenarioStepWarnings(step);

    if (step.manifestPath === undefined || step.manifestPath.trim() === "") {
      const report = buildSingleCheckSetupErrorReport({
        manifestPath: "",
        caseId: step.caseId ?? "",
        fixtureRepoPath: options.fixtureRepoCandidate ?? "",
        code: CHECK_CODES.MANIFEST_LOAD_ERROR,
        message: `Scenario step ${stepId} must declare manifestPath.`,
      });
      stepReports.push({
        stepId,
        index,
        manifestPath: "",
        caseId: step.caseId,
        warnings,
        report,
      });
      continue;
    }

    const manifestPath = resolveScenarioManifestPath(
      options.scenarioDir,
      step.manifestPath,
    );
    const result = await runSingleCheck({
      manifestPath,
      caseId: step.caseId,
      fixtureRepoPath: options.fixtureRepoCandidate,
    });

    stepReports.push({
      stepId,
      index,
      manifestPath,
      caseId: result.report.caseId,
      fromRef: result.transitionCase?.fromRef,
      toRef: result.transitionCase?.toRef,
      warnings,
      report: result.report,
    });
  }

  return stepReports;
}

function resolveFixtureRepoCandidate(options: {
  fixtureRepoPathOverride?: string;
  defaultFixtureRepo?: string;
  scenarioDir: string;
}): string | undefined {
  if (options.fixtureRepoPathOverride !== undefined) {
    return options.fixtureRepoPathOverride;
  }

  if (
    options.defaultFixtureRepo === undefined ||
    options.defaultFixtureRepo.trim() === ""
  ) {
    return undefined;
  }

  if (isAbsolute(options.defaultFixtureRepo)) {
    return options.defaultFixtureRepo;
  }

  return resolve(options.scenarioDir, options.defaultFixtureRepo);
}

function resolveScenarioManifestPath(
  scenarioDir: string,
  manifestPath: string,
): string {
  if (isAbsolute(manifestPath)) {
    return manifestPath;
  }

  return resolve(scenarioDir, manifestPath);
}

function scenarioStepWarnings(step: ScenarioStep): ScenarioStepWarning[] {
  return (step.hasLaneBinding?.length ?? 0) === 0
    ? []
    : [LANE_BINDINGS_IGNORED_WARNING];
}

function buildSingleCheckSetupErrorReport(input: {
  manifestPath: string;
  caseId: string;
  fixtureRepoPath: string;
  code: CheckCode;
  message: string;
}): JsonReport {
  const checks: CheckRecord[] = [
    {
      kind: "setup",
      status: "error",
      code: input.code,
      message: input.message,
    },
  ];

  return {
    manifestPath: input.manifestPath,
    caseId: input.caseId,
    fixtureRepoPath: input.fixtureRepoPath,
    status: deriveReportStatus(checks),
    summary: countCheckStatuses(checks),
    checks,
  };
}

function buildScenarioSetupErrorReport(input: {
  scenarioPath: string;
  fixtureRepoPath: string;
  code: CheckCode;
  message: string;
}): ScenarioReport {
  const step: ScenarioStepReport = {
    stepId: "#scenario-setup",
    index: 0,
    manifestPath: "",
    warnings: [],
    report: buildSingleCheckSetupErrorReport({
      manifestPath: "",
      caseId: "",
      fixtureRepoPath: input.fixtureRepoPath,
      code: input.code,
      message: input.message,
    }),
  };

  return buildScenarioReport({
    scenarioPath: input.scenarioPath,
    scenarioId: "",
    fixtureRepoPath: input.fixtureRepoPath,
    steps: [step],
  });
}

function writeScenarioReport(
  command: CheckScenarioCommand,
  report: ScenarioReport,
): void {
  if (command.format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderScenarioTextReport(report));
}
