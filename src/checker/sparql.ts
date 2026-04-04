import { QueryEngine } from "@comunica/query-sparql";
import { Store } from "n3";
import { JsonLdDocumentContext } from "../jsonld/documents.ts";
import { CHECK_CODES, CheckCode } from "../report/codes.ts";
import { parseRdfContent, RdfCompareError } from "./compare_rdf.ts";

const queryEngine = new QueryEngine();

export class SparqlAskError extends Error {
  code: CheckCode;

  constructor(code: CheckCode, message: string) {
    super(message);
    this.name = "SparqlAskError";
    this.code = code;
  }
}

export interface RunAskAssertionOptions {
  dataset: Uint8Array;
  path: string;
  query: string;
  documentContext?: JsonLdDocumentContext;
}

export async function runAskAssertion(
  options: RunAskAssertionOptions,
): Promise<boolean> {
  try {
    const store = new Store(
      await parseRdfContent({
        bytes: options.dataset,
        path: options.path,
        documentContext: options.documentContext,
      }),
    );

    return await queryEngine.queryBoolean(options.query, {
      sources: [store],
    });
  } catch (error) {
    if (error instanceof RdfCompareError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new SparqlAskError(
      CHECK_CODES.SPARQL_QUERY_ERROR,
      `Failed to execute SPARQL ASK query: ${message}`,
    );
  }
}
