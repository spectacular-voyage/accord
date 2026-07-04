import type { ValidationReport } from "./validation_report.ts";

export function renderValidationTextReport(report: ValidationReport): string {
  const lines = [
    `manifest: ${report.manifestPath}`,
    `shapes: ${report.shapesPath}`,
    `status: ${report.status}`,
    `conforms: ${report.conforms}`,
    `summary: results=${report.summary.resultCount} errors=${report.summary.errorCount}`,
  ];

  for (const error of report.errors ?? []) {
    lines.push(`error: [${error.code}] ${error.message}`);
  }

  for (const result of report.results) {
    const focus = result.focusNode ?? "-";
    const path = result.resultPath === undefined
      ? ""
      : ` path=${result.resultPath}`;
    const value = result.value === undefined ? "" : ` value=${result.value}`;

    lines.push(
      `${result.severity}: focus=${focus}${path}${value} ${result.message}`,
    );
  }

  return lines.join("\n");
}
