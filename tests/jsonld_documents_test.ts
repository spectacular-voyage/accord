import { assertEquals, assertThrows } from "@std/assert";
import {
  assertContextReferencesAllowed,
  JsonLdErrorFactory,
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

function createTestJsonLdError(code: CheckCode, message: string): Error {
  return new TestJsonLdError(code, message);
}
