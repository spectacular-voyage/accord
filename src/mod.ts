/**
 * Accord's public API.
 *
 * @module
 */

export { compareBytes } from "./checker/compare_bytes.ts";
export {
  compareRdfContent,
  detectRdfSyntax,
  parseRdfContent,
  RdfCompareError,
} from "./checker/compare_rdf.ts";
export type {
  CompareRdfContentOptions,
  ParseRdfContentOptions,
} from "./checker/compare_rdf.ts";
export {
  compareTextContents,
  decodeUtf8Text,
  normalizeLineEndings,
  TextDecodeError,
} from "./checker/compare_text.ts";
export { evaluatePresenceExpectation } from "./checker/file_expectations.ts";
export type {
  FileChangeType,
  PresenceEvaluation,
} from "./checker/file_expectations.ts";
export {
  evaluateJsonAssertion,
  evaluateJsonPath,
  JsonAssertionError,
  parseJsonArtifact,
} from "./checker/json_assertions.ts";
export type { JsonAssertionEvaluation } from "./checker/json_assertions.ts";
export {
  buildDraftManifestDocument,
  draftFileExpectations,
  inferCompareMode,
  renderDraftManifest,
} from "./draft/manifest.ts";
export type {
  DraftCompareMode,
  DraftFileExpectation,
  DraftManifestInput,
} from "./draft/manifest.ts";
export { runAskAssertion, SparqlAskError } from "./checker/sparql.ts";
export type { RunAskAssertionOptions } from "./checker/sparql.ts";
export { runScenarioCheck } from "./cli/commands/check_scenario.ts";
export type { ScenarioCheckRunOptions } from "./cli/commands/check_scenario.ts";
export { runCli } from "./cli/router.ts";
export { CliParseError, parseCliArgs, renderUsage } from "./cli/parse_args.ts";
export type {
  CheckCommand,
  CheckScenarioCommand,
  DraftManifestCommand,
  HelpCommand,
  OutputFormat,
  ParsedCommand,
  ValidateCommand,
} from "./cli/parse_args.ts";
export {
  assertContextReferencesAllowed,
  createFileJsonLdDocumentContext,
  createPathMappedJsonLdDocumentContext,
  createSyntheticJsonLdDocumentUrl,
  getTopLevelContext,
  parseJsonSource,
} from "./jsonld/documents.ts";
export type {
  JsonLdDocumentContext,
  JsonLdErrorFactory,
  LoadedJsonLdDocument,
} from "./jsonld/documents.ts";
export { parseGitNameStatusDiff, readGitNameStatusDiff } from "./git/diff.ts";
export type { GitNameStatusChange } from "./git/diff.ts";
export {
  ManifestLoadError,
  readManifestRdfSource,
  readManifestSource,
} from "./manifest/load_jsonld.ts";
export type {
  LoadedManifestRdfSource,
  LoadedManifestSource,
} from "./manifest/load_jsonld.ts";
export type {
  CommandInvocation,
  EnvironmentOverride,
  FileExpectation,
  FileOperation,
  InputMaterialization,
  JsonAssertion,
  JsonExpectation,
  JsonScalar,
  ManifestDocument,
  RdfExpectation,
  ReplayProfile,
  SourceProvenance,
  SparqlAskAssertion,
  StateLocator,
  TransitionCase,
} from "./manifest/model.ts";
export {
  CaseSelectionError,
  selectTransitionCase,
} from "./manifest/select_case.ts";
export {
  readScenarioIndexSource,
  ScenarioIndexLoadError,
  ScenarioIndexValidationError,
  validateScenarioIndexDocument,
} from "./scenario/load_jsonld.ts";
export type {
  LoadedScenarioIndexSource,
  ScenarioIndexValidationOptions,
} from "./scenario/load_jsonld.ts";
export type {
  LaneStateBinding,
  ScenarioIndexDocument,
  ScenarioStep,
  StateLane,
} from "./scenario/model.ts";
export { CHECK_CODES } from "./report/codes.ts";
export type { CheckCode } from "./report/codes.ts";
export {
  countCheckStatuses,
  deriveReportStatus,
} from "./report/json_report.ts";
export type {
  CheckKind,
  CheckRecord,
  CheckStatus,
  JsonReport,
  ReportStatus,
  ReportSummary,
} from "./report/json_report.ts";
export { buildScenarioReport } from "./report/scenario_report.ts";
export type {
  ScenarioReport,
  ScenarioStepReport,
  ScenarioStepWarning,
} from "./report/scenario_report.ts";
export { renderScenarioTextReport } from "./report/scenario_text_report.ts";
export { renderTextReport } from "./report/text_report.ts";
export {
  buildValidationErrorReport,
  buildValidationReport,
} from "./report/validation_report.ts";
export type {
  ValidationCommandError,
  ValidationErrorCode,
  ValidationReport,
  ValidationResultRecord,
  ValidationStatus,
} from "./report/validation_report.ts";
export { renderValidationTextReport } from "./report/validation_text_report.ts";
export {
  getShippedShapesPath,
  validateManifest,
  ValidationExecutionError,
} from "./shacl/validate_manifest.ts";
export type { ValidateManifestOptions } from "./shacl/validate_manifest.ts";
