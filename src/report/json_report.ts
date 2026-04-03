import { CheckCode } from "./codes.ts";

export type CheckKind =
  | "file_compare"
  | "file_presence"
  | "rdf_compare"
  | "setup"
  | "sparql_ask";

export type CheckStatus = "error" | "fail" | "pass";
export type ReportStatus = CheckStatus;

export interface CheckRecord {
  kind: CheckKind;
  status: CheckStatus;
  code: CheckCode;
  message: string;
  path?: string;
  assertionId?: string;
}

export interface ReportSummary {
  pass: number;
  fail: number;
  error: number;
}

export interface JsonReport {
  manifestPath: string;
  caseId: string;
  fixtureRepoPath: string;
  status: ReportStatus;
  summary: ReportSummary;
  checks: CheckRecord[];
}

export function countCheckStatuses(checks: CheckRecord[]): ReportSummary {
  return checks.reduce<ReportSummary>(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { pass: 0, fail: 0, error: 0 },
  );
}

export function deriveReportStatus(checks: CheckRecord[]): ReportStatus {
  if (checks.some((check) => check.status === "error")) {
    return "error";
  }

  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }

  return "pass";
}
