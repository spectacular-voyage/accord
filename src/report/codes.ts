export const CHECK_CODES = {
  CASE_NOT_FOUND: "case_not_found",
  CASE_SELECTION_REQUIRED: "case_selection_required",
  FILE_CONTENT_MISMATCH: "file_content_mismatch",
  FILE_CONTENT_OK: "file_content_ok",
  FILE_PRESENCE_MISMATCH: "file_presence_mismatch",
  FILE_PRESENCE_OK: "file_presence_ok",
  FIXTURE_REPO_NOT_FOUND: "fixture_repo_not_found",
  MANIFEST_LOAD_ERROR: "manifest_load_error",
  GIT_REF_UNRESOLVED: "git_ref_unresolved",
  RDF_GRAPH_OK: "rdf_graph_ok",
  RDF_GRAPH_MISMATCH: "rdf_graph_mismatch",
  RDF_PARSE_ERROR: "rdf_parse_error",
  REMOTE_CONTEXT_DISALLOWED: "remote_context_disallowed",
  SPARQL_ASK_OK: "sparql_ask_ok",
  SPARQL_ASK_MISMATCH: "sparql_ask_mismatch",
  SPARQL_QUERY_ERROR: "sparql_query_error",
  TEXT_DECODE_ERROR: "text_decode_error",
} as const;

export type CheckCode = typeof CHECK_CODES[keyof typeof CHECK_CODES];
