import type { CheckRecord } from "./json_report.ts";
import type { ScenarioReport, ScenarioStepReport } from "./scenario_report.ts";

export function renderScenarioTextReport(report: ScenarioReport): string {
  const lines = [
    `scenario: ${report.scenarioPath}`,
    `scenario id: ${report.scenarioId}`,
    `fixture repo: ${report.fixtureRepoPath}`,
    `status: ${report.status}`,
    `summary: pass=${report.summary.pass} fail=${report.summary.fail} error=${report.summary.error}`,
  ];

  for (const step of report.steps) {
    lines.push("", renderStepHeader(step));

    if (step.caseId !== undefined && step.caseId !== "") {
      lines.push(`  case: ${step.caseId}`);
    }

    if (step.fromRef !== undefined || step.toRef !== undefined) {
      lines.push(
        `  transition: ${step.fromRef ?? "-"} -> ${step.toRef ?? "-"}`,
      );
    }

    for (const warning of step.warnings) {
      lines.push(`  warning: [${warning.code}] ${warning.message}`);
    }

    lines.push(
      `  status: ${step.report.status}`,
      `  summary: pass=${step.report.summary.pass} fail=${step.report.summary.fail} error=${step.report.summary.error}`,
    );

    for (const check of step.report.checks) {
      if (check.status === "pass") {
        continue;
      }

      lines.push(`  ${renderCheckDiagnosticLine(check)}`);
    }
  }

  return lines.join("\n");
}

function renderStepHeader(step: ScenarioStepReport): string {
  return `step ${step.index + 1}: ${step.stepId} (${step.manifestPath})`;
}

function renderCheckDiagnosticLine(check: CheckRecord): string {
  const target = check.path ?? check.assertionId ?? "-";
  return `${check.status}: [${check.kind}] ${check.code} target=${target} ${check.message}`;
}
