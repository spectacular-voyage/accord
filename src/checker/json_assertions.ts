import type { JsonAssertion, JsonScalar } from "../manifest/model.ts";
import { CHECK_CODES, type CheckCode } from "../report/codes.ts";

type JsonPathSegment =
  | { type: "child"; name: string }
  | { type: "wildcard" }
  | { type: "index"; index: number }
  | { type: "recursiveChild"; name: string }
  | { type: "recursiveWildcard" };

export interface JsonAssertionEvaluation {
  passed: boolean;
  code: CheckCode;
  message: string;
  matchCount: number;
}

export class JsonAssertionError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "JsonAssertionError";
    this.code = code;
  }
}

export function parseJsonArtifact(bytes: Uint8Array, path: string): unknown {
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new JsonAssertionError(
      CHECK_CODES.JSON_PARSE_ERROR,
      `Failed to decode JSON artifact at ${path} as UTF-8: ${message}`,
    );
  }

  try {
    new DuplicateKeyScanner(text, path).scan();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof JsonAssertionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new JsonAssertionError(
      CHECK_CODES.JSON_PARSE_ERROR,
      `Failed to parse JSON artifact at ${path}: ${message}`,
    );
  }
}

export function evaluateJsonAssertion(
  document: unknown,
  assertion: JsonAssertion,
): JsonAssertionEvaluation {
  const path = assertion.jsonPath;
  const assertionKind = assertion.jsonAssertionKind;

  if (typeof path !== "string" || path === "") {
    throw new JsonAssertionError(
      CHECK_CODES.JSON_PATH_MISSING,
      "JSON assertion is missing jsonPath.",
    );
  }

  const matches = evaluateJsonPath(document, path);
  const matchCount = matches.length;

  if (assertionKind === "exists") {
    const passed = matchCount > 0;
    return {
      passed,
      code: passed
        ? CHECK_CODES.JSON_ASSERTION_OK
        : CHECK_CODES.JSON_ASSERTION_MISMATCH,
      message: passed
        ? `JSON path ${path} matched ${matchCount} value(s).`
        : `Expected JSON path ${path} to match at least one value, but it matched 0.`,
      matchCount,
    };
  }

  if (assertionKind === "notExists") {
    const passed = matchCount === 0;
    return {
      passed,
      code: passed
        ? CHECK_CODES.JSON_ASSERTION_OK
        : CHECK_CODES.JSON_ASSERTION_MISMATCH,
      message: passed
        ? `JSON path ${path} matched no values.`
        : `Expected JSON path ${path} to match no values, but it matched ${matchCount}.`,
      matchCount,
    };
  }

  if (assertionKind === "equals") {
    const expectedValue = assertion.expectedValue;
    if (!isJsonScalar(expectedValue)) {
      throw new JsonAssertionError(
        CHECK_CODES.JSON_EXPECTED_VALUE_MISSING,
        "JSON equals assertion is missing scalar expectedValue.",
      );
    }

    const passed = matches.some((match) =>
      isJsonScalar(match) && match === expectedValue
    );
    return {
      passed,
      code: passed
        ? CHECK_CODES.JSON_ASSERTION_OK
        : CHECK_CODES.JSON_ASSERTION_MISMATCH,
      message: passed
        ? `JSON path ${path} included expected value ${
          formatJsonScalar(expectedValue)
        }.`
        : `Expected JSON path ${path} to include ${
          formatJsonScalar(expectedValue)
        }, but it did not among ${matchCount} match(es).`,
      matchCount,
    };
  }

  if (assertionKind === "count") {
    const expectedCount = assertion.expectedCount;
    if (
      typeof expectedCount !== "number" || !Number.isInteger(expectedCount) ||
      expectedCount < 0
    ) {
      throw new JsonAssertionError(
        CHECK_CODES.JSON_EXPECTED_COUNT_INVALID,
        "JSON count assertion is missing non-negative integer expectedCount.",
      );
    }

    const passed = matchCount === expectedCount;
    return {
      passed,
      code: passed
        ? CHECK_CODES.JSON_ASSERTION_OK
        : CHECK_CODES.JSON_ASSERTION_MISMATCH,
      message: passed
        ? `JSON path ${path} matched expected count ${expectedCount}.`
        : `Expected JSON path ${path} to match ${expectedCount} value(s), but it matched ${matchCount}.`,
      matchCount,
    };
  }

  throw new JsonAssertionError(
    CHECK_CODES.JSON_ASSERTION_KIND_UNSUPPORTED,
    `Unsupported JSON assertion kind: ${String(assertionKind)}`,
  );
}

