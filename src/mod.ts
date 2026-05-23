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
export { runAskAssertion, SparqlAskError } from "./checker/sparql.ts";
export type { RunAskAssertionOptions } from "./checker/sparql.ts";
export { runCli } from "./cli/router.ts";
export { CliParseError, parseCliArgs, renderUsage } from "./cli/parse_args.ts";
export type {
  CheckCommand,
  HelpCommand,
  OutputFormat,
  ParsedCommand,
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
export {
  ManifestLoadError,
  readManifestSource,
} from "./manifest/load_jsonld.ts";
export type { LoadedManifestSource } from "./manifest/load_jsonld.ts";
export type {
  CommandInvocation,
  EnvironmentOverride,
  FileExpectation,
  FileOperation,
  InputMaterialization,
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
export { renderTextReport } from "./report/text_report.ts";
