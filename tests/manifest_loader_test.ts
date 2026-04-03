import { assertEquals, assertThrows } from "@std/assert";
import { readManifestSource } from "../src/manifest/load_jsonld.ts";
import {
  CaseSelectionError,
  selectTransitionCase,
} from "../src/manifest/select_case.ts";

Deno.test("readManifestSource loads a manifest document", async () => {
  const loaded = await readManifestSource(
    "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
  );

  assertEquals(
    loaded.document.id,
    "urn:accord:testdata:bb-001-single-case-auto-select-pass",
  );
  assertEquals(loaded.document.hasCase?.length, 1);
});

Deno.test("selectTransitionCase auto-selects a single case", async () => {
  const loaded = await readManifestSource(
    "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
  );

  const selected = selectTransitionCase(loaded.document);
  assertEquals(selected.id, "#auto-select-case");
});

Deno.test("selectTransitionCase requires an explicit selector for multi-case manifests", async () => {
  const loaded = await readManifestSource(
    "testdata/manifests/bb-003-multi-case-selector-required.jsonld",
  );

  assertThrows(
    () => selectTransitionCase(loaded.document),
    CaseSelectionError,
    "multiple cases",
  );
});
