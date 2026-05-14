import { DataFactory } from "n3";
import type { Quad, Term } from "n3";
import type { JsonLdDocumentContext } from "../jsonld/documents.ts";
import { CHECK_CODES, type CheckCode } from "../report/codes.ts";
import { parseRdfContent, RdfCompareError } from "./compare_rdf.ts";

const { literal, namedNode, variable } = DataFactory;

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

interface TriplePattern {
  subject: Term;
  predicate: Term;
  object: Term;
}

type Position = "subject" | "predicate" | "object";
type Bindings = Map<string, Term>;

export class SparqlAskError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "SparqlAskError";
    this.code = code;
  }
}

export interface RunAskAssertionOptions {
  dataset: Uint8Array;
  path: string;
  query: string;
  documentContext?: JsonLdDocumentContext;
}

export async function runAskAssertion(
  options: RunAskAssertionOptions,
): Promise<boolean> {
  try {
    const dataset = await parseRdfContent({
      bytes: options.dataset,
      path: options.path,
      documentContext: options.documentContext,
    });
    const patterns = parseAskPatterns(options.query);

    return hasMatchingBindings(dataset, patterns, 0, new Map());
  } catch (error) {
    if (error instanceof RdfCompareError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new SparqlAskError(
      CHECK_CODES.SPARQL_QUERY_ERROR,
      `Failed to execute SPARQL ASK query: ${message}`,
    );
  }
}

function parseAskPatterns(query: string): TriplePattern[] {
  const body = extractAskBody(query);
  const stream = new TokenStream(tokenizeAskBody(body));
  const patterns: TriplePattern[] = [];

  while (!stream.done()) {
    if (stream.consumeIf(".")) {
      continue;
    }

    const subject = parseTerm(stream.consume("subject term"), "subject");
    patterns.push(...parsePredicateObjectList(stream, subject));

    if (!stream.consumeIf(".") && !stream.done()) {
      throw new Error(
        `Expected "." after ASK triple pattern, found ${stream.describeNext()}.`,
      );
    }
  }

  if (patterns.length === 0) {
    throw new Error("ASK query must contain at least one triple pattern.");
  }

  return patterns;
}

function extractAskBody(query: string): string {
  const trimmedQuery = query.trim();
  const match = trimmedQuery.match(
    /^ASK\s*(?:WHERE\s*)?\{\s*([\s\S]*?)\s*\}\s*$/i,
  );

  if (match === null) {
    throw new Error("Only ASK { ... } queries are supported.");
  }

  return match[1];
}

function parsePredicateObjectList(
  stream: TokenStream,
  subject: Term,
): TriplePattern[] {
  const patterns: TriplePattern[] = [];

  while (true) {
    const predicate = parseVerb(stream.consume("predicate term"));
    const objects = parseObjectList(stream);

    for (const object of objects) {
      patterns.push({ subject, predicate, object });
    }

    if (!stream.consumeIf(";")) {
      break;
    }

    if (stream.done() || stream.peek() === ".") {
      break;
    }
  }

  return patterns;
}

function parseObjectList(stream: TokenStream): Term[] {
  const objects = [parseTerm(stream.consume("object term"), "object")];

  while (stream.consumeIf(",")) {
    objects.push(parseTerm(stream.consume("object term"), "object"));
  }

  return objects;
}

function parseVerb(token: string): Term {
  if (token === "a") {
    return namedNode(RDF_TYPE_IRI);
  }

  return parseTerm(token, "predicate");
}

function tokenizeAskBody(body: string): string[] {
  const tokens: string[] = [];
  const matcher =
    /<[^>]*>|"(?:[^"\\]|\\.)*"(?:@[A-Za-z]+(?:-[A-Za-z0-9]+)*|\^\^<[^>]*>)?|_:[A-Za-z][A-Za-z0-9_-]*|\?[A-Za-z_][A-Za-z0-9_]*|[.;,]|[A-Za-z][A-Za-z0-9_-]*/g;
  let match: RegExpExecArray | null;
  let cursor = 0;

  while ((match = matcher.exec(body)) !== null) {
    const skipped = body.slice(cursor, match.index);
    if (/\S/.test(skipped)) {
      throw new Error(`Unsupported ASK syntax near ${skipped.trim()}.`);
    }

    tokens.push(match[0]);
    cursor = matcher.lastIndex;
  }

  const remainder = body.slice(cursor);
  if (/\S/.test(remainder)) {
    throw new Error(`Unsupported ASK syntax near ${remainder.trim()}.`);
  }

  return tokens;
}

