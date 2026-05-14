export interface SparqlAskAssertion {
  id?: string;
  resolvedId?: string;
  type?: string;
  query?: string;
  expectedBoolean?: boolean;
  [key: string]: unknown;
}

export interface RdfExpectation {
  id?: string;
  resolvedId?: string;
  type?: string;
  targetsFileExpectation?: string;
  ignorePredicate?: string[];
  hasAskAssertion?: SparqlAskAssertion[];
  [key: string]: unknown;
}

export interface FileExpectation {
  id?: string;
  resolvedId?: string;
  type?: string;
  path?: string;
  changeType?: string;
  compareMode?: string;
  [key: string]: unknown;
}

export interface StateLocator {
  id?: string;
  resolvedId?: string;
  type?: string;
  locatorKind?: string;
  ref?: string;
  locatorPath?: string;
  uri?: string;
  contentDigest?: string;
  mediaType?: string;
  [key: string]: unknown;
}

export interface EnvironmentOverride {
  id?: string;
  resolvedId?: string;
  type?: string;
  name?: string;
  value?: string;
  [key: string]: unknown;
}

export interface CommandInvocation {
  id?: string;
  resolvedId?: string;
  type?: string;
  executable?: string;
  argv?: string[];
  workingDirectory?: string;
  promptPolicy?: string;
  expectedExitCode?: number;
  expectsOperationalLogs?: boolean;
  expectsAuditLogs?: boolean;
  hasEnvironmentOverride?: EnvironmentOverride[];
  [key: string]: unknown;
}

export interface SourceProvenance {
  id?: string;
  resolvedId?: string;
  type?: string;
  sourceKind?: string;
  sourcePath?: string;
  sourceRef?: string;
  sourceUrl?: string;
  inlineValue?: string;
  contentDigest?: string;
  mediaType?: string;
  derivationNote?: string;
  derivedFrom?: string;
  nondeterministicSource?: boolean;
  [key: string]: unknown;
}

export interface InputMaterialization {
  id?: string;
  resolvedId?: string;
  type?: string;
  targetPath?: string;
  hasSourceProvenance?: SourceProvenance;
  [key: string]: unknown;
}

export interface FileOperation {
  id?: string;
  resolvedId?: string;
  type?: string;
  operationKind?: string;
  targetPath?: string;
  hasSourceProvenance?: SourceProvenance;
  [key: string]: unknown;
}

export interface ReplayProfile {
  id?: string;
  resolvedId?: string;
  type?: string;
  workspaceRoot?: string;
  meshRoot?: string;
  hasCommandInvocation?: CommandInvocation;
  hasInputMaterialization?: InputMaterialization[];
  hasFileOperation?: FileOperation[];
  [key: string]: unknown;
}

export interface TransitionCase {
  id?: string;
  resolvedId?: string;
  type?: string;
  fixtureRepo?: string;
  operationId?: string;
  fromRef?: string;
  toRef?: string;
  fromState?: StateLocator;
  toState?: StateLocator;
  targetDesignatorPath?: string;
  ignorePaths?: string[];
  hasReplayProfile?: ReplayProfile;
  hasFileExpectation?: FileExpectation[];
  hasRdfExpectation?: RdfExpectation[];
  [key: string]: unknown;
}

export interface ManifestDocument {
  "@context"?: unknown;
  id?: string;
  resolvedId?: string;
  documentUrl?: string;
  type?: string;
  hasCase?: TransitionCase[];
  [key: string]: unknown;
}
