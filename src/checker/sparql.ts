import type { Quad, Term } from "n3";
// @deno-types="npm:@types/sparqljs@3.1.12"
import { Parser } from "sparqljs";
import type {
  AskQuery,
  BgpPattern,
  Expression,
  FilterPattern,
  OperationExpression,
  Pattern,
  Term as SparqlTerm,
  Triple,
} from "sparqljs";
import type { JsonLdDocumentContext } from "../jsonld/documents.ts";
import { CHECK_CODES, type CheckCode } from "../report/codes.ts";
import { parseRdfContent, RdfCompareError } from "./compare_rdf.ts";

type Bindings = Map<string, Term>;
type TermPosition = "subject" | "predicate" | "object";
type TripleTerm = Triple["subject"] | Triple["predicate"] | Triple["object"];

interface QuadIndex {
  all: Quad[];
  byObject: Map<string, Quad[]>;
  byPredicate: Map<string, Quad[]>;
  bySubject: Map<string, Quad[]>;
}

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
    const askQuery = parseSupportedAskQuery(options.query);

    return evaluateAskQuery(dataset, askQuery);
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

function parseSupportedAskQuery(query: string): AskQuery {
  const parsedQuery = new Parser().parse(query);

  if (parsedQuery.type !== "query" || parsedQuery.queryType !== "ASK") {
    throw new Error("Only ASK queries are supported.");
  }

  if (parsedQuery.from !== undefined) {
    throw unsupportedProfileError("FROM and FROM NAMED are not supported.");
  }

  if (parsedQuery.values !== undefined) {
    throw unsupportedProfileError(
      "top-level VALUES clauses are not supported.",
    );
  }

  return parsedQuery;
}

function evaluateAskQuery(dataset: Quad[], query: AskQuery): boolean {
  const index = buildQuadIndex(dataset);
  const finalBindings = evaluatePatterns(
    index,
    query.where ?? [],
    [new Map()],
  );
  return finalBindings.length > 0;
}

function evaluatePatterns(
  dataset: QuadIndex,
  patterns: Pattern[],
  initialBindings: Bindings[],
): Bindings[] {
  let currentBindings = initialBindings;
  const filterPatterns: FilterPattern[] = [];

  for (const pattern of patterns) {
    if (pattern.type === "filter") {
      filterPatterns.push(pattern);
      continue;
    }

    currentBindings = evaluatePattern(dataset, pattern, currentBindings);

    if (currentBindings.length === 0) {
      return [];
    }
  }

  for (const pattern of filterPatterns) {
    currentBindings = evaluateFilterPattern(dataset, pattern, currentBindings);

    if (currentBindings.length === 0) {
      return [];
    }
  }

  return currentBindings;
}

function evaluatePattern(
  dataset: QuadIndex,
  pattern: Pattern,
  bindings: Bindings[],
): Bindings[] {
  switch (pattern.type) {
    case "bgp":
      return evaluateBgpPattern(dataset, pattern, bindings);
    case "filter":
      return evaluateFilterPattern(dataset, pattern, bindings);
    default:
      throw unsupportedProfileError(
        `${describePatternType(pattern)} patterns are not supported.`,
      );
  }
}

function evaluateBgpPattern(
  dataset: QuadIndex,
  pattern: BgpPattern,
  initialBindings: Bindings[],
): Bindings[] {
  let currentBindings = initialBindings;

  for (const triple of pattern.triples) {
    assertSupportedTriple(triple);

    const nextBindings: Bindings[] = [];
    for (const bindings of currentBindings) {
      for (const candidate of candidateQuads(dataset, triple, bindings)) {
        const matchedBindings = quadMatchesTriple(candidate, triple, bindings);

        if (matchedBindings !== null) {
          nextBindings.push(matchedBindings);
        }
      }
    }

    currentBindings = nextBindings;

    if (currentBindings.length === 0) {
      break;
    }
  }

  return currentBindings;
}

function evaluateFilterPattern(
  dataset: QuadIndex,
  pattern: FilterPattern,
  bindings: Bindings[],
): Bindings[] {
  return bindings.filter((candidateBindings) =>
    evaluateFilterExpression(dataset, pattern.expression, candidateBindings)
  );
}

function evaluateFilterExpression(
  dataset: QuadIndex,
  expression: Expression,
  bindings: Bindings,
): boolean {
  if (!isOperationExpression(expression)) {
    throw unsupportedProfileError("only FILTER NOT EXISTS is supported.");
  }

  if (expression.operator.toLowerCase() !== "notexists") {
    throw unsupportedProfileError("only FILTER NOT EXISTS is supported.");
  }

  if (expression.args.length !== 1 || !isPattern(expression.args[0])) {
    throw unsupportedProfileError(
      "FILTER NOT EXISTS must contain a graph pattern.",
    );
  }

  return evaluatePattern(dataset, expression.args[0], [bindings]).length === 0;
}

function buildQuadIndex(dataset: Quad[]): QuadIndex {
  const index: QuadIndex = {
    all: dataset,
    byObject: new Map(),
    byPredicate: new Map(),
    bySubject: new Map(),
  };

  for (const quad of dataset) {
    addIndexedQuad(index.bySubject, quad.subject, quad);
    addIndexedQuad(index.byPredicate, quad.predicate, quad);
    addIndexedQuad(index.byObject, quad.object, quad);
  }

  return index;
}

