import jsonld from "jsonld";
import {
  assertContextReferencesAllowed,
  createFileJsonLdDocumentContext,
  getTopLevelContext,
  type JsonLdDocumentContext,
  parseJsonSource,
} from "../jsonld/documents.ts";
import { CHECK_CODES, type CheckCode } from "../report/codes.ts";
import type {
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
} from "./model.ts";

const ACCORD_NS = "https://spectacular-voyage.github.io/accord/ns#";

export interface LoadedManifestSource {
  path: string;
  documentUrl: string;
  document: ManifestDocument;
}

export class ManifestLoadError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "ManifestLoadError";
    this.code = code;
  }
}

function createManifestLoadError(code: CheckCode, message: string): Error {
  return new ManifestLoadError(code, message);
}

export async function readManifestSource(
  manifestPath: string,
): Promise<LoadedManifestSource> {
  const documentContext = createFileJsonLdDocumentContext(
    manifestPath,
    createManifestLoadError,
    CHECK_CODES.MANIFEST_LOAD_ERROR,
  );
  const sourceText = await readManifestText(manifestPath, documentContext);
  const rawDocument = parseJsonSource(
    sourceText,
    manifestPath,
    documentContext.documentUrl,
    createManifestLoadError,
    CHECK_CODES.MANIFEST_LOAD_ERROR,
    "JSON manifest document",
  );
  assertContextReferencesAllowed(
    getTopLevelContext(rawDocument),
    createManifestLoadError,
  );
  const expandedDocument = await expandManifest(rawDocument, documentContext);
  const document = mapSourceShapeDocument(
    rawDocument,
    documentContext.documentUrl,
  ) ??
    mapExpandedDocument(expandedDocument, documentContext.documentUrl);

  return {
    path: manifestPath,
    documentUrl: documentContext.documentUrl,
    document,
  };
}

