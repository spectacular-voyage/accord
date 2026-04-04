import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  assertContextReferencesAllowed,
  createFileJsonLdDocumentContext,
} from "../src/jsonld/documents.ts";
import { CHECK_CODES, CheckCode } from "../src/report/codes.ts";

class TestJsonLdError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "TestJsonLdError";
    this.code = code;
  }
}

Deno.test("assertContextReferencesAllowed rejects remote @import values in object contexts", () => {
  const error = assertThrows(
    () =>
      assertContextReferencesAllowed(
        {
          "@import": "https://example.test/context.jsonld",
        },
        createTestJsonLdError,
      ),
    TestJsonLdError,
    "Remote JSON-LD context is not allowlisted",
  );

  assertEquals(error.code, CHECK_CODES.REMOTE_CONTEXT_DISALLOWED);
});

Deno.test("assertContextReferencesAllowed rejects nested @context objects in term definitions", () => {
  const error = assertThrows(
    () =>
      assertContextReferencesAllowed(
        {
          ex: {
            "@id": "https://example.test/ex",
            "@context": "https://example.test/nested-context.jsonld",
          },
        },
        createTestJsonLdError,
      ),
    TestJsonLdError,
    "Remote JSON-LD context is not allowlisted",
  );

  assertEquals(error.code, CHECK_CODES.REMOTE_CONTEXT_DISALLOWED);
});

Deno.test("assertContextReferencesAllowed does not reject ordinary remote IRIs in term definitions", () => {
  assertContextReferencesAllowed(
    {
      dcterms: "http://purl.org/dc/terms/",
      creator: {
        "@id": "http://purl.org/dc/terms/creator",
      },
    },
    createTestJsonLdError,
  );
});

Deno.test("createFileJsonLdDocumentContext preserves JSON parse failures from local file loads", async () => {
  const tempPath = await Deno.makeTempFile({ suffix: ".jsonld" });

  try {
    await Deno.writeTextFile(tempPath, "{ invalid json");

    const documentContext = createFileJsonLdDocumentContext(
      tempPath,
      createTestJsonLdError,
      CHECK_CODES.RDF_PARSE_ERROR,
    );
    const error = await assertRejects(
      () => documentContext.documentLoader(documentContext.documentUrl),
      TestJsonLdError,
    );

    assertEquals(error.code, CHECK_CODES.RDF_PARSE_ERROR);
    assertEquals(
      error.message.includes("Failed to parse JSON document"),
      true,
    );
    assertEquals(
      error.message.includes("Failed to read JSON document"),
      false,
    );
  } finally {
    await Deno.remove(tempPath);
  }
});

function createTestJsonLdError(code: CheckCode, message: string): Error {
  return new TestJsonLdError(code, message);
}
