import { JsonReport } from "./json_report.ts";

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

    const target = check.path ?? check.assertionId ?? "-";
    lines.push(
      `${check.status}: [${check.kind}] ${check.code} target=${target} ${check.message}`,
    );
  }

  return lines.join("\n");
}
