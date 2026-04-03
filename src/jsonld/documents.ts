import { fromFileUrl, resolve, toFileUrl } from "@std/path";
import { CHECK_CODES, CheckCode } from "../report/codes.ts";

export interface LoadedJsonLdDocument {
  contextUrl: null;
  documentUrl: string;
  document: unknown;
}

export interface JsonLdDocumentContext {
  documentUrl: string;
  documentLoader: (url: string) => Promise<LoadedJsonLdDocument>;
}

export type JsonLdErrorFactory = (code: CheckCode, message: string) => Error;

const SYNTHETIC_JSONLD_BASE = "accord-jsonld://document/";

export function createFileJsonLdDocumentContext(
  documentPath: string,
  errorFactory: JsonLdErrorFactory,
  loadErrorCode: CheckCode,
): JsonLdDocumentContext {
  const resolvedPath = resolve(documentPath);
  const documentUrl = toFileUrl(resolvedPath).href;

  return {
    documentUrl,
    documentLoader: createDocumentLoader({
      errorFactory,
      loadErrorCode,
      loadLocalDocument: async (url) => {
        if (!url.startsWith("file://")) {
          return null;
        }

        return await loadJsonDocumentFromFileUrl(
          url,
          errorFactory,
          loadErrorCode,
        );
      },
    }),
  };
}

export function createPathMappedJsonLdDocumentContext(
  options: {
    documentPath: string;
    readDocumentText: (path: string) => Promise<string>;
    errorFactory: JsonLdErrorFactory;
    loadErrorCode: CheckCode;
  },
): JsonLdDocumentContext {
  return {
    documentUrl: createSyntheticJsonLdDocumentUrl(options.documentPath),
    documentLoader: createDocumentLoader({
      errorFactory: options.errorFactory,
      loadErrorCode: options.loadErrorCode,
      loadLocalDocument: async (url) => {
        const path = pathFromSyntheticJsonLdUrl(url);

        if (path === null) {
          return null;
        }

        const sourceText = await options.readDocumentText(path);
        return loadJsonDocumentFromText({
          sourceText,
          sourcePath: path,
          documentUrl: url,
          errorFactory: options.errorFactory,
          loadErrorCode: options.loadErrorCode,
        });
      },
    }),
  };
}

export function createSyntheticJsonLdDocumentUrl(documentPath: string): string {
  return new URL(stripLeadingSlashes(documentPath), SYNTHETIC_JSONLD_BASE).href;
}

export function getTopLevelContext(rawDocument: unknown): unknown {
  return isRecord(rawDocument) ? rawDocument["@context"] : undefined;
}

export function assertContextReferencesAllowed(
  context: unknown,
  errorFactory: JsonLdErrorFactory,
): void {
  if (context === undefined || context === null) {
    return;
  }

  if (typeof context === "string") {
    assertContextReferenceAllowed(context, errorFactory);
    return;
  }

  if (Array.isArray(context)) {
    for (const entry of context) {
      assertContextReferencesAllowed(entry, errorFactory);
    }

    return;
  }

  if (isRecord(context)) {
    validateObjectContextReferences(context, errorFactory);
  }
}

export function parseJsonSource(
  sourceText: string,
  sourcePath: string,
  documentUrl: string,
  errorFactory: JsonLdErrorFactory,
  loadErrorCode: CheckCode,
  sourceDescription = "JSON document",
): unknown {
  try {
    return JSON.parse(sourceText) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw errorFactory(
      loadErrorCode,
      `Failed to parse ${sourceDescription} at ${sourcePath} (${documentUrl}): ${message}`,
    );
  }
}

function createDocumentLoader(
  options: {
    errorFactory: JsonLdErrorFactory;
    loadErrorCode: CheckCode;
    loadLocalDocument: (url: string) => Promise<LoadedJsonLdDocument | null>;
  },
) {
  return async (url: string) => {
    if (isRemoteContextReference(url)) {
      throw options.errorFactory(
        CHECK_CODES.REMOTE_CONTEXT_DISALLOWED,
        `Remote JSON-LD context is not allowlisted: ${url}`,
      );
    }

    const document = await options.loadLocalDocument(url);

    if (document !== null) {
      return document;
    }

    throw options.errorFactory(
      options.loadErrorCode,
      `Unsupported JSON-LD document URL: ${url}`,
    );
  };
}

async function loadJsonDocumentFromFileUrl(
  url: string,
  errorFactory: JsonLdErrorFactory,
  loadErrorCode: CheckCode,
): Promise<LoadedJsonLdDocument> {
  const sourcePath = fromFileUrl(url);

  try {
    const sourceText = await Deno.readTextFile(sourcePath);
    return loadJsonDocumentFromText({
      sourceText,
      sourcePath,
      documentUrl: url,
      errorFactory,
      loadErrorCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw errorFactory(
      loadErrorCode,
      `Failed to read JSON document at ${sourcePath} (${url}): ${message}`,
    );
  }
}

function loadJsonDocumentFromText(
  options: {
    sourceText: string;
    sourcePath: string;
    documentUrl: string;
    errorFactory: JsonLdErrorFactory;
    loadErrorCode: CheckCode;
  },
): LoadedJsonLdDocument {
  return {
    contextUrl: null,
    documentUrl: options.documentUrl,
    document: parseJsonSource(
      options.sourceText,
      options.sourcePath,
      options.documentUrl,
      options.errorFactory,
      options.loadErrorCode,
    ),
  };
}

function assertContextReferenceAllowed(
  contextUrl: string,
  errorFactory: JsonLdErrorFactory,
): void {
  if (isRemoteContextReference(contextUrl)) {
    throw errorFactory(
      CHECK_CODES.REMOTE_CONTEXT_DISALLOWED,
      `Remote JSON-LD context is not allowlisted: ${contextUrl}`,
    );
  }
}

function validateObjectContextReferences(
  context: Record<string, unknown>,
  errorFactory: JsonLdErrorFactory,
): void {
  const importedContext = context["@import"];

  if (typeof importedContext === "string") {
    assertContextReferenceAllowed(importedContext, errorFactory);
  } else if (Array.isArray(importedContext)) {
    for (const entry of importedContext) {
      if (typeof entry === "string") {
        assertContextReferenceAllowed(entry, errorFactory);
      }
    }
  }

  const nestedContext = context["@context"];

  if (nestedContext !== undefined) {
    assertContextReferencesAllowed(nestedContext, errorFactory);
  }

  for (const [key, value] of Object.entries(context)) {
    if (key === "@import" || key === "@context") {
      continue;
    }

    walkNestedContextContainers(value, errorFactory);
  }
}

function walkNestedContextContainers(
  value: unknown,
  errorFactory: JsonLdErrorFactory,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkNestedContextContainers(entry, errorFactory);
    }

    return;
  }

  if (isRecord(value)) {
    validateObjectContextReferences(value, errorFactory);
  }
}

function pathFromSyntheticJsonLdUrl(url: string): string | null {
  if (!url.startsWith(SYNTHETIC_JSONLD_BASE)) {
    return null;
  }

  const parsed = new URL(url);
  return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
}

function stripLeadingSlashes(path: string): string {
  return path.replace(/^\/+/, "");
}

function isRemoteContextReference(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
