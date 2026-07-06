import type { JsonReport, ReportStatus, ReportSummary } from "./json_report.ts";

export interface ScenarioStepWarning {
  code: "lane_bindings_ignored";
  message: string;
}

export interface ScenarioStepReport {
  stepId: string;
  index: number;
  manifestPath: string;
  caseId?: string;
  fromRef?: string;
  toRef?: string;
  warnings: ScenarioStepWarning[];
  report: JsonReport;
}

export interface ScenarioReport {
  scenarioPath: string;
  scenarioId: string;
  fixtureRepoPath: string;
  status: ReportStatus;
  summary: ReportSummary;
  steps: ScenarioStepReport[];
}

export function buildScenarioReport(input: {
  scenarioPath: string;
  scenarioId: string;
  fixtureRepoPath: string;
  steps: ScenarioStepReport[];
}): ScenarioReport {
  const summary = countStepStatuses(input.steps);

  return {
    scenarioPath: input.scenarioPath,
    scenarioId: input.scenarioId,
    fixtureRepoPath: input.fixtureRepoPath,
    status: deriveScenarioStatus(summary),
    summary,
    steps: input.steps,
  };
}

function countStepStatuses(steps: ScenarioStepReport[]): ReportSummary {
  return steps.reduce<ReportSummary>(
    (summary, step) => {
      summary[step.report.status] += 1;
      return summary;
    },
    { pass: 0, fail: 0, error: 0 },
  );
}

function deriveScenarioStatus(summary: ReportSummary): ReportStatus {
  if (summary.error > 0) {
    return "error";
  }

  if (summary.fail > 0) {
    return "fail";
  }

  return "pass";
}
