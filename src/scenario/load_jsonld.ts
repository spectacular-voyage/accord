import jsonld from "jsonld";
import { isAbsolute, join } from "@std/path";
import {
  assertContextReferencesAllowed,
  createFileJsonLdDocumentContext,
  getTopLevelContext,
  type JsonLdDocumentContext,
  parseJsonSource,
} from "../jsonld/documents.ts";
import type { CheckCode } from "../report/codes.ts";
import { CHECK_CODES } from "../report/codes.ts";
import type { StateLocator } from "../manifest/model.ts";
import type {
  LaneStateBinding,
  ScenarioIndexDocument,
  ScenarioStep,
  StateLane,
} from "./model.ts";

const ACCORD_NS = "https://spectacular-voyage.github.io/accord/ns#";

export interface LoadedScenarioIndexSource {
  path: string;
  documentUrl: string;
  document: ScenarioIndexDocument;
}

export interface ScenarioIndexValidationOptions {
  rootPath?: string;
}

export class ScenarioIndexLoadError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "ScenarioIndexLoadError";
    this.code = code;
  }
}

export class ScenarioIndexValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioIndexValidationError";
  }
}

function createScenarioIndexLoadError(
  code: CheckCode,
  message: string,
): Error {
  return new ScenarioIndexLoadError(code, message);
}

export async function readScenarioIndexSource(
  scenarioIndexPath: string,
): Promise<LoadedScenarioIndexSource> {
  const documentContext = createFileJsonLdDocumentContext(
    scenarioIndexPath,
    createScenarioIndexLoadError,
    CHECK_CODES.MANIFEST_LOAD_ERROR,
  );
  const sourceText = await readScenarioIndexText(
    scenarioIndexPath,
    documentContext,
  );
  const rawDocument = parseJsonSource(
    sourceText,
    scenarioIndexPath,
    documentContext.documentUrl,
    createScenarioIndexLoadError,
    CHECK_CODES.MANIFEST_LOAD_ERROR,
    "JSON-LD scenario index document",
  );
  assertContextReferencesAllowed(
    getTopLevelContext(rawDocument),
    createScenarioIndexLoadError,
  );
  const expandedDocument = await expandScenarioIndex(
    rawDocument,
    documentContext,
  );
  const document = mapSourceShapeDocument(
    rawDocument,
    documentContext.documentUrl,
  ) ?? mapExpandedDocument(expandedDocument, documentContext.documentUrl);

  return {
    path: scenarioIndexPath,
    documentUrl: documentContext.documentUrl,
    document,
  };
}

export async function validateScenarioIndexDocument(
  document: ScenarioIndexDocument,
  options: ScenarioIndexValidationOptions = {},
): Promise<void> {
  const steps = document.hasStep ?? [];

  if (steps.length === 0) {
    throw new ScenarioIndexValidationError(
      "A scenario index must contain at least one step.",
    );
  }

  validateUniqueValues(
    "state lane key",
    (document.hasStateLane ?? []).map((lane) => lane.laneKey),
  );
  validateUniqueValues("step id", steps.map((step) => step.id));
  validateLaneBindings(document);
  await validateManifestReferences(steps, options.rootPath ?? Deno.cwd());
}

