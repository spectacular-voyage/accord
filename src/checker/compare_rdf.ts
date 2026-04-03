import { extname } from "@std/path";
import jsonld from "jsonld";
import { Parser, Writer } from "n3";
import type { Quad } from "n3";
import * as rdfCanonize from "rdf-canonize";
import {
  assertContextReferencesAllowed,
  createSyntheticJsonLdDocumentUrl,
  getTopLevelContext,
  JsonLdDocumentContext,
  parseJsonSource,
} from "../jsonld/documents.ts";
import { CHECK_CODES, CheckCode } from "../report/codes.ts";

export class RdfCompareError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "RdfCompareError";
    this.code = code;
  }
}

export interface CompareRdfContentOptions {
  left: Uint8Array;
  right: Uint8Array;
  path: string;
  ignorePredicates?: string[];
  leftDocumentContext?: JsonLdDocumentContext;
  rightDocumentContext?: JsonLdDocumentContext;
}

export interface ParseRdfContentOptions {
  bytes: Uint8Array;
  path: string;
  documentContext?: JsonLdDocumentContext;
}

export async function compareRdfContent(
  options: CompareRdfContentOptions,
): Promise<boolean> {
  const leftNQuads = await canonicalizeRdf(
    options.left,
    options.path,
    options.ignorePredicates,
    options.leftDocumentContext,
  );
  const rightNQuads = await canonicalizeRdf(
    options.right,
    options.path,
    options.ignorePredicates,
    options.rightDocumentContext,
  );
  return leftNQuads === rightNQuads;
}

export async function parseRdfContent(
  options: ParseRdfContentOptions,
): Promise<Quad[]> {
  const format = detectRdfSyntax(options.path);

  if (format === "application/ld+json") {
    return await parseJsonLdRdf(options);
  }

  const text = decodeRdfText(options.bytes);
  return parseRdf(
    text,
    format,
    options.documentContext?.documentUrl ??
      createSyntheticJsonLdDocumentUrl(options.path),
  );
}

export function detectRdfSyntax(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".ttl":
      return "text/turtle";
    case ".nt":
      return "application/n-triples";
    case ".nq":
      return "application/n-quads";
    case ".trig":
      return "application/trig";
    case ".jsonld":
      return "application/ld+json";
    default:
      throw new RdfCompareError(
        CHECK_CODES.RDF_PARSE_ERROR,
        `Unsupported RDF syntax for path: ${path}`,
      );
  }
}

async function canonicalizeRdf(
  bytes: Uint8Array,
  path: string,
  ignorePredicates: string[] = [],
  documentContext?: JsonLdDocumentContext,
): Promise<string> {
  const quads = await parseRdfContent({ bytes, path, documentContext });
  const filteredQuads = filterQuadsByPredicate(quads, ignorePredicates);
  const nquads = await writeNQuads(filteredQuads);

  try {
    return await rdfCanonize.canonize(nquads, {
      algorithm: "RDFC-1.0",
      inputFormat: "application/n-quads",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RdfCompareError(
      CHECK_CODES.RDF_PARSE_ERROR,
      `Failed to canonicalize RDF dataset: ${message}`,
    );
  }
}

function decodeRdfText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RdfCompareError(
      CHECK_CODES.RDF_PARSE_ERROR,
      `Failed to decode RDF input as UTF-8: ${message}`,
    );
  }
}

async function parseJsonLdRdf(
  options: ParseRdfContentOptions,
): Promise<Quad[]> {
  const documentUrl = options.documentContext?.documentUrl ??
    createSyntheticJsonLdDocumentUrl(options.path);
  const rawDocument = parseJsonSource(
    decodeRdfText(options.bytes),
    options.path,
    documentUrl,
    createRdfCompareError,
    CHECK_CODES.RDF_PARSE_ERROR,
  );
  assertContextReferencesAllowed(
    getTopLevelContext(rawDocument),
    createRdfCompareError,
  );

  try {
    const nquads = await jsonld.toRDF(rawDocument, {
      base: documentUrl,
      safe: true,
      format: "application/n-quads",
      documentLoader: options.documentContext?.documentLoader ??
        createInlineJsonLdDocumentLoader(),
    });
    return parseRdf(nquads, "application/n-quads", documentUrl);
  } catch (error) {
    if (error instanceof RdfCompareError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new RdfCompareError(
      CHECK_CODES.RDF_PARSE_ERROR,
      `Failed to parse JSON-LD RDF input: ${message}`,
    );
  }
}

function parseRdf(text: string, format: string, baseIri: string): Quad[] {
  try {
    return new Parser({
      format,
      baseIRI: baseIri,
    }).parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RdfCompareError(
      CHECK_CODES.RDF_PARSE_ERROR,
      `Failed to parse RDF input: ${message}`,
    );
  }
}

function createInlineJsonLdDocumentLoader() {
  return async (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      throw new RdfCompareError(
        CHECK_CODES.REMOTE_CONTEXT_DISALLOWED,
        `Remote JSON-LD context is not allowlisted: ${url}`,
      );
    }

    throw new RdfCompareError(
      CHECK_CODES.RDF_PARSE_ERROR,
      `Unsupported JSON-LD document URL: ${url}`,
    );
  };
}

function filterQuadsByPredicate(
  quads: Quad[],
  ignorePredicates: string[],
): Quad[] {
  if (ignorePredicates.length === 0) {
    return quads;
  }

  const ignored = new Set(ignorePredicates);
  return quads.filter((quad: Quad) => !ignored.has(quad.predicate.value));
}

async function writeNQuads(
  quads: Quad[],
): Promise<string> {
  const writer = new Writer({ format: "N-Quads" });
  writer.addQuads(quads);

  return await new Promise<string>((resolve, reject) => {
    writer.end((error: Error | null | undefined, result: string) => {
      if (error) {
        reject(
          new RdfCompareError(
            CHECK_CODES.RDF_PARSE_ERROR,
            `Failed to serialize RDF dataset to N-Quads: ${error.message}`,
          ),
        );
        return;
      }

      resolve(result);
    });
  });
}

function createRdfCompareError(code: CheckCode, message: string): Error {
  return new RdfCompareError(code, message);
}
