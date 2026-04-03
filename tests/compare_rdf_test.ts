import { assertEquals, assertRejects } from "@std/assert";
import {
  compareRdfContent,
  RdfCompareError,
} from "../src/checker/compare_rdf.ts";
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
