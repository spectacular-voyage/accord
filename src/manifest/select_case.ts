import { ManifestDocument, TransitionCase } from "./model.ts";

export class CaseSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseSelectionError";
  }
}

export function selectTransitionCase(
  manifest: ManifestDocument,
  selectedCaseId?: string,
): TransitionCase {
  const cases = manifest.hasCase ?? [];

  if (selectedCaseId !== undefined) {
    const match = cases.find((candidate) => candidate.id === selectedCaseId);

    if (match === undefined) {
      throw new CaseSelectionError(`Case not found: ${selectedCaseId}`);
    }

    return match;
  }

  if (cases.length === 1) {
    return cases[0];
  }

  if (cases.length === 0) {
    throw new CaseSelectionError("Manifest does not contain any cases.");
  }

  throw new CaseSelectionError(
    "Case selection is required because the manifest contains multiple cases.",
  );
}
