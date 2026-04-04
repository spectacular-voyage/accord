import { assertEquals, assertRejects } from "@std/assert";
import { runAskAssertion, SparqlAskError } from "../src/checker/sparql.ts";
import { RdfCompareError } from "../src/checker/compare_rdf.ts";
import { createFileJsonLdDocumentContext } from "../src/jsonld/documents.ts";
import { CHECK_CODES } from "../src/report/codes.ts";

Deno.test("runAskAssertion returns true for a matching ASK query", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query:
      "ASK { <https://example.test/alice> a <https://example.test/Person> . }",
  });

  assertEquals(result, true);
});

Deno.test("runAskAssertion returns false for a non-matching ASK query", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query:
      "ASK { <https://example.test/carol> a <https://example.test/Person> . }",
  });

  assertEquals(result, false);
});

Deno.test("runAskAssertion supports JSON-LD datasets with local file contexts", async () => {
  const datasetPath =
    "testdata/repos/repo-rdf-jsonld/refs/r2-graph-v1-local-context/graph.jsonld";
  const dataset = await Deno.readFile(datasetPath);

  const result = await runAskAssertion({
    dataset,
    path: "graph.jsonld",
    query:
      "ASK { <https://example.test/alice> a <https://example.test/Person> . }",
    documentContext: createTestJsonLdDocumentContext(datasetPath),
  });

  assertEquals(result, true);
});

Deno.test("runAskAssertion reports invalid RDF input", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r5-graph-invalid/graph.ttl",
  );

  await assertRejects(
    () =>
      runAskAssertion({
        dataset,
        path: "graph.ttl",
        query: "ASK { ?s ?p ?o }",
      }),
    Error,
    "Failed to parse RDF input",
  );
});

Deno.test("runAskAssertion reports invalid SPARQL queries", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );

  await assertRejects(
    () =>
      runAskAssertion({
        dataset,
        path: "graph.ttl",
        query: "ASK WHERE {",
      }),
    SparqlAskError,
    "Failed to execute SPARQL ASK query",
  );
});

function createTestJsonLdDocumentContext(documentPath: string) {
  return createFileJsonLdDocumentContext(
    documentPath,
    (code, message) => new RdfCompareError(code, message),
    CHECK_CODES.RDF_PARSE_ERROR,
  );
}