async function readManifestText(
  manifestPath: string,
  documentContext: JsonLdDocumentContext,
): Promise<string> {
  try {
    return await Deno.readTextFile(manifestPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createManifestLoadError(
      CHECK_CODES.MANIFEST_LOAD_ERROR,
      `Failed to read JSON manifest document at ${manifestPath} (${documentContext.documentUrl}): ${message}`,
    );
  }
}

async function expandManifest(
  rawDocument: unknown,
  documentContext: JsonLdDocumentContext,
): Promise<unknown[]> {
  try {
    const expanded = await jsonld.expand(rawDocument, {
      base: documentContext.documentUrl,
      safe: true,
      documentLoader: documentContext.documentLoader,
    });
    return Array.isArray(expanded) ? expanded : [expanded];
  } catch (error) {
    if (error instanceof ManifestLoadError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new ManifestLoadError(
      CHECK_CODES.MANIFEST_LOAD_ERROR,
      `Failed to load JSON-LD manifest: ${message}`,
    );
  }
}

function mapSourceShapeDocument(
  rawDocument: unknown,
  documentUrl: string,
): ManifestDocument | null {
  const manifestNode = findSourceShapeManifestNode(rawDocument);

  if (manifestNode === null) {
    return null;
  }

  return {
    "@context": manifestNode["@context"],
    id: getSourceId(manifestNode),
    resolvedId: resolveIri(getSourceId(manifestNode), documentUrl),
    documentUrl,
    type: getSourceType(manifestNode),
    hasCase: getSourceNodeArray(manifestNode, "hasCase").map((node) =>
      mapSourceTransitionCase(node, documentUrl)
    ),
  };
}

function findSourceShapeManifestNode(
  rawDocument: unknown,
): Record<string, unknown> | null {
  if (isRecord(rawDocument) && "hasCase" in rawDocument) {
    return rawDocument;
  }

  if (Array.isArray(rawDocument)) {
    for (const candidate of rawDocument) {
      if (isRecord(candidate) && "hasCase" in candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function mapSourceTransitionCase(
  source: Record<string, unknown>,
  documentUrl: string,
): TransitionCase {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    fixtureRepo: getSourceString(source, "fixtureRepo"),
    operationId: getSourceString(source, "operationId"),
    fromRef: getSourceString(source, "fromRef"),
    toRef: getSourceString(source, "toRef"),
    fromState: mapOptionalSourceNode(
      source,
      "fromState",
      documentUrl,
      mapSourceStateLocator,
    ),
    toState: mapOptionalSourceNode(
      source,
      "toState",
      documentUrl,
      mapSourceStateLocator,
    ),
    targetDesignatorPath: getSourceString(source, "targetDesignatorPath"),
    ignorePaths: getSourceStringArray(source, "ignorePaths"),
    hasReplayProfile: mapOptionalSourceNode(
      source,
      "hasReplayProfile",
      documentUrl,
      mapSourceReplayProfile,
    ),
    hasFileExpectation: getSourceNodeArray(source, "hasFileExpectation").map((
      node,
    ) => mapSourceFileExpectation(node, documentUrl)),
    hasRdfExpectation: getSourceNodeArray(source, "hasRdfExpectation").map((
      node,
    ) => mapSourceRdfExpectation(node, documentUrl)),
  };
}

function mapSourceFileExpectation(
  source: Record<string, unknown>,
  documentUrl: string,
): FileExpectation {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    path: getSourceString(source, "path"),
    changeType: getSourceString(source, "changeType"),
    compareMode: getSourceString(source, "compareMode"),
  };
}

function mapSourceRdfExpectation(
  source: Record<string, unknown>,
  documentUrl: string,
): RdfExpectation {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    targetsFileExpectation: getSourceString(source, "targetsFileExpectation"),
    ignorePredicate: getSourceStringArray(source, "ignorePredicate"),
    hasAskAssertion: getSourceNodeArray(source, "hasAskAssertion").map((node) =>
      mapSourceAskAssertion(node, documentUrl)
    ),
  };
}

function mapSourceAskAssertion(
  source: Record<string, unknown>,
  documentUrl: string,
): SparqlAskAssertion {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    query: getSourceString(source, "query"),
    expectedBoolean: getSourceBoolean(source, "expectedBoolean"),
  };
}

function mapSourceStateLocator(
  source: Record<string, unknown>,
  documentUrl: string,
): StateLocator {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    locatorKind: getSourceString(source, "locatorKind"),
    ref: getSourceString(source, "ref"),
    locatorPath: getSourceString(source, "locatorPath"),
    uri: getSourceString(source, "uri"),
    contentDigest: getSourceString(source, "contentDigest"),
    mediaType: getSourceString(source, "mediaType"),
  };
}

function mapSourceReplayProfile(
  source: Record<string, unknown>,
  documentUrl: string,
): ReplayProfile {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    workspaceRoot: getSourceString(source, "workspaceRoot"),
    meshRoot: getSourceString(source, "meshRoot"),
    hasCommandInvocation: mapOptionalSourceNode(
      source,
      "hasCommandInvocation",
      documentUrl,
      mapSourceCommandInvocation,
    ),
    hasCommandSequence: getSourceNodeArray(
      source,
      "hasCommandSequence",
    ).map((node) => mapSourceCommandInvocation(node, documentUrl)),
    hasInputMaterialization: getSourceNodeArray(
      source,
      "hasInputMaterialization",
    ).map((node) => mapSourceInputMaterialization(node, documentUrl)),
    hasFileOperation: getSourceNodeArray(source, "hasFileOperation").map((
      node,
    ) => mapSourceFileOperation(node, documentUrl)),
  };
}

function mapSourceCommandInvocation(
  source: Record<string, unknown>,
  documentUrl: string,
): CommandInvocation {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    executable: getSourceString(source, "executable"),
    argv: getSourceStringArray(source, "argv"),
    workingDirectory: getSourceString(source, "workingDirectory"),
    promptPolicy: getSourceString(source, "promptPolicy"),
    expectedExitCode: getSourceNumber(source, "expectedExitCode"),
    expectsOperationalLogs: getSourceBoolean(source, "expectsOperationalLogs"),
    expectsAuditLogs: getSourceBoolean(source, "expectsAuditLogs"),
    hasEnvironmentOverride: getSourceNodeArray(
      source,
      "hasEnvironmentOverride",
    ).map((node) => mapSourceEnvironmentOverride(node, documentUrl)),
  };
}

function mapSourceEnvironmentOverride(
  source: Record<string, unknown>,
  documentUrl: string,
): EnvironmentOverride {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    name: getSourceString(source, "name"),
    value: getSourceString(source, "value"),
  };
}

function mapSourceInputMaterialization(
  source: Record<string, unknown>,
  documentUrl: string,
): InputMaterialization {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    targetPath: getSourceString(source, "targetPath"),
    hasSourceProvenance: mapOptionalSourceNode(
      source,
      "hasSourceProvenance",
      documentUrl,
      mapSourceSourceProvenance,
    ),
  };
}

