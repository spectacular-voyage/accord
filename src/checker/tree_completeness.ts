import { listGitTreeBlobs } from "../git/trees.ts";
import type { FileExpectation, TransitionCase } from "../manifest/model.ts";
import { CHECK_CODES } from "../report/codes.ts";
import type { CheckRecord } from "../report/json_report.ts";
import type { FileChangeType } from "./file_expectations.ts";
import {
  compileIgnorePathPatterns,
  IgnorePathPatternError,
  normalizeRepoRelativePath,
} from "./ignore_paths.ts";

interface TreePathChange {
  path: string;
  changeType: Exclude<FileChangeType, "absent" | "unchanged">;
}

export async function evaluateTreeCompleteness(
  repoPath: string,
  transitionCase: TransitionCase,
): Promise<CheckRecord[]> {
  const ignoredPathPatterns = transitionCase.ignorePaths ?? [];
  const fileExpectations = transitionCase.hasFileExpectation ?? [];
  const fromRef = transitionCase.fromRef!;
  const toRef = transitionCase.toRef!;

  try {
    const ignorePatterns = compileIgnorePathPatterns(ignoredPathPatterns);
    const conflict = findIgnoredExplicitExpectation(
      fileExpectations,
      ignorePatterns,
    );

    if (conflict !== undefined) {
      return [{
        kind: "tree_completeness",
        status: "error",
        code: CHECK_CODES.IGNORE_PATH_CONFLICT,
        message:
          `File expectation path is also matched by ignorePaths pattern "${conflict.pattern}": ${conflict.path}`,
        path: conflict.path,
      }];
    }

    const fromTree = await mapTreePaths(repoPath, fromRef);
    const toTree = await mapTreePaths(repoPath, toRef);
    const coveredPaths = coveredExpectationPaths(fileExpectations);
    const changes = detectTreeChanges(fromTree, toTree).filter((change) =>
      !ignorePatterns.some((pattern) => pattern.matches(change.path))
    );

    return changes
      .filter((change) => !coveredPaths.has(change.path))
      .map((change) => ({
        kind: "tree_completeness",
        status: "fail",
        code: CHECK_CODES.TREE_UNEXPECTED_CHANGE,
        message:
          `Unexpected ${change.changeType} path is not covered by hasFileExpectation.`,
        path: change.path,
      }));
  } catch (error) {
    if (error instanceof IgnorePathPatternError) {
      return [{
        kind: "tree_completeness",
        status: "error",
        code: CHECK_CODES.IGNORE_PATH_INVALID,
        message: error.message,
      }];
    }

    throw error;
  }
}

function findIgnoredExplicitExpectation(
  fileExpectations: FileExpectation[],
  ignorePatterns: ReturnType<typeof compileIgnorePathPatterns>,
): { path: string; pattern: string } | undefined {
  for (const fileExpectation of fileExpectations) {
    if (fileExpectation.path === undefined) {
      continue;
    }

    const path = normalizeRepoRelativePath(fileExpectation.path);
    const matchingPattern = ignorePatterns.find((pattern) =>
      pattern.matches(path)
    );

    if (matchingPattern !== undefined) {
      return { path, pattern: matchingPattern.raw };
    }
  }

  return undefined;
}

async function mapTreePaths(
  repoPath: string,
  ref: string,
): Promise<Map<string, string>> {
  const blobs = await listGitTreeBlobs(repoPath, ref);
  return new Map(
    blobs.map((blob) => [normalizeRepoRelativePath(blob.path), blob.objectId]),
  );
}

function coveredExpectationPaths(
  fileExpectations: FileExpectation[],
): Set<string> {
  const paths = new Set<string>();

  for (const fileExpectation of fileExpectations) {
    if (
      fileExpectation.path === undefined ||
      fileExpectation.changeType === "absent"
    ) {
      continue;
    }

    paths.add(normalizeRepoRelativePath(fileExpectation.path));
  }

  return paths;
}

function detectTreeChanges(
  fromTree: Map<string, string>,
  toTree: Map<string, string>,
): TreePathChange[] {
  const paths = [...new Set([...fromTree.keys(), ...toTree.keys()])].sort();
  const changes: TreePathChange[] = [];

  for (const path of paths) {
    const fromObjectId = fromTree.get(path);
    const toObjectId = toTree.get(path);

    if (fromObjectId === undefined && toObjectId !== undefined) {
      changes.push({ path, changeType: "added" });
    } else if (fromObjectId !== undefined && toObjectId === undefined) {
      changes.push({ path, changeType: "removed" });
    } else if (
      fromObjectId !== undefined &&
      toObjectId !== undefined &&
      fromObjectId !== toObjectId
    ) {
      changes.push({ path, changeType: "updated" });
    }
  }

  return changes;
}
