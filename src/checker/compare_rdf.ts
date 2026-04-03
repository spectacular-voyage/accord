import { extname } from "@std/path";
import { Parser, Writer } from "n3";
import type { Quad } from "n3";
import * as rdfCanonize from "rdf-canonize";
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
}

export interface ParseRdfContentOptions {
  bytes: Uint8Array;
  path: string;
}

export async function compareRdfContent(
  options: CompareRdfContentOptions,
): Promise<boolean> {
  const leftNQuads = await canonicalizeRdf(
    options.left,
    options.path,
    options.ignorePredicates,
  );
  const rightNQuads = await canonicalizeRdf(
    options.right,
    options.path,
    options.ignorePredicates,
  );
  return leftNQuads === rightNQuads;
}

export function parseRdfContent(
  options: ParseRdfContentOptions,
): ReturnType<Parser["parse"]> {
  const format = detectRdfSyntax(options.path);
  const text = decodeRdfText(options.bytes);
  return parseRdf(text, format, options.path);
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
): Promise<string> {
  const quads = parseRdfContent({ bytes, path });
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

function parseRdf(text: string, format: string, path: string) {
  try {
    return new Parser({
      format,
      baseIRI: `accord://input/${encodeURIComponent(path)}`,
    }).parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RdfCompareError(
      CHECK_CODES.RDF_PARSE_ERROR,
      `Failed to parse RDF input: ${message}`,
    );
  }
}

function filterQuadsByPredicate(
  quads: ReturnType<Parser["parse"]>,
  ignorePredicates: string[],
) {
  if (ignorePredicates.length === 0) {
    return quads;
  }

  const ignored = new Set(ignorePredicates);
  return quads.filter((quad: Quad) => !ignored.has(quad.predicate.value));
}

async function writeNQuads(
  quads: ReturnType<Parser["parse"]>,
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
