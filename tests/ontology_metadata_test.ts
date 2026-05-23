import { assert, assertEquals } from "@std/assert";
import { Parser } from "n3";

const OLD_IRI_FRAGMENTS = [
  "https://spectacular-voyage.github.io/accord/ns#",
  "https://spectacular-voyage.github.io/accord/shapes#",
  "https://spectacular-voyage.github.io/accord/accord-ontology",
];

Deno.test("Accord ontology metadata uses slash namespace and release version IRIs", async () => {
  const text = await Deno.readTextFile("accord-ontology.ttl");

  assertParsesAsTurtle(text);
  assertEquals(
    OLD_IRI_FRAGMENTS.filter((fragment) => text.includes(fragment)),
    [],
  );
  assert(
    text.includes(
      "@base <https://spectacular-voyage.github.io/accord/ontology/> .",
    ),
  );
  assert(
    text.includes(
      "@prefix accord: <https://spectacular-voyage.github.io/accord/ontology/> .",
    ),
  );
  assert(
    text.includes(
      "<https://spectacular-voyage.github.io/accord/ontology> a owl:Ontology ;",
    ),
  );
  assert(text.includes('owl:versionInfo "0.1.0"'));
  assert(
    text.includes(
      'vann:preferredNamespaceUri "https://spectacular-voyage.github.io/accord/ontology/"',
    ),
  );
  assert(
    text.includes(
      "<https://spectacular-voyage.github.io/accord/ontology/releases/v0.1.0>",
    ),
  );
});

Deno.test("Accord SHACL metadata uses slash namespace and release version IRIs", async () => {
  const text = await Deno.readTextFile("accord-shacl.ttl");

  assertParsesAsTurtle(text);
  assertEquals(
    OLD_IRI_FRAGMENTS.filter((fragment) => text.includes(fragment)),
    [],
  );
  assert(
    text.includes(
      "@base <https://spectacular-voyage.github.io/accord/shacl/> .",
    ),
  );
  assert(
    text.includes(
      "@prefix accord-sh: <https://spectacular-voyage.github.io/accord/shacl/> .",
    ),
  );
  assert(
    text.includes(
      "<https://spectacular-voyage.github.io/accord/shacl> a owl:Ontology ;",
    ),
  );
  assert(text.includes('owl:versionInfo "0.1.0"'));
  assert(
    text.includes(
      'vann:preferredNamespaceUri "https://spectacular-voyage.github.io/accord/shacl/"',
    ),
  );
  assert(
    text.includes(
      "<https://spectacular-voyage.github.io/accord/shacl/releases/v0.1.0>",
    ),
  );
});

function assertParsesAsTurtle(text: string): void {
  const quads = new Parser({ format: "text/turtle" }).parse(text);
  assert(quads.length > 0);
}
