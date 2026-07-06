import { assertEquals, assertThrows } from "@std/assert";
import {
  evaluateJsonAssertion,
  evaluateJsonPath,
  JsonAssertionError,
  parseJsonArtifact,
} from "../src/checker/json_assertions.ts";
import { CHECK_CODES } from "../src/report/codes.ts";

const encoder = new TextEncoder();

Deno.test("JSON assertions support exists, equals, and count", () => {
  const document = {
    summary: { status: "ok", reviewed: true },
    evidence: [
      { pointer: "/records/0" },
      { pointer: "/records/1" },
    ],
  };

  assertEquals(
    evaluateJsonAssertion(document, {
      jsonPath: "$.summary.status",
      jsonAssertionKind: "exists",
    }).code,
    CHECK_CODES.JSON_ASSERTION_OK,
  );
  assertEquals(
    evaluateJsonAssertion(document, {
      jsonPath: "$['summary']['status']",
      jsonAssertionKind: "equals",
      expectedValue: "ok",
    }).passed,
    true,
  );
  assertEquals(
    evaluateJsonAssertion(document, {
      jsonPath: "$.evidence[*].pointer",
      jsonAssertionKind: "count",
      expectedCount: 2,
    }).passed,
    true,
  );
  assertEquals(evaluateJsonPath(document, "$.evidence[0].pointer"), [
    "/records/0",
  ]);
});

Deno.test("JSON notExists proves absence over wildcard and recursive paths", () => {
  const document = {
    participants: [
      { role: "speaker", notes: ["public"] },
      { role: "reviewer", notes: ["clear"] },
    ],
    transcript: { text: "publishable" },
  };

  assertEquals(
    evaluateJsonAssertion(document, {
      jsonPath: "$.participants[*].participantAim",
      jsonAssertionKind: "notExists",
    }).passed,
    true,
  );
  assertEquals(
    evaluateJsonAssertion(document, {
      jsonPath: "$..participantAim",
      jsonAssertionKind: "notExists",
    }).passed,
    true,
  );
  assertEquals(
    evaluateJsonAssertion(
      { participants: [{ participantAim: "reviseBeforeUse" }] },
      {
        jsonPath: "$..participantAim",
        jsonAssertionKind: "notExists",
      },
    ).code,
    CHECK_CODES.JSON_ASSERTION_MISMATCH,
  );
});

Deno.test("JSON paths support recursive quoted names and wildcards", () => {
  const document = {
    nested: {
      "participant-aim": "none",
      child: { text: "leaf" },
    },
    items: ["first", "second"],
  };

  assertEquals(evaluateJsonPath(document, '$.."participant-aim"'), [
    "none",
  ]);
  assertEquals(evaluateJsonPath(document, "$..text"), ["leaf"]);
  assertEquals(evaluateJsonPath(document, "$..*").length, 7);
});

Deno.test("JSON artifact parse errors are reported distinctly", () => {
  const error = assertThrows(
    () => parseJsonArtifact(encoder.encode('{"a":'), "artifact.json"),
    JsonAssertionError,
  );

  assertEquals(error.code, CHECK_CODES.JSON_PARSE_ERROR);
});

Deno.test("JSON artifacts fail closed on duplicate object keys", () => {
  const duplicate = assertThrows(
    () => parseJsonArtifact(encoder.encode('{"a":1,"a":2}'), "artifact.json"),
    JsonAssertionError,
  );
  const escapedDuplicate = assertThrows(
    () =>
      parseJsonArtifact(
        encoder.encode('{"a":1,"\\u0061":2}'),
        "artifact.json",
      ),
    JsonAssertionError,
  );

  assertEquals(duplicate.code, CHECK_CODES.JSON_DUPLICATE_KEY);
  assertEquals(escapedDuplicate.code, CHECK_CODES.JSON_DUPLICATE_KEY);
});

Deno.test("JSON assertion configuration errors use distinct report codes", () => {
  const document = { summary: { status: "ok" } };

  assertEquals(
    assertThrows(
      () =>
        evaluateJsonAssertion(document, {
          jsonAssertionKind: "exists",
        }),
      JsonAssertionError,
    ).code,
    CHECK_CODES.JSON_PATH_MISSING,
  );
  assertEquals(
    assertThrows(
      () =>
        evaluateJsonAssertion(document, {
          jsonPath: "$.summary.status",
          jsonAssertionKind: "equals",
        }),
      JsonAssertionError,
    ).code,
    CHECK_CODES.JSON_EXPECTED_VALUE_MISSING,
  );
  assertEquals(
    assertThrows(
      () =>
        evaluateJsonAssertion(document, {
          jsonPath: "$.summary.status",
          jsonAssertionKind: "count",
          expectedCount: -1,
        }),
      JsonAssertionError,
    ).code,
    CHECK_CODES.JSON_EXPECTED_COUNT_INVALID,
  );
  assertEquals(
    assertThrows(
      () =>
        evaluateJsonAssertion(document, {
          jsonPath: "$.summary.status",
          jsonAssertionKind: "contains",
        }),
      JsonAssertionError,
    ).code,
    CHECK_CODES.JSON_ASSERTION_KIND_UNSUPPORTED,
  );
});

for (
  const [label, path] of [
    ["filter", "$.items[?(@.ok)]"],
    ["slice", "$.items[0:2]"],
    ["union", "$.items[0,1]"],
    ["script/current-node expression", "$.items[(@.length-1)]"],
    ["negative index", "$.items[-1]"],
    ["parent operator", "$.items^"],
    ["function selector", "$.items.length()"],
    ["descendant index", "$..[0]"],
  ] as const
) {
  Deno.test(`JSON path rejects unsupported ${label} syntax`, () => {
    const error = assertThrows(
      () => evaluateJsonPath({ items: [{ ok: true }, { ok: false }] }, path),
      JsonAssertionError,
    );

    assertEquals(error.code, CHECK_CODES.JSON_PATH_UNSUPPORTED);
  });
}
