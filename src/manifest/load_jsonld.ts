import { ManifestDocument } from "./model.ts";

export interface LoadedManifestSource {
  path: string;
  document: ManifestDocument;
}

// This is a transport-level scaffold only. The real JSON-LD expansion and
// document-loader behavior will be added once the jsonld.js spike is complete.
export async function readManifestSource(
  manifestPath: string,
): Promise<LoadedManifestSource> {
  const sourceText = await Deno.readTextFile(manifestPath);
  const document = JSON.parse(sourceText) as ManifestDocument;

  return {
    path: manifestPath,
    document,
  };
}
