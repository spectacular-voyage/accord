import { CHECK_CODES, CheckCode } from "../report/codes.ts";
import { ManifestDocument, TransitionCase } from "./model.ts";

export class CaseSelectionError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "CaseSelectionError";
    this.code = code;
  }
}

export function selectTransitionCase(
  manifest: ManifestDocument,
  selectedCaseId?: string,
): TransitionCase {
  const cases = manifest.hasCase ?? [];

  if (selectedCaseId !== undefined) {
    const match = cases.find((candidate) => {
      return candidate.id === selectedCaseId ||
        resolveCaseIdentifier(manifest, candidate) === selectedCaseId;
    });

    if (match === undefined) {
      throw new CaseSelectionError(
        CHECK_CODES.CASE_NOT_FOUND,
        `Case not found: ${selectedCaseId}`,
      );
    }

    return match;
  }

  if (cases.length === 1) {
    return cases[0];
  }

  if (cases.length === 0) {
    throw new CaseSelectionError(
      CHECK_CODES.CASE_SELECTION_REQUIRED,
      "Manifest does not contain any cases.",
    );
  }

  throw new CaseSelectionError(
    CHECK_CODES.CASE_SELECTION_REQUIRED,
    "Case selection is required because the manifest contains multiple cases.",
  );
}

function resolveCaseIdentifier(
  manifest: ManifestDocument,
  transitionCase: TransitionCase,
): string | undefined {
  if (transitionCase.id === undefined) {
    return undefined;
  }

  if (transitionCase.id.startsWith("#") && manifest.id !== undefined) {
    return `${manifest.id}${transitionCase.id}`;
  }

  return transitionCase.id;
}
