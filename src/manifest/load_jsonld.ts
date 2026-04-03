import { CHECK_CODES, CheckCode } from "../report/codes.ts";
import { ManifestDocument } from "./model.ts";

export interface LoadedManifestSource {
  path: string;
  document: ManifestDocument;
}

export class ManifestLoadError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "ManifestLoadError";
    this.code = code;
  }
}

export async function readManifestSource(
  manifestPath: string,
): Promise<LoadedManifestSource> {
  const sourceText = await Deno.readTextFile(manifestPath);
  const document = JSON.parse(sourceText) as ManifestDocument;

  assertInlineContextOnly(document["@context"]);

  return {
    path: manifestPath,
    document,
  };
}

function assertInlineContextOnly(context: unknown): void {
  if (context === undefined || context === null) {
    return;
  }

  if (typeof context === "string") {
    throw new ManifestLoadError(
      CHECK_CODES.REMOTE_CONTEXT_DISALLOWED,
      "Remote JSON-LD contexts are not supported in v1.",
    );
  }

  if (Array.isArray(context)) {
    for (const entry of context) {
      assertInlineContextOnly(entry);
    }
  }
}