export function evaluateJsonPath(document: unknown, path: string): unknown[] {
  const segments = parseJsonPath(path);
  let current = [document];

  for (const segment of segments) {
    current = evaluateJsonPathSegment(current, segment);
  }

  return current;
}

function evaluateJsonPathSegment(
  values: unknown[],
  segment: JsonPathSegment,
): unknown[] {
  const next: unknown[] = [];

  for (const value of values) {
    if (segment.type === "child") {
      if (isRecord(value) && Object.hasOwn(value, segment.name)) {
        next.push(value[segment.name]);
      }
      continue;
    }

    if (segment.type === "wildcard") {
      next.push(...childrenOf(value));
      continue;
    }

    if (segment.type === "index") {
      if (Array.isArray(value) && segment.index < value.length) {
        next.push(value[segment.index]);
      }
      continue;
    }

    if (segment.type === "recursiveChild") {
      collectRecursiveChild(value, segment.name, next);
      continue;
    }

    collectRecursiveWildcard(value, next);
  }

  return next;
}

function collectRecursiveChild(
  value: unknown,
  name: string,
  matches: unknown[],
): void {
  if (Array.isArray(value)) {
    for (const child of value) {
      collectRecursiveChild(child, name, matches);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === name) {
      matches.push(child);
    }
    collectRecursiveChild(child, name, matches);
  }
}

function collectRecursiveWildcard(value: unknown, matches: unknown[]): void {
  for (const child of childrenOf(value)) {
    matches.push(child);
    collectRecursiveWildcard(child, matches);
  }
}

function childrenOf(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (isRecord(value)) {
    return Object.values(value);
  }

  return [];
}

function parseJsonPath(path: string): JsonPathSegment[] {
  if (!path.startsWith("$")) {
    throw unsupportedPath(path, "JSON path must start with root '$'.");
  }

  const segments: JsonPathSegment[] = [];
  let index = 1;

  while (index < path.length) {
    if (path.startsWith("..", index)) {
      const result = parseRecursiveSegment(path, index + 2);
      segments.push(result.segment);
      index = result.nextIndex;
      continue;
    }

    const operator = path[index];
    if (operator === ".") {
      const result = parseDotSegment(path, index + 1);
      segments.push(result.segment);
      index = result.nextIndex;
      continue;
    }

    if (operator === "[") {
      const result = parseBracketSegment(path, index + 1, false);
      segments.push(result.segment);
      index = result.nextIndex;
      continue;
    }

    throw unsupportedPath(
      path,
      `Unsupported JSON path syntax at offset ${index}.`,
    );
  }

  return segments;
}

