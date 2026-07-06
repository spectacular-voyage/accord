import { assertEquals, assertRejects } from "@std/assert";
import { Parser, Store } from "n3";
import type { Quad } from "n3";
import {
  validateWithShaclEngineForTest,
  ValidationExecutionError,
} from "../src/shacl/validate_manifest.ts";
import type { ValidationResultRecord } from "../src/report/validation_report.ts";

Deno.test("SHACL SPARQL filters apply after sibling patterns regardless of source order", async () => {
  const topLevelFilterFirst = await validateWithSelect(`
    PREFIX ex: <https://example.test/>
    SELECT $this ?value WHERE {
      FILTER (?value = "bad")
      $this ex:status ?value .
    }
    LIMIT 1
  `);
  const topLevelFilterLast = await validateWithSelect(`
    PREFIX ex: <https://example.test/>
    SELECT $this ?value WHERE {
      $this ex:status ?value .
      FILTER (?value = "bad")
    }
    LIMIT 1
  `);
  const unionFilterFirst = await validateWithSelect(`
    PREFIX ex: <https://example.test/>
    SELECT $this ?value WHERE {
      {
        FILTER (?value = "bad")
        $this ex:status ?value .
      }
      UNION
      {
        FILTER (?value = "missing")
        $this ex:alternate ?value .
      }
    }
    LIMIT 1
  `);
  const unionFilterLast = await validateWithSelect(`
    PREFIX ex: <https://example.test/>
    SELECT $this ?value WHERE {
      {
        $this ex:status ?value .
        FILTER (?value = "bad")
      }
      UNION
      {
        $this ex:alternate ?value .
        FILTER (?value = "missing")
      }
    }
    LIMIT 1
  `);

  assertEquals(topLevelFilterFirst, topLevelFilterLast);
  assertEquals(unionFilterFirst, unionFilterLast);
  assertEquals(topLevelFilterFirst, [
    {
      focusNode: "https://example.test/item",
      message: "filter order violation",
      value: '"bad"',
    },
  ]);
});

Deno.test("SHACL SPARQL rejects unsupported SELECT modifiers", async () => {
  await assertRejects(
    () =>
      validateWithSelect(`
        PREFIX ex: <https://example.test/>
        SELECT $this ?value WHERE {
          $this ex:status ?value .
        }
        ORDER BY ?value
      `),
    ValidationExecutionError,
    "ORDER BY",
  );
});

async function validateWithSelect(
  select: string,
): Promise<
  Array<Pick<ValidationResultRecord, "focusNode" | "message" | "value">>
> {
  const results = await validateWithShaclEngineForTest(
    storeFromTurtle(`
      @prefix ex: <https://example.test/> .

      ex:item
        a ex:Thing ;
        ex:status "bad" ;
        ex:alternate "present" .
    `),
    storeFromTurtle(`
      @prefix ex: <https://example.test/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .

      ex:FilterOrderShape
        a sh:NodeShape ;
        sh:targetClass ex:Thing ;
        sh:sparql [
          sh:message "filter order violation" ;
          sh:select ${JSON.stringify(select)} ;
        ] .
    `),
  );

  return results.map((result) => ({
    focusNode: result.focusNode,
    message: result.message,
    value: result.value,
  }));
}

function storeFromTurtle(source: string): Store {
  return new Store(
    new Parser({
      format: "text/turtle",
      baseIRI: "https://example.test/",
    }).parse(source) as Quad[],
  );
}