function mapSourceFileOperation(
  source: Record<string, unknown>,
  documentUrl: string,
): FileOperation {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    operationKind: getSourceString(source, "operationKind"),
    targetPath: getSourceString(source, "targetPath"),
    hasSourceProvenance: mapOptionalSourceNode(
      source,
      "hasSourceProvenance",
      documentUrl,
      mapSourceSourceProvenance,
    ),
  };
}

function mapSourceSourceProvenance(
  source: Record<string, unknown>,
  documentUrl: string,
): SourceProvenance {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    sourceKind: getSourceString(source, "sourceKind"),
    sourcePath: getSourceString(source, "sourcePath"),
    sourceRef: getSourceString(source, "sourceRef"),
    sourceUrl: getSourceString(source, "sourceUrl"),
    inlineValue: getSourceString(source, "inlineValue"),
    contentDigest: getSourceString(source, "contentDigest"),
    mediaType: getSourceString(source, "mediaType"),
    derivationNote: getSourceString(source, "derivationNote"),
    derivedFrom: getSourceString(source, "derivedFrom"),
    nondeterministicSource: getSourceBoolean(source, "nondeterministicSource"),
  };
}

function mapExpandedDocument(
  expandedDocument: unknown[],
  documentUrl: string,
): ManifestDocument {
  const manifestNode = expandedDocument.find((candidate) =>
    getExpandedType(candidate) === "Manifest"
  );

  if (!isRecord(manifestNode)) {
    throw new ManifestLoadError(
      CHECK_CODES.MANIFEST_LOAD_ERROR,
      "Expanded JSON-LD did not contain an Accord Manifest node.",
    );
  }

  return {
    id: getExpandedNodeId(manifestNode),
    resolvedId: getExpandedNodeId(manifestNode),
    documentUrl,
    type: getExpandedType(manifestNode),
    hasCase: getExpandedNodeArray(manifestNode, "hasCase").map((node) =>
      mapExpandedTransitionCase(node)
    ),
  };
}

function mapExpandedTransitionCase(
  source: Record<string, unknown>,
): TransitionCase {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    fixtureRepo: getExpandedString(source, "fixtureRepo"),
    operationId: getExpandedString(source, "operationId"),
    fromRef: getExpandedString(source, "fromRef"),
    toRef: getExpandedString(source, "toRef"),
    fromState: mapOptionalExpandedNode(
      source,
      "fromState",
      mapExpandedStateLocator,
    ),
    toState: mapOptionalExpandedNode(
      source,
      "toState",
      mapExpandedStateLocator,
    ),
    targetDesignatorPath: getExpandedString(source, "targetDesignatorPath"),
    ignorePaths: getExpandedStringArray(source, "ignorePaths"),
    hasReplayProfile: mapOptionalExpandedNode(
      source,
      "hasReplayProfile",
      mapExpandedReplayProfile,
    ),
    hasFileExpectation: getExpandedNodeArray(source, "hasFileExpectation").map((
      node,
    ) => mapExpandedFileExpectation(node)),
    hasRdfExpectation: getExpandedNodeArray(source, "hasRdfExpectation").map((
      node,
    ) => mapExpandedRdfExpectation(node)),
  };
}

function mapExpandedFileExpectation(
  source: Record<string, unknown>,
): FileExpectation {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    path: getExpandedString(source, "path"),
    changeType: getExpandedIriLocalName(source, "changeType"),
    compareMode: getExpandedIriLocalName(source, "compareMode"),
  };
}

function mapExpandedRdfExpectation(
  source: Record<string, unknown>,
): RdfExpectation {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    targetsFileExpectation: getExpandedIri(source, "targetsFileExpectation"),
    ignorePredicate: getExpandedIriArray(source, "ignorePredicate"),
    hasAskAssertion: getExpandedNodeArray(source, "hasAskAssertion").map((
      node,
    ) => mapExpandedAskAssertion(node)),
  };
}

function mapExpandedAskAssertion(
  source: Record<string, unknown>,
): SparqlAskAssertion {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    query: getExpandedString(source, "query"),
    expectedBoolean: getExpandedBoolean(source, "expectedBoolean"),
  };
}

function mapExpandedStateLocator(
  source: Record<string, unknown>,
): StateLocator {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    locatorKind: getExpandedIriLocalName(source, "locatorKind"),
    ref: getExpandedString(source, "ref"),
    locatorPath: getExpandedString(source, "locatorPath"),
    uri: getExpandedString(source, "uri"),
    contentDigest: getExpandedString(source, "contentDigest"),
    mediaType: getExpandedString(source, "mediaType"),
  };
}

