export type ValidationStatus = "conformant" | "error" | "non_conformant";

export type ValidationErrorCode =
  | "manifest_load_error"
  | "shacl_validation_error";

export interface ValidationResultRecord {
  severity: string;
  focusNode?: string;
  value?: string;
  resultPath?: string;
  sourceShape?: string;
  sourceConstraint?: string;
  sourceConstraintComponent?: string;
  message: string;
}

export interface ValidationCommandError {
  code: ValidationErrorCode;
  message: string;
}

export interface ValidationReport {
  manifestPath: string;
  shapesPath: string;
  status: ValidationStatus;
  conforms: boolean;
  summary: {
    resultCount: number;
    errorCount: number;
  };
  results: ValidationResultRecord[];
  errors?: ValidationCommandError[];
}

export function buildValidationReport(
  input: {
    manifestPath: string;
    shapesPath: string;
    results: ValidationResultRecord[];
  },
): ValidationReport {
  const results = [...input.results].sort(compareValidationResults);

  return {
    manifestPath: input.manifestPath,
    shapesPath: input.shapesPath,
    status: results.length === 0 ? "conformant" : "non_conformant",
    conforms: results.length === 0,
    summary: {
      resultCount: results.length,
      errorCount: 0,
    },
    results,
  };
}

export function buildValidationErrorReport(
  input: {
    manifestPath: string;
    shapesPath: string;
    code: ValidationErrorCode;
    message: string;
  },
): ValidationReport {
  return {
    manifestPath: input.manifestPath,
    shapesPath: input.shapesPath,
    status: "error",
    conforms: false,
    summary: {
      resultCount: 0,
      errorCount: 1,
    },
    results: [],
    errors: [
      {
        code: input.code,
        message: input.message,
      },
    ],
  };
}

function compareValidationResults(
  left: ValidationResultRecord,
  right: ValidationResultRecord,
): number {
  return compareStrings(left.severity, right.severity) ||
    compareStrings(left.focusNode, right.focusNode) ||
    compareStrings(left.resultPath, right.resultPath) ||
    compareStrings(left.sourceShape, right.sourceShape) ||
    compareStrings(left.sourceConstraint, right.sourceConstraint) ||
    compareStrings(
      left.sourceConstraintComponent,
      right.sourceConstraintComponent,
    ) ||
    compareStrings(left.message, right.message) ||
    compareStrings(left.value, right.value);
}

function compareStrings(
  left: string | undefined,
  right: string | undefined,
): number {
  return (left ?? "").localeCompare(right ?? "");
}