function parseTerm(
  token: string,
  position: "subject" | "predicate" | "object",
): Term {
  if (token.startsWith("?")) {
    return variable(token.slice(1));
  }

  if (token.startsWith("_:")) {
    return variable(`blank_${token.slice(2)}`);
  }

  if (token.startsWith("<") && token.endsWith(">")) {
    return namedNode(token.slice(1, -1));
  }

  if (position === "object" && token.startsWith('"')) {
    return parseLiteral(token);
  }

  throw new Error(`Unsupported ${position} term in ASK query: ${token}`);
}

function parseLiteral(token: string): Term {
  const match = token.match(
    /^"((?:[^"\\]|\\.)*)"(?:@([A-Za-z]+(?:-[A-Za-z0-9]+)*)|\^\^<([^>]*)>)?$/,
  );

  if (match === null) {
    throw new Error(`Unsupported literal in ASK query: ${token}`);
  }

  const value = unescapeQuotedString(match[1]);

  if (match[2] !== undefined) {
    return literal(value, match[2]);
  }

  if (match[3] !== undefined) {
    return literal(value, namedNode(match[3]));
  }

  return literal(value);
}

function unescapeQuotedString(value: string): string {
  return value.replace(/\\(["\\nrt])/g, (_match, escaped: string) => {
    switch (escaped) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      default:
        return escaped;
    }
  });
}

function hasMatchingBindings(
  dataset: Quad[],
  patterns: TriplePattern[],
  patternIndex: number,
  bindings: Bindings,
): boolean {
  if (patternIndex >= patterns.length) {
    return true;
  }

  const pattern = patterns[patternIndex];

  for (const candidate of dataset) {
    const nextBindings = quadMatchesPattern(candidate, pattern, bindings);
    if (
      nextBindings !== null &&
      hasMatchingBindings(dataset, patterns, patternIndex + 1, nextBindings)
    ) {
      return true;
    }
  }

  return false;
}

function quadMatchesPattern(
  candidate: Quad,
  pattern: TriplePattern,
  bindings: Bindings,
): Bindings | null {
  const subjectBindings = termMatchesPattern(
    candidate.subject,
    pattern.subject,
    bindings,
  );
  if (subjectBindings === null) {
    return null;
  }

  const predicateBindings = termMatchesPattern(
    candidate.predicate,
    pattern.predicate,
    subjectBindings,
  );
  if (predicateBindings === null) {
    return null;
  }

  return termMatchesPattern(
    candidate.object,
    pattern.object,
    predicateBindings,
  );
}

function termMatchesPattern(
  candidate: Term,
  pattern: Term,
  bindings: Bindings,
): Bindings | null {
  if (pattern.termType !== "Variable") {
    return candidate.equals(pattern) ? bindings : null;
  }

  const boundTerm = bindings.get(pattern.value);
  if (boundTerm !== undefined) {
    return candidate.equals(boundTerm) ? bindings : null;
  }

  const nextBindings = new Map(bindings);
  nextBindings.set(pattern.value, candidate);
  return nextBindings;
}

class TokenStream {
  #tokens: string[];
  #index = 0;

  constructor(tokens: string[]) {
    this.#tokens = tokens;
  }

  done(): boolean {
    return this.#index >= this.#tokens.length;
  }

  peek(): string | undefined {
    return this.#tokens[this.#index];
  }

  consume(expected: string): string {
    const token = this.peek();
    if (token === undefined) {
      throw new Error(`Expected ${expected}, found end of ASK query.`);
    }

    this.#index += 1;
    return token;
  }

  consumeIf(token: string): boolean {
    if (this.peek() !== token) {
      return false;
    }

    this.#index += 1;
    return true;
  }

  describeNext(): string {
    const token = this.peek();
    return token === undefined ? "end of ASK query" : `"${token}"`;
  }
}