async function readScenarioIndexText(
  scenarioIndexPath: string,
  documentContext: JsonLdDocumentContext,
): Promise<string> {
  try {
    return await Deno.readTextFile(scenarioIndexPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createScenarioIndexLoadError(
      CHECK_CODES.MANIFEST_LOAD_ERROR,
      `Failed to read JSON-LD scenario index document at ${scenarioIndexPath} (${documentContext.documentUrl}): ${message}`,
    );
  }
}

async function expandScenarioIndex(
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
    if (error instanceof ScenarioIndexLoadError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new ScenarioIndexLoadError(
      CHECK_CODES.MANIFEST_LOAD_ERROR,
      `Failed to load JSON-LD scenario index: ${message}`,
    );
  }
}

function mapSourceShapeDocument(
  rawDocument: unknown,
  documentUrl: string,
): ScenarioIndexDocument | null {
  const scenarioIndexNode = findSourceShapeScenarioIndexNode(rawDocument);

  if (scenarioIndexNode === null) {
    return null;
  }

  return {
    "@context": scenarioIndexNode["@context"],
    id: getSourceId(scenarioIndexNode),
    resolvedId: resolveIri(getSourceId(scenarioIndexNode), documentUrl),
    documentUrl,
    type: getSourceType(scenarioIndexNode),
    defaultFixtureRepo: getSourceString(
      scenarioIndexNode,
      "defaultFixtureRepo",
    ),
    branchPrefix: getSourceString(scenarioIndexNode, "branchPrefix"),
    assetRoot: getSourceStringArray(scenarioIndexNode, "assetRoot"),
    hasStateLane: getSourceNodeArray(scenarioIndexNode, "hasStateLane").map((
      node,
    ) => mapSourceStateLane(node, documentUrl)),
    hasStep: getSourceNodeArray(scenarioIndexNode, "hasStep").map((node) =>
      mapSourceScenarioStep(node, documentUrl)
    ),
  };
}

function findSourceShapeScenarioIndexNode(
  rawDocument: unknown,
): Record<string, unknown> | null {
  if (
    isRecord(rawDocument) && hasSourceNodeCollection(rawDocument, "hasStep")
  ) {
    return rawDocument;
  }

  if (Array.isArray(rawDocument)) {
    for (const candidate of rawDocument) {
      if (
        isRecord(candidate) && hasSourceNodeCollection(candidate, "hasStep")
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function mapSourceStateLane(
  source: Record<string, unknown>,
  documentUrl: string,
): StateLane {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    laneKey: getSourceString(source, "laneKey"),
    branchPrefix: getSourceString(source, "branchPrefix"),
  };
}

function mapSourceScenarioStep(
  source: Record<string, unknown>,
  documentUrl: string,
): ScenarioStep {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    manifestPath: getSourceString(source, "manifestPath"),
    caseId: getSourceString(source, "caseId"),
    hasLaneBinding: getSourceNodeArray(source, "hasLaneBinding").map((node) =>
      mapSourceLaneStateBinding(node, documentUrl)
    ),
  };
}

function mapSourceLaneStateBinding(
  source: Record<string, unknown>,
  documentUrl: string,
): LaneStateBinding {
  const id = getSourceId(source);

  return {
    id,
    resolvedId: resolveIri(id, documentUrl),
    type: getSourceType(source),
    lane: getSourceString(source, "lane"),
    fromLaneState: mapOptionalSourceNode(
      source,
      "fromLaneState",
      documentUrl,
      mapSourceStateLocator,
    ),
    toLaneState: mapOptionalSourceNode(
      source,
      "toLaneState",
      documentUrl,
      mapSourceStateLocator,
    ),
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

function mapExpandedDocument(
  expandedDocument: unknown[],
  documentUrl: string,
): ScenarioIndexDocument {
  const scenarioIndexNode = expandedDocument.find((candidate) =>
    getExpandedTypes(candidate).includes("ScenarioIndex")
  );

  if (!isRecord(scenarioIndexNode)) {
    throw new ScenarioIndexLoadError(
      CHECK_CODES.MANIFEST_LOAD_ERROR,
      "Expanded JSON-LD did not contain an Accord ScenarioIndex node.",
    );
  }

  return {
    id: getExpandedNodeId(scenarioIndexNode),
    resolvedId: getExpandedNodeId(scenarioIndexNode),
    documentUrl,
    type: getExpandedType(scenarioIndexNode),
    defaultFixtureRepo: getExpandedString(
      scenarioIndexNode,
      "defaultFixtureRepo",
    ),
    branchPrefix: getExpandedString(scenarioIndexNode, "branchPrefix"),
    assetRoot: getExpandedStringArray(scenarioIndexNode, "assetRoot"),
    hasStateLane: getExpandedNodeArray(
      scenarioIndexNode,
      "hasStateLane",
    ).map((node) => mapExpandedStateLane(node)),
    hasStep: getExpandedNodeArray(scenarioIndexNode, "hasStep").map((node) =>
      mapExpandedScenarioStep(node)
    ),
  };
}

function mapExpandedStateLane(source: Record<string, unknown>): StateLane {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    laneKey: getExpandedString(source, "laneKey"),
    branchPrefix: getExpandedString(source, "branchPrefix"),
  };
}

function mapExpandedScenarioStep(
  source: Record<string, unknown>,
): ScenarioStep {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    manifestPath: getExpandedString(source, "manifestPath"),
    caseId: getExpandedString(source, "caseId"),
    hasLaneBinding: getExpandedNodeArray(source, "hasLaneBinding").map((
      node,
    ) => mapExpandedLaneStateBinding(node)),
  };
}

function mapExpandedLaneStateBinding(
  source: Record<string, unknown>,
): LaneStateBinding {
  const id = getExpandedNodeId(source);

  return {
    id,
    resolvedId: id,
    type: getExpandedType(source),
    lane: getExpandedIri(source, "lane"),
    fromLaneState: mapOptionalExpandedNode(
      source,
      "fromLaneState",
      mapExpandedStateLocator,
    ),
    toLaneState: mapOptionalExpandedNode(
      source,
      "toLaneState",
      mapExpandedStateLocator,
    ),
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

function validateUniqueValues(
  label: string,
  values: Array<string | undefined>,
): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (value === undefined) {
      continue;
    }

    if (seen.has(value)) {
      throw new ScenarioIndexValidationError(
        `Scenario index contains duplicate ${label}: ${value}`,
      );
    }

    seen.add(value);
  }
}

function validateLaneBindings(document: ScenarioIndexDocument): void {
  const laneReferences = new Set<string>();

  for (const lane of document.hasStateLane ?? []) {
    if (lane.laneKey === undefined || lane.laneKey.trim() === "") {
      throw new ScenarioIndexValidationError(
        "Each state lane must declare a laneKey.",
      );
    }

    for (const reference of [lane.id, lane.resolvedId]) {
      if (reference !== undefined) {
        laneReferences.add(reference);
      }
    }
  }

  for (const step of document.hasStep ?? []) {
    for (const binding of step.hasLaneBinding ?? []) {
      const laneReference = binding.lane;

      if (laneReference === undefined || laneReference.trim() === "") {
        throw new ScenarioIndexValidationError(
          `Lane binding in step ${
            step.id ?? "(unidentified)"
          } must reference a lane.`,
        );
      }

      const resolvedLaneReference = resolveIri(
        laneReference,
        document.documentUrl ?? "",
      );

      if (
        !laneReferences.has(laneReference) &&
        (resolvedLaneReference === undefined ||
          !laneReferences.has(resolvedLaneReference))
      ) {
        throw new ScenarioIndexValidationError(
          `Lane binding in step ${
            step.id ?? "(unidentified)"
          } references undeclared lane: ${laneReference}`,
        );
      }
    }
  }
}

async function validateManifestReferences(
  steps: ScenarioStep[],
  rootPath: string,
): Promise<void> {
  for (const step of steps) {
    const manifestPath = step.manifestPath;

    if (manifestPath === undefined || manifestPath.trim() === "") {
      throw new ScenarioIndexValidationError(
        `Scenario step ${
          step.id ?? "(unidentified)"
        } must declare manifestPath.`,
      );
    }

    validateRepoRelativePath(manifestPath, "manifestPath");

    const absoluteManifestPath = join(rootPath, manifestPath);
    let fileInfo: Deno.FileInfo;

    try {
      fileInfo = await Deno.stat(absoluteManifestPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ScenarioIndexValidationError(
        `Scenario step ${
          step.id ?? "(unidentified)"
        } references missing manifestPath ${manifestPath}: ${message}`,
      );
    }

    if (!fileInfo.isFile) {
      throw new ScenarioIndexValidationError(
        `Scenario step ${
          step.id ?? "(unidentified)"
        } manifestPath must reference a file: ${manifestPath}`,
      );
    }
  }
}

function validateRepoRelativePath(path: string, label: string): void {
  const segments = path.split("/");

  if (
    path.trim() === "" ||
    path.startsWith("/") ||
    isAbsolute(path) ||
    path.includes("\\") ||
    segments.includes("") ||
    segments.includes(".") ||
    segments.includes("..")
  ) {
    throw new ScenarioIndexValidationError(
      `${label} must be a non-empty repository-relative POSIX path without traversal: ${path}`,
    );
  }
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

  if (Array.isArray(rawValue)) {
    return rawValue.filter(isRecord);
  }

  if (isRecord(rawValue) && Array.isArray(rawValue["@list"])) {
    return rawValue["@list"].filter(isRecord);
  }

  return [];
}

function hasSourceNodeCollection(
  source: Record<string, unknown>,
  key: string,
): boolean {
  const rawValue = source[key];
  return Array.isArray(rawValue) ||
    (isRecord(rawValue) && Array.isArray(rawValue["@list"]));
}

function getExpandedNodeId(
  source: Record<string, unknown>,
): string | undefined {
  return typeof source["@id"] === "string" ? source["@id"] : undefined;
}

function getExpandedType(source: unknown): string | undefined {
  const types = getExpandedTypes(source);
  return types.find(isCompactAccordType) ?? types[0];
}

function getExpandedTypes(source: unknown): string[] {
  if (!isRecord(source) || !Array.isArray(source["@type"])) {
    return [];
  }

  return source["@type"].flatMap((entry) =>
    typeof entry === "string" ? [compactIri(entry)] : []
  );
}

function getExpandedNodeArray(
  source: Record<string, unknown>,
  term: string,
): Record<string, unknown>[] {
  const rawValue = source[expandTerm(term)];

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    if (Array.isArray(entry["@list"])) {
      return entry["@list"].filter(isRecord);
    }

    return [entry];
  });
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

function isCompactAccordType(value: string): boolean {
  return !value.startsWith("http://") && !value.startsWith("https://");
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
