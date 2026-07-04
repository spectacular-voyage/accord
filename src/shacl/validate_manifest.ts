// @deno-types="npm:@types/sparqljs@3.1.12"
import SparqlJs from "sparqljs";
import { Validator } from "shacl-engine";
import { DataFactory, Parser, Store } from "n3";
import type { Literal, NamedNode, Quad, Term } from "n3";
import { readManifestRdfSource } from "../manifest/load_jsonld.ts";
import {
  buildValidationReport,
  type ValidationReport,
  type ValidationResultRecord,
} from "../report/validation_report.ts";

const { namedNode } = DataFactory;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SH_FOCUS_NODE = "http://www.w3.org/ns/shacl#focusNode";
const SH_MESSAGE = "http://www.w3.org/ns/shacl#message";
const SH_RESULT_MESSAGE = "http://www.w3.org/ns/shacl#resultMessage";
const SH_SELECT = "http://www.w3.org/ns/shacl#select";
const SH_SPARQL = "http://www.w3.org/ns/shacl#sparql";
const SH_SPARQL_CONSTRAINT_COMPONENT =
  "http://www.w3.org/ns/shacl#SPARQLConstraintComponent";

const SHAPES_URL = new URL("../../accord-shacl.ttl", import.meta.url);
const SHAPES_BASE_IRI = "https://spectacular-voyage.github.io/accord/shacl/";
const SHAPES_DISPLAY_PATH = "accord-shacl.ttl";

export class ValidationExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationExecutionError";
  }
}

export interface ValidateManifestOptions {
  manifestPath: string;
}

type BindingMap = Map<string, Term>;

interface SparqlConstraint {
  shape: Term;
  constraint: Term;
  message: string;
  select: string;
}

interface SparqlQuery {
  queryType?: string;
  type?: string;
  where?: SparqlPattern[];
  limit?: number;
}

type SparqlPattern = SparqlBgpPattern | SparqlFilterPattern | SparqlUnionPattern;

interface SparqlBgpPattern {
  type: "bgp";
  triples: SparqlTriplePattern[];
}

interface SparqlFilterPattern {
  type: "filter";
  expression: SparqlExpression;
}

interface SparqlUnionPattern {
  type: "union";
  patterns: SparqlPattern[];
}

interface SparqlTriplePattern {
  subject: SparqlTerm;
  predicate: SparqlTerm | SparqlPath;
  object: SparqlTerm;
}

type SparqlExpression = SparqlTerm | SparqlOperation | SparqlPattern;

interface SparqlOperation {
  type: "operation";
  operator: string;
  args: Array<SparqlExpression | SparqlExpression[]>;
}

type SparqlTerm = Term | SparqlVariable;

interface SparqlVariable {
  termType: "Variable";
  value: string;
}

interface SparqlPath {
  type: "path";
  pathType: string;
  items: Array<SparqlTerm | SparqlPath>;
}

export function getShippedShapesPath(): string {
  return SHAPES_DISPLAY_PATH;
}

export async function validateManifest(
  options: ValidateManifestOptions,
): Promise<ValidationReport> {
  const manifest = await readManifestRdfSource(options.manifestPath);
  const data = new Store(manifest.quads);
  const shapes = await loadShippedShapes();

  const coreResults = await validateShaclCore(data, shapes);
  const sparqlResults = await validateSparqlConstraints(data, shapes);

  return buildValidationReport({
    manifestPath: options.manifestPath,
    shapesPath: SHAPES_DISPLAY_PATH,
    results: [...coreResults, ...sparqlResults],
  });
}

async function loadShippedShapes(): Promise<Store> {
  try {
    const text = await Deno.readTextFile(SHAPES_URL);
    return new Store(parseRdf(text, "text/turtle", SHAPES_BASE_IRI));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationExecutionError(
      `Failed to load shipped Accord SHACL shapes: ${message}`,
    );
  }
}

