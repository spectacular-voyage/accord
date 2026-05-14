export interface IgnorePathPattern {
  raw: string;
  normalized: string;
  matches(path: string): boolean;
}

export class IgnorePathPatternError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IgnorePathPatternError";
  }
}

export function compileIgnorePathPatterns(
  patterns: string[] = [],
): IgnorePathPattern[] {
  return patterns.map(compileIgnorePathPattern);
}

export function normalizeRepoRelativePath(path: string): string {
  return normalizeRepoRelativeInput(path, { allowGlob: false });
}

function compileIgnorePathPattern(rawPattern: string): IgnorePathPattern {
  const normalized = normalizeRepoRelativeInput(rawPattern, {
    allowGlob: true,
  });

  if (normalized.endsWith("/**")) {
    const prefix = normalized.slice(0, -3);
    if (prefix === "" || hasGlobSyntax(prefix)) {
      throw new IgnorePathPatternError(
        `Unsupported ignorePaths pattern: ${rawPattern}`,
      );
    }

    return {
      raw: rawPattern,
      normalized,
      matches: (path) => path === prefix || path.startsWith(`${prefix}/`),
    };
  }

  if (normalized.includes("**")) {
    throw new IgnorePathPatternError(
      `Unsupported ignorePaths pattern: ${rawPattern}`,
    );
  }

  if (normalized.includes("*")) {
    const pattern = new RegExp(`^${globToRegExpSource(normalized)}$`);
    return {
      raw: rawPattern,
      normalized,
      matches: (path) => pattern.test(path),
    };
  }

  return {
    raw: rawPattern,
    normalized,
    matches: (path) => path === normalized,
  };
}

function normalizeRepoRelativeInput(
  input: string,
  options: { allowGlob: boolean },
): string {
  const normalized = input.replaceAll("\\", "/");

  if (normalized === "") {
    throw new IgnorePathPatternError("ignorePaths patterns must not be empty.");
  }

  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    throw new IgnorePathPatternError(
      `ignorePaths patterns must be repo-relative POSIX paths: ${input}`,
    );
  }

  const segments = normalized.split("/");
  if (
    segments.some((segment) =>
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      (!options.allowGlob && segment.includes("*"))
    )
  ) {
    throw new IgnorePathPatternError(
      `ignorePaths patterns must not be empty, absolute, or contain traversal: ${input}`,
    );
  }

  return segments.join("/");
}

function globToRegExpSource(pattern: string): string {
  return pattern
    .split("/")
    .map((segment) =>
      segment
        .split("*")
        .map(escapeRegExp)
        .join("[^/]*")
    )
    .join("/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function hasGlobSyntax(pattern: string): boolean {
  return pattern.includes("*");
}
