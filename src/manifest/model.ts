export interface SparqlAskAssertion {
  id?: string;
  type?: string;
  query?: string;
  expectedBoolean?: boolean;
  [key: string]: unknown;
}

export interface RdfExpectation {
  id?: string;
  type?: string;
  targetsFileExpectation?: string;
  ignorePredicate?: string[];
  hasAskAssertion?: SparqlAskAssertion[];
  [key: string]: unknown;
}

export interface FileExpectation {
  id?: string;
  type?: string;
  path?: string;
  changeType?: string;
  compareMode?: string;
  [key: string]: unknown;
}

export interface TransitionCase {
  id?: string;
  type?: string;
  fixtureRepo?: string;
  operationId?: string;
  fromRef?: string;
  toRef?: string;
  targetDesignatorPath?: string;
  hasFileExpectation?: FileExpectation[];
  hasRdfExpectation?: RdfExpectation[];
  [key: string]: unknown;
}

export interface ManifestDocument {
  "@context"?: unknown;
  id?: string;
  type?: string;
  hasCase?: TransitionCase[];
  [key: string]: unknown;
}
