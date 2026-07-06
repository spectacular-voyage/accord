import type { FileExpectation, ManifestDocument } from "../manifest/model.ts";
import type { GitNameStatusChange } from "../git/diff.ts";

export interface DraftManifestInput {
  fromRef: string;
  toRef: string;
  changes: GitNameStatusChange[];
}

export type DraftCompareMode = "bytes" | "rdfCanonical" | "text";

export interface DraftFileExpectation extends FileExpectation {
  id: string;
  type: "FileExpectation";
  path: string;
  changeType: "added" | "removed" | "updated";
  compareMode?: DraftCompareMode;
}

const RDF_EXTENSIONS = new Set([".jsonld", ".nq", ".nt", ".ttl", ".trig"]);
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".htm",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".markdown",
  ".md",
  ".mjs",
  ".sh",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export function renderDraftManifest(input: DraftManifestInput): string {
  return `${JSON.stringify(buildDraftManifestDocument(input), null, 2)}\n`;
}

export function buildDraftManifestDocument(
  input: DraftManifestInput,
): ManifestDocument {
  const refSlug = `${slugify(input.fromRef)}-to-${slugify(input.toRef)}`;

  return {
    "@context": {
      "@vocab": "https://spectacular-voyage.github.io/accord/ontology/",
      dcterms: "http://purl.org/dc/terms/",
      id: "@id",
      type: "@type",
      changeType: {
        "@type": "@vocab",
      },
      compareMode: {
        "@type": "@vocab",
      },
    },
    type: "Manifest",
    id: `urn:accord:draft:${refSlug}`,
    "dcterms:title": `Draft manifest ${input.fromRef} to ${input.toRef}`,
    hasCase: [
      {
        type: "TransitionCase",
        id: `#draft-${refSlug}`,
        operationId: "accord.draftManifest",
        fromRef: input.fromRef,
        toRef: input.toRef,
        hasFileExpectation: draftFileExpectations(input.changes),
      },
    ],
  };
}

export function draftFileExpectations(
  changes: GitNameStatusChange[],
): DraftFileExpectation[] {
  const expectations = [...changes]
    .sort(compareChanges)
    .flatMap(expandChangeToExpectations);
  const idCounts = new Map<string, number>();

  return expectations.map((expectation) => {
    const baseId = `#${expectation.changeType}-${slugify(expectation.path)}`;
    const count = (idCounts.get(baseId) ?? 0) + 1;
    idCounts.set(baseId, count);

    return {
      id: count === 1 ? baseId : `${baseId}-${count}`,
      type: "FileExpectation",
      path: expectation.path,
      changeType: expectation.changeType,
      ...expectation.changeType === "removed"
        ? {}
        : { compareMode: inferCompareMode(expectation.path) },
    };
  });
}

export function inferCompareMode(path: string): DraftCompareMode {
  const extension = extensionOf(path);

  if (RDF_EXTENSIONS.has(extension)) {
    return "rdfCanonical";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  return "bytes";
}

function compareChanges(
  left: GitNameStatusChange,
  right: GitNameStatusChange,
): number {
  const pathCompare = changeSortPath(left).localeCompare(
    changeSortPath(right),
  );

  return pathCompare === 0
    ? left.status.localeCompare(right.status)
    : pathCompare;
}

function changeSortPath(change: GitNameStatusChange): string {
  return change.status === "R" ? change.oldPath : change.path;
}

function expandChangeToExpectations(
  change: GitNameStatusChange,
): Array<{ path: string; changeType: "added" | "removed" | "updated" }> {
  switch (change.status) {
    case "A":
      return [{ path: change.path, changeType: "added" }];
    case "D":
      return [{ path: change.path, changeType: "removed" }];
    case "M":
      return [{ path: change.path, changeType: "updated" }];
    case "R":
      return [
        { path: change.oldPath, changeType: "removed" },
        { path: change.newPath, changeType: "added" },
      ];
  }
}

function extensionOf(path: string): string {
  const fileName = path.split("/").at(-1) ?? "";
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return "";
  }

  return fileName.slice(dotIndex).toLowerCase();
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug === "" ? "value" : slug;
}