function parseRecursiveSegment(
  path: string,
  start: number,
): { segment: JsonPathSegment; nextIndex: number } {
  if (start >= path.length) {
    throw unsupportedPath(path, "Recursive descent must name a selector.");
  }

  if (path[start] === "*") {
    return {
      segment: { type: "recursiveWildcard" },
      nextIndex: start + 1,
    };
  }

  if (path[start] === "[" || path[start] === "'" || path[start] === '"') {
    if (path[start] === "[") {
      const result = parseBracketSegment(path, start + 1, true);
      if (result.segment.type === "wildcard") {
        return {
          segment: { type: "recursiveWildcard" },
          nextIndex: result.nextIndex,
        };
      }

      if (result.segment.type !== "child") {
        throw unsupportedPath(
          path,
          "Recursive descent supports names and wildcards, not indexes.",
        );
      }

      return {
        segment: { type: "recursiveChild", name: result.segment.name },
        nextIndex: result.nextIndex,
      };
    }

    const result = parseQuotedString(path, start);
    return {
      segment: { type: "recursiveChild", name: result.value },
      nextIndex: result.nextIndex,
    };
  }

  const result = parseBareName(path, start);
  return {
    segment: { type: "recursiveChild", name: result.name },
    nextIndex: result.nextIndex,
  };
}

function parseDotSegment(
  path: string,
  start: number,
): { segment: JsonPathSegment; nextIndex: number } {
  if (start >= path.length) {
    throw unsupportedPath(path, "Dot child access must name a selector.");
  }

  if (path[start] === "*") {
    return {
      segment: { type: "wildcard" },
      nextIndex: start + 1,
    };
  }

  const result = parseBareName(path, start);
  return {
    segment: { type: "child", name: result.name },
    nextIndex: result.nextIndex,
  };
}

function parseBracketSegment(
  path: string,
  start: number,
  recursive: boolean,
): { segment: JsonPathSegment; nextIndex: number } {
  if (start >= path.length) {
    throw unsupportedPath(path, "Bracket child access is incomplete.");
  }

  if (path[start] === "*") {
    const nextIndex = start + 1;
    assertClosingBracket(path, nextIndex);
    return {
      segment: { type: "wildcard" },
      nextIndex: nextIndex + 1,
    };
  }

  if (path[start] === "'" || path[start] === '"') {
    const result = parseQuotedString(path, start);
    assertClosingBracket(path, result.nextIndex);
    return {
      segment: { type: "child", name: result.value },
      nextIndex: result.nextIndex + 1,
    };
  }

  const indexResult = parseArrayIndex(path, start);
  if (indexResult !== null) {
    assertClosingBracket(path, indexResult.nextIndex);
    if (recursive) {
      throw unsupportedPath(
        path,
        "Recursive descent supports names and wildcards, not indexes.",
      );
    }
    return {
      segment: { type: "index", index: indexResult.index },
      nextIndex: indexResult.nextIndex + 1,
    };
  }

  throw unsupportedPath(
    path,
    `Unsupported bracket selector at offset ${start}.`,
  );
}

function parseBareName(
  path: string,
  start: number,
): { name: string; nextIndex: number } {
  const first = path[start];
  if (!isBareNameStart(first)) {
    throw unsupportedPath(
      path,
      `Expected a JSON object member name at offset ${start}.`,
    );
  }

  let index = start + 1;
  while (index < path.length && isBareNameContinue(path[index])) {
    index++;
  }

  return {
    name: path.slice(start, index),
    nextIndex: index,
  };
}

function parseArrayIndex(
  path: string,
  start: number,
): { index: number; nextIndex: number } | null {
  if (!isDigit(path[start])) {
    return null;
  }

  let index = start + 1;
  while (index < path.length && isDigit(path[index])) {
    index++;
  }

  return {
    index: Number(path.slice(start, index)),
    nextIndex: index,
  };
}

function parseQuotedString(
  path: string,
  start: number,
): { value: string; nextIndex: number } {
  const quote = path[start];
  if (quote !== "'" && quote !== '"') {
    throw unsupportedPath(path, `Expected quoted name at offset ${start}.`);
  }

  let index = start + 1;
  let value = "";

  while (index < path.length) {
    const char = path[index];
    if (char === quote) {
      return { value, nextIndex: index + 1 };
    }

    if (char === "\\") {
      const escape = path[index + 1];
      if (escape === undefined) {
        throw unsupportedPath(path, "Quoted name has a trailing escape.");
      }

      if (escape === "u") {
        const hex = path.slice(index + 2, index + 6);
        if (!/^[0-9A-Fa-f]{4}$/.test(hex)) {
          throw unsupportedPath(
            path,
            "Quoted name contains an invalid unicode escape.",
          );
        }
        value += String.fromCharCode(Number.parseInt(hex, 16));
        index += 6;
        continue;
      }

      const escaped = decodeSimpleEscape(escape, quote);
      if (escaped === undefined) {
        throw unsupportedPath(
          path,
          `Quoted name contains unsupported escape \\${escape}.`,
        );
      }
      value += escaped;
      index += 2;
      continue;
    }

    value += char;
    index++;
  }

  throw unsupportedPath(path, "Quoted name is unterminated.");
}