function mapExpandedReplayProfile(
  source: Record<string, unknown>,
): ReplayProfile {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    workspaceRoot: getExpandedString(source, "workspaceRoot"),
    meshRoot: getExpandedString(source, "meshRoot"),
    hasCommandInvocation: mapOptionalExpandedNode(
      source,
      "hasCommandInvocation",
      mapExpandedCommandInvocation,
    ),
    hasCommandSequence: getExpandedNodeArray(
      source,
      "hasCommandSequence",
    ).map((node) => mapExpandedCommandInvocation(node)),
    hasInputMaterialization: getExpandedNodeArray(
      source,
      "hasInputMaterialization",
    ).map((node) => mapExpandedInputMaterialization(node)),
    hasFileOperation: getExpandedNodeArray(source, "hasFileOperation").map((
      node,
    ) => mapExpandedFileOperation(node)),
  };
}

function mapExpandedCommandInvocation(
  source: Record<string, unknown>,
): CommandInvocation {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    executable: getExpandedString(source, "executable"),
    argv: getExpandedStringArray(source, "argv"),
    workingDirectory: getExpandedString(source, "workingDirectory"),
    promptPolicy: getExpandedIriLocalName(source, "promptPolicy"),
    expectedExitCode: getExpandedNumber(source, "expectedExitCode"),
    expectsOperationalLogs: getExpandedBoolean(
      source,
      "expectsOperationalLogs",
    ),
    expectsAuditLogs: getExpandedBoolean(source, "expectsAuditLogs"),
    hasEnvironmentOverride: getExpandedNodeArray(
      source,
      "hasEnvironmentOverride",
    ).map((node) => mapExpandedEnvironmentOverride(node)),
  };
}

function mapExpandedEnvironmentOverride(
  source: Record<string, unknown>,
): EnvironmentOverride {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    name: getExpandedString(source, "name"),
    value: getExpandedString(source, "value"),
  };
}

function mapExpandedInputMaterialization(
  source: Record<string, unknown>,
): InputMaterialization {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    targetPath: getExpandedString(source, "targetPath"),
    hasSourceProvenance: mapOptionalExpandedNode(
      source,
      "hasSourceProvenance",
      mapExpandedSourceProvenance,
    ),
  };
}

function mapExpandedFileOperation(
  source: Record<string, unknown>,
): FileOperation {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    operationKind: getExpandedIriLocalName(source, "operationKind"),
    targetPath: getExpandedString(source, "targetPath"),
    hasSourceProvenance: mapOptionalExpandedNode(
      source,
      "hasSourceProvenance",
      mapExpandedSourceProvenance,
    ),
  };
}

function mapExpandedSourceProvenance(
  source: Record<string, unknown>,
): SourceProvenance {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    sourceKind: getExpandedIriLocalName(source, "sourceKind"),
    sourcePath: getExpandedString(source, "sourcePath"),
    sourceRef: getExpandedString(source, "sourceRef"),
    sourceUrl: getExpandedString(source, "sourceUrl"),
    inlineValue: getExpandedString(source, "inlineValue"),
    contentDigest: getExpandedString(source, "contentDigest"),
    mediaType: getExpandedString(source, "mediaType"),
    derivationNote: getExpandedString(source, "derivationNote"),
    derivedFrom: getExpandedIri(source, "derivedFrom"),
    nondeterministicSource: getExpandedBoolean(
      source,
      "nondeterministicSource",
    ),
  };
}

function getSourceId(source: Record<string, unknown>): string | undefined {
  return typeof source.id === "string"
    ? source.id
    : typeof source["@id"] === "string"
    ? source["@id"]
    : undefined;
}

function getSourceType(source: Record<string, unknown>): string | undefined {
  const rawType = typeof source.type === "string"
    ? source.type
    : typeof source["@type"] === "string"
    ? source["@type"]
    : undefined;
  return rawType === undefined ? undefined : compactIri(rawType);
}

function getSourceString(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof source[key] === "string" ? source[key] as string : undefined;
}

function getSourceStringArray(
  source: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const rawValue = source[key];

  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  const values = rawValue.filter((entry): entry is string =>
    typeof entry === "string"
  );
  return values.length === 0 ? undefined : values;
}

function getSourceBoolean(
  source: Record<string, unknown>,
  key: string,
): boolean | undefined {
  return typeof source[key] === "boolean" ? source[key] : undefined;
}

function getSourceNumber(
  source: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof source[key] === "number" ? source[key] : undefined;
}