async function validateShaclCore(
  data: Store,
  shapes: Store,
): Promise<ValidationResultRecord[]> {
  try {
    const validator = new SHACLValidator(shapes);
    const report = await validator.validate(data);
    return validationResultsFromReportDataset(report.dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationExecutionError(
      `Failed to run SHACL Core validation: ${message}`,
    );
  }
}

function validationResultsFromReportDataset(
  dataset: Iterable<Quad> & {
    match: (subject?: Term | null, predicate?: Term | null, object?: Term | null, graph?: Term | null) => Iterable<Quad>;
  },
): ValidationResultRecord[] {
  const results: ValidationResultRecord[] = [];

  for (const quad of dataset.match(
    null,
    namedNode(RDF_TYPE),
    namedNode(SH_VALIDATION_RESULT),
    null,
  )) {
    results.push({
      severity: termLocalName(
        firstObject(dataset, quad.subject, SH_RESULT_SEVERITY),
      ) ?? "Violation",
      focusNode: serializeOptionalTerm(
        firstObject(dataset, quad.subject, SH_FOCUS_NODE),
      ),
      value: serializeOptionalTerm(firstObject(dataset, quad.subject, "http://www.w3.org/ns/shacl#value")),
      resultPath: serializeOptionalTerm(
        firstObject(dataset, quad.subject, SH_RESULT_PATH),
      ),
      sourceShape: serializeOptionalTerm(
        firstObject(dataset, quad.subject, SH_SOURCE_SHAPE),
      ),
      sourceConstraint: serializeOptionalTerm(
        firstObject(dataset, quad.subject, SH_SOURCE_CONSTRAINT),
      ),
      sourceConstraintComponent: termLocalName(
        firstObject(dataset, quad.subject, SH_SOURCE_CONSTRAINT_COMPONENT),
      ),
      message: messageObjects(dataset, quad.subject, SH_RESULT_MESSAGE).join(
        " ",
      ),
    });
  }

  return results;
}

async function validateSparqlConstraints(
  data: Store,
  shapes: Store,
): Promise<ValidationResultRecord[]> {
  const parser = new SparqlJs.Parser();
  const results: ValidationResultRecord[] = [];

  for (const constraint of sparqlConstraints(shapes)) {
    const focusNodes = resolveFocusNodes(data, shapes, constraint.shape);
    const query = parseSparqlSelect(parser, constraint.select);

    for (const focusNode of focusNodes) {
      const bindings = new Map<string, Term>([["this", focusNode]]);
      const rows = evaluateSelect(data, query, bindings);

      for (const row of rows) {
        results.push({
          severity: "Violation",
          focusNode: serializeTerm(focusNode),
          value: serializeOptionalTerm(row.get("value") ?? focusNode),
          resultPath: serializeOptionalTerm(row.get("path")),
          sourceShape: serializeTerm(constraint.shape),
          sourceConstraint: serializeTerm(constraint.constraint),
          sourceConstraintComponent: "SPARQLConstraintComponent",
          message: constraint.message,
        });
      }
    }
  }

  return results;
}

function parseSparqlSelect(
  parser: { parse: (source: string) => unknown },
  source: string,
): SparqlQuery {
  let parsed: unknown;

  try {
    parsed = parser.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationExecutionError(
      `Failed to parse SHACL SPARQL constraint query: ${message}`,
    );
  }

  if (!isRecord(parsed) || parsed.queryType !== "SELECT") {
    throw new ValidationExecutionError(
      "Only SELECT sh:sparql constraints are supported.",
    );
  }

  return parsed as SparqlQuery;
}

function sparqlConstraints(shapes: Store): SparqlConstraint[] {
  const constraints: SparqlConstraint[] = [];

  for (const quad of shapes.match(null, namedNode(SH_SPARQL), null, null)) {
    const select = firstLiteralValue(shapes, quad.object, SH_SELECT);

    if (select === undefined) {
      continue;
    }

    constraints.push({
      shape: quad.subject,
      constraint: quad.object,
      message: messageObjects(shapes, quad.object, SH_MESSAGE).join(" "),
      select,
    });
  }

  return constraints;
}

function resolveFocusNodes(
  data: Store,
  shapes: Store,
  shape: Term,
): Term[] {
  const focusNodes = new TermSet();

  for (const targetClass of objectTerms(shapes, shape, SH_TARGET_CLASS)) {
    for (const quad of data.match(
      null,
      namedNode(RDF_TYPE),
      targetClass,
      null,
    )) {
      focusNodes.add(quad.subject);
    }
  }

  for (const targetNode of objectTerms(shapes, shape, SH_TARGET_NODE)) {
    focusNodes.add(targetNode);
  }

  for (const predicate of objectTerms(shapes, shape, SH_TARGET_SUBJECTS_OF)) {
    for (const quad of data.match(null, predicate, null, null)) {
      focusNodes.add(quad.subject);
    }
  }

  for (const predicate of objectTerms(shapes, shape, SH_TARGET_OBJECTS_OF)) {
    for (const quad of data.match(null, predicate, null, null)) {
      focusNodes.add(quad.object);
    }
  }

  return focusNodes.values();
}

function evaluateSelect(
  dataset: Store,
  query: SparqlQuery,
  initialBindings: BindingMap,
): BindingMap[] {
  const rows = evaluatePatterns(
    dataset,
    query.where ?? [],
    [new Map(initialBindings)],
  );

  if (query.limit === undefined) {
    return rows;
  }

  return rows.slice(0, query.limit);
}

function evaluatePatterns(
  dataset: Store,
  patterns: SparqlPattern[],
  bindings: BindingMap[],
): BindingMap[] {
  let rows = bindings;

  for (const pattern of patterns) {
    if (pattern.type === "bgp") {
      rows = evaluateBgp(dataset, pattern.triples, rows);
    } else if (pattern.type === "filter") {
      rows = rows.filter((binding) =>
        evaluateBooleanExpression(dataset, pattern.expression, binding)
      );
    } else if (pattern.type === "union") {
      rows = evaluateUnion(dataset, pattern.patterns, rows);
    } else {
      throw new ValidationExecutionError(
        `Unsupported SHACL SPARQL pattern type: ${(pattern as { type?: string }).type}`,
      );
    }
  }

  return rows;
}

function evaluateBgp(
  dataset: Store,
  triples: SparqlTriplePattern[],
  bindings: BindingMap[],
): BindingMap[] {
  let rows = bindings;

  for (const triple of triples) {
    const nextRows: BindingMap[] = [];

    for (const binding of rows) {
      nextRows.push(...evaluateTriplePattern(dataset, triple, binding));
    }

    rows = nextRows;
  }

  return rows;
}

function evaluateTriplePattern(
  dataset: Store,
  triple: SparqlTriplePattern,
  binding: BindingMap,
): BindingMap[] {
  if (isSparqlPath(triple.predicate)) {
    return evaluatePathTriplePattern(dataset, triple, binding);
  }

  const subject = boundPatternTerm(triple.subject, binding);
  const predicate = boundPatternTerm(triple.predicate, binding);
  const object = boundPatternTerm(triple.object, binding);
  const rows: BindingMap[] = [];

  if (predicate !== null && predicate.termType !== "NamedNode") {
    return rows;
  }

  for (const quad of dataset.match(subject, predicate, object, null)) {
    const nextBinding = bindTriplePattern(triple, quad, binding);

    if (nextBinding !== null) {
      rows.push(nextBinding);
    }
  }

  return rows;
}

function evaluatePathTriplePattern(
  dataset: Store,
  triple: SparqlTriplePattern,
  binding: BindingMap,
): BindingMap[] {
  const starts = boundPatternTerm(triple.subject, binding) === null
    ? uniqueSubjects(dataset)
    : [boundPatternTerm(triple.subject, binding)!];
  const rows: BindingMap[] = [];

  for (const start of starts) {
    for (const end of followPath(dataset, [start], triple.predicate as SparqlPath)) {
      const nextBinding = bindPatternTerm(triple.subject, start, binding);

      if (nextBinding === null) {
        continue;
      }

      const finalBinding = bindPatternTerm(triple.object, end, nextBinding);

      if (finalBinding !== null) {
        rows.push(finalBinding);
      }
    }
  }

  return rows;
}

function evaluateUnion(
  dataset: Store,
  patterns: SparqlPattern[],
  bindings: BindingMap[],
): BindingMap[] {
  const rows: BindingMap[] = [];

  for (const binding of bindings) {
    for (const pattern of patterns) {
      rows.push(...evaluatePatterns(dataset, [pattern], [new Map(binding)]));
    }
  }

  return rows;
}

function evaluateBooleanExpression(
  dataset: Store,
  expression: SparqlExpression,
  binding: BindingMap,
): boolean {
  const value = evaluateExpression(dataset, expression, binding);
  return typeof value === "boolean" ? value : Boolean(value);
}

function evaluateExpression(
  dataset: Store,
  expression: SparqlExpression | SparqlExpression[],
  binding: BindingMap,
): boolean | string | Term | null {
  if (Array.isArray(expression)) {
    throw new ValidationExecutionError(
      "Unexpected SPARQL expression list outside an IN expression.",
    );
  }

  if (isTermLike(expression)) {
    return evaluateTermExpression(expression, binding);
  }

  if (isPattern(expression)) {
    return evaluatePatterns(dataset, [expression], [new Map(binding)])
      .length > 0;
  }

  if (!isOperation(expression)) {
    throw new ValidationExecutionError("Unsupported SHACL SPARQL expression.");
  }

  const operation = expression as SparqlOperation;
  const args = operation.args;

  switch (operation.operator) {
    case "&&":
      return args.every((arg: SparqlExpression | SparqlExpression[]) =>
        evaluateBooleanExpression(dataset, arg as SparqlExpression, binding)
      );
    case "||":
      return args.some((arg: SparqlExpression | SparqlExpression[]) =>
        evaluateBooleanExpression(dataset, arg as SparqlExpression, binding)
      );
    case "!":
      return !evaluateBooleanExpression(
        dataset,
        args[0] as SparqlExpression,
        binding,
      );
    case "!=":
      return !termsEqual(
        evaluateTermishExpression(dataset, args[0], binding),
        evaluateTermishExpression(dataset, args[1], binding),
      );
    case "=":
      return termsEqual(
        evaluateTermishExpression(dataset, args[0], binding),
        evaluateTermishExpression(dataset, args[1], binding),
      );
    case "contains":
      return stringValue(
        evaluateExpression(dataset, args[0], binding),
      ).includes(stringValue(evaluateExpression(dataset, args[1], binding)));
    case "in": {
      const left = evaluateTermishExpression(dataset, args[0], binding);
      const candidates = args[1];

      if (!Array.isArray(candidates)) {
        throw new ValidationExecutionError(
          "SPARQL IN expression must provide a candidate list.",
        );
      }

      return candidates.some((candidate) =>
        termsEqual(left, evaluateTermishExpression(dataset, candidate, binding))
      );
    }
    case "notexists":
      return !evaluateBooleanExpression(
        dataset,
        args[0] as SparqlExpression,
        binding,
      );
    case "str":
      return stringValue(evaluateTermishExpression(dataset, args[0], binding));
    case "strends":
      return stringValue(
        evaluateExpression(dataset, args[0], binding),
      ).endsWith(stringValue(evaluateExpression(dataset, args[1], binding)));
    case "strstarts":
      return stringValue(
        evaluateExpression(dataset, args[0], binding),
      ).startsWith(stringValue(evaluateExpression(dataset, args[1], binding)));
    default:
      throw new ValidationExecutionError(
        `Unsupported SHACL SPARQL operator: ${operation.operator}`,
      );
  }
}

function evaluateTermishExpression(
  dataset: Store,
  expression: SparqlExpression | SparqlExpression[],
  binding: BindingMap,
): Term | string | null {
  const value = evaluateExpression(dataset, expression, binding);

  if (typeof value === "boolean") {
    throw new ValidationExecutionError(
      "Expected a SPARQL term expression, but got a boolean expression.",
    );
  }

  return value;
}

function evaluateTermExpression(
  term: SparqlTerm,
  binding: BindingMap,
): Term | null {
  if (isVariable(term)) {
    return binding.get(term.value) ?? null;
  }

  return term as Term;
}

function bindTriplePattern(
  pattern: SparqlTriplePattern,
  quad: Quad,
  binding: BindingMap,
): BindingMap | null {
  const subjectBinding = bindPatternTerm(pattern.subject, quad.subject, binding);

  if (subjectBinding === null || isSparqlPath(pattern.predicate)) {
    return null;
  }

  const predicateBinding = bindPatternTerm(
    pattern.predicate,
    quad.predicate,
    subjectBinding,
  );

  if (predicateBinding === null) {
    return null;
  }

  return bindPatternTerm(pattern.object, quad.object, predicateBinding);
}

function bindPatternTerm(
  pattern: SparqlTerm,
  value: Term,
  binding: BindingMap,
): BindingMap | null {
  if (!isVariable(pattern)) {
    return termsEqual(pattern, value) ? new Map(binding) : null;
  }

  const existing = binding.get(pattern.value);

  if (existing !== undefined) {
    return termsEqual(existing, value) ? new Map(binding) : null;
  }

  const nextBinding = new Map(binding);
  nextBinding.set(pattern.value, value);
  return nextBinding;
}

function boundPatternTerm(
  pattern: SparqlTerm,
  binding: BindingMap,
): Term | null {
  if (!isVariable(pattern)) {
    return pattern as Term;
  }

  return binding.get(pattern.value) ?? null;
}

function followPath(
  dataset: Store,
  starts: Term[],
  path: SparqlPath | SparqlTerm,
): Term[] {
  if (!isSparqlPath(path)) {
    if (isVariable(path) || path.termType !== "NamedNode") {
      throw new ValidationExecutionError(
        "Only named-node property paths are supported in SHACL SPARQL constraints.",
      );
    }

    return uniqueTerms(
      starts.flatMap((start) =>
        [...dataset.match(start, path as NamedNode, null, null)].map((quad) =>
          quad.object
        )
      ),
    );
  }

  if (path.pathType === "/") {
    return path.items.reduce<Term[]>(
      (current, item) => followPath(dataset, current, item),
      starts,
    );
  }

  if (path.pathType === "*") {
    if (path.items.length !== 1) {
      throw new ValidationExecutionError(
        "Zero-or-more property paths must contain exactly one item.",
      );
    }

    return followZeroOrMorePath(dataset, starts, path.items[0]);
  }

  throw new ValidationExecutionError(
    `Unsupported SHACL SPARQL property path operator: ${path.pathType}`,
  );
}

function followZeroOrMorePath(
  dataset: Store,
  starts: Term[],
  item: SparqlPath | SparqlTerm,
): Term[] {
  const visited = new TermSet(starts);
  const queue = [...starts];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const next of followPath(dataset, [current], item)) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return visited.values();
}

