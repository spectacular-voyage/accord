import { assertEquals } from "@std/assert";
import {
  CHECK_CODES,
  compareBytes,
  type ManifestDocument,
  renderUsage,
  selectTransitionCase,
} from "../src/mod.ts";

Deno.test("public API exports stable package helpers", () => {
  const manifest: ManifestDocument = {
    hasCase: [{ id: "#case", fromRef: "before", toRef: "after" }],
  };

  assertEquals(compareBytes(new Uint8Array([1]), new Uint8Array([1])), true);
  assertEquals(selectTransitionCase(manifest).id, "#case");
  assertEquals(renderUsage().includes("accord check"), true);
  assertEquals(CHECK_CODES.FILE_CONTENT_OK, "file_content_ok");
});