function mapOptionalSourceNode<T>(
  source: Record<string, unknown>,
  key: string,
  documentUrl: string,
  mapper: (node: Record<string, unknown>, documentUrl: string) => T,
): T | undefined {
  const rawValue = source[key];

  if (isRecord(rawValue)) {
    return mapper(rawValue, documentUrl);
  }

  if (Array.isArray(rawValue)) {
    const node = rawValue.find(isRecord);
    return node === undefined ? undefined : mapper(node, documentUrl);
  }

  return undefined;
}

function getSourceNodeArray(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const rawValue = source[key];

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.filter(isRecord);
}

function getExpandedNodeId(
  source: Record<string, unknown>,
): string | undefined {
  return typeof source["@id"] === "string" ? source["@id"] : undefined;
}

function getExpandedType(source: unknown): string | undefined {
  if (!isRecord(source) || !Array.isArray(source["@type"])) {
    return undefined;
  }

  const firstType = source["@type"].find((entry): entry is string =>
    typeof entry === "string"
  );
  return firstType === undefined ? undefined : compactIri(firstType);
}

function getExpandedNodeArray(
  source: Record<string, unknown>,
  term: string,
): Record<string, unknown>[] {
  const rawValue = source[expandTerm(term)];

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.filter(isRecord);
}

function getExpandedString(
  source: Record<string, unknown>,
  term: string,
): string | undefined {
  const rawValue = source[expandTerm(term)];

  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  for (const entry of rawValue) {
    if (!isRecord(entry)) {
      continue;
    }

    if (typeof entry["@value"] === "string") {
      return entry["@value"];
    }
  }

  return undefined;
}

function getExpandedStringArray(
  source: Record<string, unknown>,
  term: string,
): string[] | undefined {
  const rawValue = source[expandTerm(term)];

  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  const values = rawValue.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    if (Array.isArray(entry["@list"])) {
      return entry["@list"].flatMap((listEntry) =>
        isRecord(listEntry) && typeof listEntry["@value"] === "string"
          ? [listEntry["@value"]]
          : []
      );
    }

    return typeof entry["@value"] === "string" ? [entry["@value"]] : [];
  });

  return values.length === 0 ? undefined : values;
}

function getExpandedBoolean(
  source: Record<string, unknown>,
  term: string,
): boolean | undefined {
  const rawValue = source[expandTerm(term)];

  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  for (const entry of rawValue) {
    if (!isRecord(entry)) {
      continue;
    }

    if (typeof entry["@value"] === "boolean") {
      return entry["@value"];
    }
  }

  return undefined;
}

function getExpandedNumber(
  source: Record<string, unknown>,
  term: string,
): number | undefined {
  const rawValue = source[expandTerm(term)];

  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  for (const entry of rawValue) {
    if (!isRecord(entry)) {
      continue;
    }

    if (typeof entry["@value"] === "number") {
      return entry["@value"];
    }
  }

  return undefined;
}

function getExpandedIri(
  source: Record<string, unknown>,
  term: string,
): string | undefined {
  const rawValue = source[expandTerm(term)];

  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  for (const entry of rawValue) {
    if (!isRecord(entry)) {
      continue;
    }

    if (typeof entry["@id"] === "string") {
      return entry["@id"];
    }
  }

  return undefined;
}

function getExpandedIriArray(
  source: Record<string, unknown>,
  term: string,
): string[] | undefined {
  const rawValue = source[expandTerm(term)];

  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  const values = rawValue.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry["@id"] !== "string") {
      return [];
    }

    return [entry["@id"]];
  });

  return values.length === 0 ? undefined : values;
}

function getExpandedIriLocalName(
  source: Record<string, unknown>,
  term: string,
): string | undefined {
  const iri = getExpandedIri(source, term);
  return iri === undefined ? undefined : compactIri(iri);
}

function mapOptionalExpandedNode<T>(
  source: Record<string, unknown>,
  term: string,
  mapper: (node: Record<string, unknown>) => T,
): T | undefined {
  const node = getExpandedNodeArray(source, term)[0];
  return node === undefined ? undefined : mapper(node);
}

function expandTerm(term: string): string {
  return `${ACCORD_NS}${term}`;
}

function compactIri(value: string): string {
  return value.startsWith(ACCORD_NS) ? value.slice(ACCORD_NS.length) : value;
}

function resolveIri(
  value: string | undefined,
  base: string,
): string | undefined {
  if (value === undefined || value.startsWith("_:")) {
    return value;
  }

  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
