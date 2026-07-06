import type { CheckRecord, JsonReport } from "./json_report.ts";

export function renderTextReport(report: JsonReport): string {
  const lines = [
    `manifest: ${report.manifestPath}`,
    `case: ${report.caseId}`,
    `fixture repo: ${report.fixtureRepoPath}`,
    `status: ${report.status}`,
    `summary: pass=${report.summary.pass} fail=${report.summary.fail} error=${report.summary.error}`,
  ];

  for (const check of report.checks) {
    if (check.status === "pass") {
      continue;
    }

    lines.push(
      `${check.status}: [${check.kind}] ${check.code} target=${
        formatCheckTarget(check)
      } ${check.message}`,
    );
  }

  return lines.join("\n");
}

export function formatCheckTarget(check: CheckRecord): string {
  return check.path !== undefined && check.jsonPath !== undefined
    ? `${check.path} ${check.jsonPath}`
    : check.path ?? check.assertionId ?? "-";
}
