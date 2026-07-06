import { assertEquals } from "@std/assert";
import {
  CHECK_CODES,
  compareBytes,
  type ManifestDocument,
  renderUsage,
  type ScenarioIndexDocument,
  selectTransitionCase,
  validateManifest,
  validateScenarioIndexDocument,
  type ValidationReport,
} from "../src/mod.ts";

Deno.test("public API exports stable package helpers", () => {
  const manifest: ManifestDocument = {
    hasCase: [{ id: "#case", fromRef: "before", toRef: "after" }],
  };
  const scenarioIndex: ScenarioIndexDocument = {
    hasStep: [{ id: "#step", manifestPath: "testdata/manifest.jsonld" }],
  };

  assertEquals(compareBytes(new Uint8Array([1]), new Uint8Array([1])), true);
  assertEquals(selectTransitionCase(manifest).id, "#case");
  assertEquals(scenarioIndex.hasStep?.[0].id, "#step");
  assertEquals(typeof validateManifest, "function");
  const validationReport: Pick<ValidationReport, "status"> = {
    status: "conformant",
  };
  assertEquals(validationReport.status, "conformant");
  assertEquals(typeof validateScenarioIndexDocument, "function");
  assertEquals(renderUsage().includes("accord check"), true);
  assertEquals(renderUsage().includes("accord validate"), true);
  assertEquals(CHECK_CODES.FILE_CONTENT_OK, "file_content_ok");
});
