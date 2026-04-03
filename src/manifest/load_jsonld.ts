import jsonld from "jsonld";
import {
  assertContextReferencesAllowed,
  createFileJsonLdDocumentContext,
  getTopLevelContext,
  JsonLdDocumentContext,
  parseJsonSource,
} from "../jsonld/documents.ts";
import { CHECK_CODES, CheckCode } from "../report/codes.ts";
import {
  FileExpectation,
  ManifestDocument,
  RdfExpectation,
  SparqlAskAssertion,
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
    targetDesignatorPath: getSourceString(source, "targetDesignatorPath"),
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
    targetDesignatorPath: getExpandedString(source, "targetDesignatorPath"),
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
