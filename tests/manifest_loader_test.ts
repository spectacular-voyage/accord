import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import {
  ManifestLoadError,
  readManifestSource,
} from "../src/manifest/load_jsonld.ts";
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
  assertEquals(
    loaded.document.documentUrl,
    toFileUrl(
      `${Deno.cwd()}/testdata/manifests/bb-001-single-case-auto-select-pass.jsonld`,
    ).href,
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

Deno.test("selectTransitionCase accepts the resolved case IRI", async () => {
  const loaded = await readManifestSource(
    "testdata/manifests/bb-001-single-case-auto-select-pass.jsonld",
  );

  const selected = selectTransitionCase(
    loaded.document,
    loaded.document.hasCase?.[0].resolvedId,
  );
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

Deno.test("readManifestSource loads a manifest with a local file context", async () => {
  const loaded = await readManifestSource(
    "testdata/manifests/support/local-file-context-manifest.jsonld",
  );

  assertEquals(loaded.document.id, "urn:accord:testdata:local-file-context");
  assertEquals(loaded.document.hasCase?.[0].id, "#local-context-case");
});

Deno.test("readManifestSource rejects a remote JSON-LD context", async () => {
  await assertRejects(
    () =>
      readManifestSource(
        "testdata/manifests/bb-005-remote-context-disallowed.jsonld",
      ),
    ManifestLoadError,
    "Remote JSON-LD context is not allowlisted",
  );
});

Deno.test("readManifestSource wraps JSON parse failures as ManifestLoadError", async () => {
  const tempPath = await Deno.makeTempFile({ suffix: ".jsonld" });

  try {
    await Deno.writeTextFile(tempPath, "{ invalid json");

    const error = await assertRejects(
      () => readManifestSource(tempPath),
      ManifestLoadError,
    );

    assertEquals(error.code, "manifest_load_error");
    assertEquals(error.message.includes(tempPath), true);
    assertEquals(
      error.message.includes("Failed to parse JSON manifest document"),
      true,
    );
  } finally {
    await Deno.remove(tempPath);
  }
});

Deno.test("readManifestSource wraps manifest read failures as ManifestLoadError", async () => {
  const tempDir = await Deno.makeTempDir();
  const missingPath = join(tempDir, "missing-manifest.jsonld");

  try {
    const error = await assertRejects(
      () => readManifestSource(missingPath),
      ManifestLoadError,
    );

    assertEquals(error.code, "manifest_load_error");
    assertEquals(error.message.includes(missingPath), true);
    assertEquals(
      error.message.includes("Failed to read JSON manifest document"),
      true,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