function decodeSimpleEscape(
  escape: string,
  quote: string,
): string | undefined {
  if (escape === '"' || escape === "\\" || escape === "/") {
    return escape;
  }

  if (quote === "'" && escape === "'") {
    return "'";
  }

  switch (escape) {
    case "b":
      return "\b";
    case "f":
      return "\f";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    default:
      return undefined;
  }
}

function assertClosingBracket(path: string, index: number): void {
  if (path[index] !== "]") {
    throw unsupportedPath(path, `Expected closing bracket at offset ${index}.`);
  }
}

function unsupportedPath(path: string, reason: string): JsonAssertionError {
  return new JsonAssertionError(
    CHECK_CODES.JSON_PATH_UNSUPPORTED,
    `Unsupported JSON path ${path}: ${reason}`,
  );
}

function isBareNameStart(value: string | undefined): boolean {
  return value !== undefined && /^[A-Za-z_]$/.test(value);
}

function isBareNameContinue(value: string | undefined): boolean {
  return value !== undefined && /^[A-Za-z0-9_-]$/.test(value);
}

function isDigit(value: string | undefined): boolean {
  return value !== undefined && /^[0-9]$/.test(value);
}

function isJsonScalar(value: unknown): value is JsonScalar {
  return typeof value === "string" || typeof value === "number" ||
    typeof value === "boolean";
}

function formatJsonScalar(value: JsonScalar): string {
  return JSON.stringify(value);
}

class DuplicateKeyScanner {
  #index = 0;

  constructor(
    private readonly text: string,
    private readonly path: string,
  ) {}

  scan(): void {
    this.#parseValue();
    this.#skipWhitespace();
    if (!this.#isEnd()) {
      this.#parseError("Unexpected content after the JSON value.");
    }
  }

  #parseValue(): void {
    this.#skipWhitespace();

