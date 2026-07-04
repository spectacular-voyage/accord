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

Deno.test("runAskAssertion supports basic ASK graph patterns", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query: `
      ASK {
        ?person a <https://example.test/Person> ;
          <https://example.test/name> "Alice" ;
          <https://example.test/knows> ?friend .
        ?friend a <https://example.test/Person>, <https://example.test/Person> ;
          <https://example.test/name> "Bob" .
      }
    `,
  });

  assertEquals(result, true);
});

Deno.test("runAskAssertion supports PREFIX declarations in ASK queries", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query: `
      PREFIX ex: <https://example.test/>
      ASK WHERE {
        ex:alice a ex:Person .
      }
    `,
  });

  assertEquals(result, true);
});

Deno.test("runAskAssertion preserves variable bindings across ASK patterns", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query: `
      ASK {
        ?person <https://example.test/knows> ?friend .
        ?friend <https://example.test/name> "Alice" .
      }
    `,
  });

  assertEquals(result, false);
});

Deno.test("runAskAssertion supports FILTER NOT EXISTS when the pattern is absent", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query: `
      ASK {
        FILTER NOT EXISTS {
          ?relator <https://example.test/endedAt> ?end .
        }
      }
    `,
  });

  assertEquals(result, true);
});

Deno.test("runAskAssertion supports FILTER NOT EXISTS when the pattern is present", async () => {
  const dataset = encodeRdf(`
    @prefix ex: <https://example.test/> .

    ex:relator
      a ex:TemporalRelator ;
      ex:endedAt "2026-07-04T12:00:00Z" .
  `);

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query: `
      ASK {
        FILTER NOT EXISTS {
          ?relator <https://example.test/endedAt> ?end .
        }
      }
    `,
  });

  assertEquals(result, false);
});

Deno.test("runAskAssertion applies FILTER NOT EXISTS to sibling pattern bindings regardless of source order", async () => {
  const dataset = encodeRdf(`
    <urn:alice> a <urn:Relator> .
    <urn:bob> <urn:endedAt> "2026-07-04T12:00:00Z" .
  `);

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query: `
      ASK {
        FILTER NOT EXISTS { ?r <urn:endedAt> ?end . }
        ?r a <urn:Relator> .
      }
    `,
  });

  assertEquals(result, true);
});

Deno.test("runAskAssertion supports bare boolean and numeric SPARQL literals", async () => {
  const dataset = encodeRdf(`
    @prefix ex: <https://example.test/> .

    ex:relator
      ex:active true ;
      ex:archived false ;
      ex:score 7 ;
      ex:ratio 3.5 .
  `);

  const result = await runAskAssertion({
    dataset,
    path: "graph.ttl",
    query: `
      ASK {
        <https://example.test/relator> <https://example.test/active> true ;
          <https://example.test/archived> false ;
          <https://example.test/score> 7 ;
          <https://example.test/ratio> 3.5 .
      }
    `,
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

Deno.test("runAskAssertion supports FILTER NOT EXISTS for JSON-LD datasets", async () => {
  const datasetPath =
    "testdata/repos/repo-rdf-jsonld/refs/r2-graph-v1-local-context/graph.jsonld";
  const dataset = await Deno.readFile(datasetPath);

  const result = await runAskAssertion({
    dataset,
    path: "graph.jsonld",
    query: `
      ASK {
        FILTER NOT EXISTS {
          ?person <https://example.test/endedAt> ?end .
        }
      }
    `,
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

Deno.test("runAskAssertion reports unsupported SPARQL profile features", async () => {
  const dataset = await Deno.readFile(
    "testdata/repos/repo-rdf/refs/r1-graph-v1/graph.ttl",
  );

  await assertRejects(
    () =>
      runAskAssertion({
        dataset,
        path: "graph.ttl",
        query: `
          ASK {
            SERVICE <https://example.invalid/sparql> {
              ?s ?p ?o .
            }
          }
        `,
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

function encodeRdf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