function parseRdf(text: string, format: string, baseIri: string): Quad[] {
  try {
    return new Parser({ format, baseIRI: baseIri }).parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationExecutionError(
      `Failed to parse RDF validation input: ${message}`,
    );
  }
}

function firstObject(
  dataset: Iterable<Quad> & {
    match: (subject?: Term | null, predicate?: Term | null, object?: Term | null, graph?: Term | null) => Iterable<Quad>;
  },
  subject: Term,
  predicate: string,
): Term | undefined {
  for (const quad of dataset.match(subject, namedNode(predicate), null, null)) {
    return quad.object;
  }

  return undefined;
}

function firstLiteralValue(
  dataset: Store,
  subject: Term,
  predicate: string,
): string | undefined {
  const object = firstObject(dataset, subject, predicate);
  return object?.termType === "Literal" ? object.value : undefined;
}

function messageObjects(
  dataset: Iterable<Quad> & {
    match: (subject?: Term | null, predicate?: Term | null, object?: Term | null, graph?: Term | null) => Iterable<Quad>;
  },
  subject: Term,
  predicate: string,
): string[] {
  return [...dataset.match(subject, namedNode(predicate), null, null)]
    .map((quad) => quad.object.value)
    .sort();
}

function objectTerms(
  dataset: Store,
  subject: Term,
  predicate: string,
): Term[] {
  return [...dataset.match(subject, namedNode(predicate), null, null)].map((
    quad,
  ) => quad.object);
}