    const char = this.text[this.#index];
    if (char === "{") {
      this.#parseObject();
      return;
    }
    if (char === "[") {
      this.#parseArray();
      return;
    }
    if (char === '"') {
      this.#parseString();
      return;
    }
    if (char === "-" || isDigit(char)) {
      this.#parseNumber();
      return;
    }
    if (this.text.startsWith("true", this.#index)) {
      this.#index += 4;
      return;
    }
    if (this.text.startsWith("false", this.#index)) {
      this.#index += 5;
      return;
    }
    if (this.text.startsWith("null", this.#index)) {
      this.#index += 4;
      return;
    }

    this.#parseError("Expected a JSON value.");
  }

  #parseObject(): void {
    this.#consume("{");
    this.#skipWhitespace();

    const keys = new Set<string>();
    if (this.text[this.#index] === "}") {
      this.#index++;
      return;
    }

    while (!this.#isEnd()) {
      this.#skipWhitespace();
      if (this.text[this.#index] !== '"') {
        this.#parseError("Expected a JSON object member name.");
      }

      const key = this.#parseString();
      if (keys.has(key)) {
        throw new JsonAssertionError(
          CHECK_CODES.JSON_DUPLICATE_KEY,
          `JSON artifact at ${this.path} contains a duplicate object key ${
            JSON.stringify(key)
          }.`,
        );
      }
      keys.add(key);

      this.#skipWhitespace();
      this.#consume(":");
      this.#parseValue();
      this.#skipWhitespace();

      if (this.text[this.#index] === "}") {
        this.#index++;
        return;
      }

      this.#consume(",");
    }

    this.#parseError("Unterminated JSON object.");
  }

  #parseArray(): void {
    this.#consume("[");
    this.#skipWhitespace();

    if (this.text[this.#index] === "]") {
      this.#index++;
      return;
    }

    while (!this.#isEnd()) {
      this.#parseValue();
      this.#skipWhitespace();

      if (this.text[this.#index] === "]") {
        this.#index++;
        return;
      }

      this.#consume(",");
    }

    this.#parseError("Unterminated JSON array.");
  }

  #parseString(): string {
    this.#consume('"');
    let value = "";

    while (!this.#isEnd()) {
      const char = this.text[this.#index];

      if (char === '"') {
        this.#index++;
        return value;
      }

      if (char === "\\") {
        const escape = this.text[this.#index + 1];
        if (escape === undefined) {
          this.#parseError("String has a trailing escape.");
        }

        if (escape === "u") {
          const hex = this.text.slice(this.#index + 2, this.#index + 6);
          if (!/^[0-9A-Fa-f]{4}$/.test(hex)) {
            this.#parseError("String contains an invalid unicode escape.");
          }
          value += String.fromCharCode(Number.parseInt(hex, 16));
          this.#index += 6;
          continue;
        }

        const escaped = decodeJsonStringEscape(escape);
        if (escaped === undefined) {
          this.#parseError(`String contains unsupported escape \\${escape}.`);
        }
        value += escaped;
        this.#index += 2;
        continue;
      }

      if (char < " ") {
        this.#parseError("String contains an unescaped control character.");
      }

      value += char;
      this.#index++;
    }

    this.#parseError("Unterminated JSON string.");
  }

  #parseNumber(): void {
    if (this.text[this.#index] === "-") {
      this.#index++;
    }

    if (this.text[this.#index] === "0") {
      this.#index++;
    } else if (isDigitOneToNine(this.text[this.#index])) {
      this.#index++;
      while (isDigit(this.text[this.#index])) {
        this.#index++;
      }
    } else {
      this.#parseError("Invalid JSON number.");
    }

    if (this.text[this.#index] === ".") {
      this.#index++;
      if (!isDigit(this.text[this.#index])) {
        this.#parseError("Invalid JSON number fraction.");
      }
      while (isDigit(this.text[this.#index])) {
        this.#index++;
      }
    }

    if (
      this.text[this.#index] === "e" || this.text[this.#index] === "E"
    ) {
      this.#index++;
      if (this.text[this.#index] === "+" || this.text[this.#index] === "-") {
        this.#index++;
      }
      if (!isDigit(this.text[this.#index])) {
        this.#parseError("Invalid JSON number exponent.");
      }
      while (isDigit(this.text[this.#index])) {
        this.#index++;
      }
    }
  }

  #consume(expected: string): void {
    if (this.text[this.#index] !== expected) {
      this.#parseError(`Expected ${expected}.`);
    }
    this.#index++;
  }

  #skipWhitespace(): void {
    while (/[\t\n\r ]/.test(this.text[this.#index] ?? "")) {
      this.#index++;
    }
  }

  #isEnd(): boolean {
    return this.#index >= this.text.length;
  }

  #parseError(message: string): never {
    throw new JsonAssertionError(
      CHECK_CODES.JSON_PARSE_ERROR,
      `Failed to parse JSON artifact at ${this.path}: ${message}`,
    );
  }
}

function decodeJsonStringEscape(escape: string): string | undefined {
  switch (escape) {
    case '"':
    case "\\":
    case "/":
      return escape;
    case "b":
      return "\b";
    case "f":
      return "\f";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    default:
      return undefined;
  }
}

function isDigitOneToNine(value: string | undefined): boolean {
  return value !== undefined && /^[1-9]$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
