import { ManifestLoadError } from "../../manifest/load_jsonld.ts";
import {
  buildValidationErrorReport,
  type ValidationReport,
} from "../../report/validation_report.ts";
import { renderValidationTextReport } from "../../report/validation_text_report.ts";
import {
  getShippedShapesPath,
  validateManifest,
  ValidationExecutionError,
} from "../../shacl/validate_manifest.ts";
import type { ValidateCommand } from "../parse_args.ts";

export async function handleValidateCommand(
  command: ValidateCommand,
): Promise<number> {
  const report = await validateManifestCommand(command);
  writeValidationReport(command, report);

  switch (report.status) {
    case "conformant":
      return 0;
    case "non_conformant":
      return 1;
    case "error":
      return 2;
  }
}

async function validateManifestCommand(
  command: ValidateCommand,
): Promise<ValidationReport> {
  try {
    return await validateManifest({ manifestPath: command.manifestPath });
  } catch (error) {
    if (error instanceof ManifestLoadError) {
      return buildValidationErrorReport({
        manifestPath: command.manifestPath,
        shapesPath: getShippedShapesPath(),
        code: "manifest_load_error",
        message: error.message,
      });
    }

    if (error instanceof ValidationExecutionError) {
      return buildValidationErrorReport({
        manifestPath: command.manifestPath,
        shapesPath: getShippedShapesPath(),
        code: "shacl_validation_error",
        message: error.message,
      });
    }

    throw error;
  }
}

function writeValidationReport(
  command: ValidateCommand,
  report: ValidationReport,
): void {
  if (command.format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderValidationTextReport(report));
}