function uniqueSubjects(dataset: Store): Term[] {
  return uniqueTerms([...dataset.match(null, null, null, null)].map((quad) =>
    quad.subject
  ));
}

function uniqueTerms(terms: Term[]): Term[] {
  return new TermSet(terms).values();
}

function stringValue(value: boolean | string | Term | null): string {
  if (value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value.toString();
  }

  return value.value;
}

function serializeOptionalTerm(term: Term | undefined): string | undefined {
  return term === undefined ? undefined : serializeTerm(term);
}

function serializeTerm(term: Term): string {
  if (term.termType === "NamedNode") {
    return term.value;
  }

  if (term.termType === "BlankNode") {
    return `_:${term.value}`;
  }

  if (term.termType === "Literal") {
    return serializeLiteral(term as Literal);
  }

  return term.value;
}

function serializeLiteral(term: Literal): string {
  const quotedValue = JSON.stringify(term.value);

  if (term.language !== "") {
    return `${quotedValue}@${term.language}`;
  }

  if (
    term.datatype.value !== "http://www.w3.org/2001/XMLSchema#string" &&
    term.datatype.value !== "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
  ) {
    return `${quotedValue}^^${term.datatype.value}`;
  }

  return quotedValue;
}

function termLocalName(term: Term | undefined): string | undefined {
  if (term === undefined) {
    return undefined;
  }

  const value = term.value;
  const separator = Math.max(value.lastIndexOf("#"), value.lastIndexOf("/"));
  return separator === -1 ? value : value.slice(separator + 1);
}

