import { assertEquals, assertRejects } from "@std/assert";
import {
  compareRdfContent,
  parseRdfContent,
  RdfCompareError,
} from "../src/checker/compare_rdf.ts";
import { createFileJsonLdDocumentContext } from "../src/jsonld/documents.ts";
import { CHECK_CODES } from "../src/report/codes.ts";
import * as rdfCanonize from "rdf-canonize";

Deno.test("rdf-canonize canonizes equivalent blank-node datasets consistently", async () => {
  const leftDataset = [
    "_:b0 <https://example.com/q> _:b1 .",
    '_:b0 <https://example.com/p> "left" .',
    '_:b1 <https://example.com/p> "right" .',
  ].join("\n");

  const rightDataset = [
    '_:x9 <https://example.com/p> "left" .',
    '_:x8 <https://example.com/p> "right" .',
    "_:x9 <https://example.com/q> _:x8 .",
  ].join("\n");

  const leftCanonical = await rdfCanonize.canonize(leftDataset, {
    algorithm: "RDFC-1.0",
    inputFormat: "application/n-quads",
  });
  const rightCanonical = await rdfCanonize.canonize(rightDataset, {
    algorithm: "RDFC-1.0",
    inputFormat: "application/n-quads",
  });

  assertEquals(leftCanonical, rightCanonical);
});

Deno.test("compareRdfContent treats equivalent Turtle serializations as equal", async () => {
  const left = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );
  const right = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r2-graph-v1-reformatted/graph.ttl",
  );

  const equal = await compareRdfContent({
    left,
    right,
    path: "graph.ttl",
  });

  assertEquals(equal, true);
});

Deno.test("compareRdfContent honors ignorePredicate during equivalence checks", async () => {
  const left = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );
  const right = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r3-graph-v1-ignored-only/graph.ttl",
  );

  const equal = await compareRdfContent({
    left,
    right,
    path: "graph.ttl",
    ignorePredicates: ["http://purl.org/dc/terms/updated"],
  });

  assertEquals(equal, true);
});

Deno.test("compareRdfContent detects meaningful RDF graph changes", async () => {
  const left = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );
  const right = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r4-graph-v2/graph.ttl",
  );

  const equal = await compareRdfContent({
    left,
    right,
    path: "graph.ttl",
  });

  assertEquals(equal, false);
});

Deno.test("parseRdfContent loads JSON-LD RDF artifacts through local file contexts", async () => {
  const datasetPath =
    "testdata/repos/repo-rdf-jsonld/refs/r2-graph-v1-local-context/graph.jsonld";
  const dataset = await Deno.readFile(datasetPath);

  const quads = await parseRdfContent({
    bytes: dataset,
    path: "graph.jsonld",
    documentContext: createTestJsonLdDocumentContext(datasetPath),
  });

  assertEquals(quads.length, 6);
});

Deno.test("compareRdfContent treats equivalent JSON-LD artifacts as equal", async () => {
  const leftPath =
    "testdata/repos/repo-rdf-jsonld/refs/r1-graph-v1-inline/graph.jsonld";
  const rightPath =
    "testdata/repos/repo-rdf-jsonld/refs/r2-graph-v1-local-context/graph.jsonld";
  const left = await Deno.readFile(leftPath);
  const right = await Deno.readFile(rightPath);

  const equal = await compareRdfContent({
    left,
    right,
    path: "graph.jsonld",
    leftDocumentContext: createTestJsonLdDocumentContext(leftPath),
    rightDocumentContext: createTestJsonLdDocumentContext(rightPath),
  });

  assertEquals(equal, true);
});

Deno.test("compareRdfContent rejects disallowed remote JSON-LD contexts", async () => {
  const leftPath =
    "testdata/repos/repo-rdf-jsonld/refs/r1-graph-v1-inline/graph.jsonld";
  const rightPath =
    "testdata/repos/repo-rdf-jsonld/refs/r5-graph-remote-context/graph.jsonld";
  const left = await Deno.readFile(leftPath);
  const right = await Deno.readFile(rightPath);

  await assertRejects(
    () =>
      compareRdfContent({
        left,
        right,
        path: "graph.jsonld",
        leftDocumentContext: createTestJsonLdDocumentContext(leftPath),
        rightDocumentContext: createTestJsonLdDocumentContext(rightPath),
      }),
    RdfCompareError,
    "Remote JSON-LD context is not allowlisted",
  );
});

Deno.test("compareRdfContent reports RDF parse errors", async () => {
  const left = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );
  const right = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r5-graph-invalid/graph.ttl",
  );

  await assertRejects(
    () =>
      compareRdfContent({
        left,
        right,
        path: "graph.ttl",
      }),
    RdfCompareError,
    "Failed to parse RDF input",
  );
});

function createTestJsonLdDocumentContext(documentPath: string) {
  return createFileJsonLdDocumentContext(
    documentPath,
    (code, message) => new RdfCompareError(code, message),
    CHECK_CODES.RDF_PARSE_ERROR,
  );
}