function addIndexedQuad(
  index: Map<string, Quad[]>,
  term: Term,
  quad: Quad,
): void {
  const key = termIndexKey(term);
  const quads = index.get(key);

  if (quads === undefined) {
    index.set(key, [quad]);
    return;
  }

  quads.push(quad);
}

function candidateQuads(
  index: QuadIndex,
  triple: Triple,
  bindings: Bindings,
): Quad[] {
  const candidates = [
    candidateList(
      index.bySubject,
      indexedPatternTerm(triple.subject, bindings),
    ),
    candidateList(
      index.byPredicate,
      indexedPatternTerm(triple.predicate, bindings),
    ),
    candidateList(index.byObject, indexedPatternTerm(triple.object, bindings)),
  ].filter((list) => list !== undefined);

  if (candidates.length === 0) {
    return index.all;
  }

  return candidates.reduce((smallest, candidate) =>
    candidate.length < smallest.length ? candidate : smallest
  );
}

function candidateList(
  index: Map<string, Quad[]>,
  term: Term | null,
): Quad[] | undefined {
  if (term === null) {
    return undefined;
  }

  return index.get(termIndexKey(term)) ?? [];
}

function indexedPatternTerm(
  pattern: TripleTerm,
  bindings: Bindings,
): Term | null {
  if (!("termType" in pattern)) {
    return null;
  }

  const bindingKey = getBindingKey(pattern);

  if (bindingKey !== null) {
    return bindings.get(bindingKey) ?? null;
  }

  return pattern;
}

function termIndexKey(term: Term): string {
  if (term.termType === "Literal") {
    return [
      term.termType,
      term.value,
      term.language,
      term.datatype.value,
    ].join("\u0000");
  }

  return [term.termType, term.value].join("\u0000");
}

function quadMatchesTriple(
  candidate: Quad,
  triple: Triple,
  bindings: Bindings,
): Bindings | null {
  const subjectBindings = termMatchesPattern(
    candidate.subject,
    triple.subject,
    bindings,
    "subject",
  );
  if (subjectBindings === null) {
    return null;
  }

  const predicateBindings = termMatchesPattern(
    candidate.predicate,
    triple.predicate,
    subjectBindings,
    "predicate",
  );
  if (predicateBindings === null) {
    return null;
  }

  return termMatchesPattern(
    candidate.object,
    triple.object,
    predicateBindings,
    "object",
  );
}

function termMatchesPattern(
  candidate: Term,
  pattern: TripleTerm,
  bindings: Bindings,
  position: TermPosition,
): Bindings | null {
  assertSupportedTerm(pattern, position);

  const bindingKey = getBindingKey(pattern);
  if (bindingKey !== null) {
    const boundTerm = bindings.get(bindingKey);

    if (boundTerm !== undefined) {
      return termsEqual(candidate, boundTerm) ? bindings : null;
    }

    const nextBindings = new Map(bindings);
    nextBindings.set(bindingKey, candidate);
    return nextBindings;
  }

  return termsEqual(candidate, pattern) ? bindings : null;
}

function getBindingKey(term: SparqlTerm): string | null {
  if (term.termType === "Variable") {
    return `?${term.value}`;
  }

  if (term.termType === "BlankNode") {
    return `_:${term.value}`;
  }

  return null;
}

function termsEqual(left: Term, right: Term | SparqlTerm): boolean {
  if (left.termType !== right.termType || left.value !== right.value) {
    return false;
  }

  if (left.termType === "Literal" && right.termType === "Literal") {
    return left.language === right.language &&
      left.datatype.value === right.datatype.value;
  }

  return true;
}

function assertSupportedTriple(triple: Triple): void {
  assertSupportedTerm(triple.subject, "subject");
  assertSupportedTerm(triple.predicate, "predicate");
  assertSupportedTerm(triple.object, "object");
}

function assertSupportedTerm(
  term: TripleTerm,
  position: TermPosition,
): asserts term is SparqlTerm {
  if (!("termType" in term)) {
    if (position === "predicate") {
      throw unsupportedProfileError("property paths are not supported.");
    }

    throw unsupportedProfileError(`${position} expressions are not supported.`);
  }

  if (term.termType === "Quad") {
    throw unsupportedProfileError("RDF-star quoted triples are not supported.");
  }
}

function isOperationExpression(
  expression: Expression,
): expression is OperationExpression {
  return isRecord(expression) && expression.type === "operation";
}

function isPattern(value: Expression | Pattern): value is Pattern {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  return [
    "bgp",
    "bind",
    "filter",
    "graph",
    "group",
    "minus",
    "optional",
    "service",
    "union",
    "values",
  ].includes(value.type);
}

function describePatternType(pattern: Pattern): string {
  switch (pattern.type) {
    case "bgp":
      return "basic graph";
    case "filter":
      return "filter";
    case "optional":
      return "OPTIONAL";
    case "union":
      return "UNION";
    case "group":
      return "nested group";
    case "graph":
      return "GRAPH";
    case "minus":
      return "MINUS";
    case "service":
      return "SERVICE";
    case "bind":
      return "BIND";
    case "values":
      return "VALUES";
    default:
      return "subquery";
  }
}

function unsupportedProfileError(message: string): Error {
  return new Error(`Unsupported SPARQL ASK profile: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