function termsEqual(
  left: Term | string | null,
  right: Term | string | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  if (typeof left === "string" || typeof right === "string") {
    return left === right;
  }

  return left.equals(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTermLike(value: unknown): value is SparqlTerm {
  return isRecord(value) && typeof value.termType === "string";
}

function isVariable(value: unknown): value is SparqlVariable {
  return isRecord(value) && value.termType === "Variable";
}

function isPattern(value: unknown): value is SparqlPattern {
  return isRecord(value) &&
    (value.type === "bgp" || value.type === "filter" || value.type === "union");
}

function isOperation(value: unknown): value is SparqlOperation {
  return isRecord(value) && value.type === "operation" &&
    typeof value.operator === "string" && Array.isArray(value.args);
}

function isSparqlPath(value: unknown): value is SparqlPath {
  return isRecord(value) && value.type === "path" &&
    typeof value.pathType === "string" && Array.isArray(value.items);
}

class TermSet {
  #terms = new Map<string, Term>();

  constructor(terms: Term[] = []) {
    for (const term of terms) {
      this.add(term);
    }
  }

  add(term: Term): void {
    this.#terms.set(serializeTermKey(term), term);
  }

  has(term: Term): boolean {
    return this.#terms.has(serializeTermKey(term));
  }

  values(): Term[] {
    return [...this.#terms.values()].sort((left, right) =>
      serializeTerm(left).localeCompare(serializeTerm(right))
    );
  }
}

function serializeTermKey(term: Term): string {
  if (term.termType === "Literal") {
    const literal = term as Literal;
    return [
      term.termType,
      literal.value,
      literal.language,
      literal.datatype.value,
    ].join("\u0000");
  }

  return `${term.termType}\u0000${term.value}`;
}
