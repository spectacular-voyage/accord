export type FileChangeType =
  | "absent"
  | "added"
  | "removed"
  | "unchanged"
  | "updated";

export interface PresenceEvaluation {
  passed: boolean;
  reason: string;
}

export function evaluatePresenceExpectation(
  changeType: FileChangeType,
  fromExists: boolean,
  toExists: boolean,
): PresenceEvaluation {
  switch (changeType) {
    case "added":
      return passOrFail(
        !fromExists && toExists,
        "Expected file to be absent at fromRef and present at toRef.",
      );
    case "updated":
    case "unchanged":
      return passOrFail(
        fromExists && toExists,
        "Expected file to be present at both fromRef and toRef.",
      );
    case "removed":
      return passOrFail(
        fromExists && !toExists,
        "Expected file to be present at fromRef and absent at toRef.",
      );
    case "absent":
      return passOrFail(
        !toExists,
        "Expected file to be absent at toRef.",
      );
  }
}

function passOrFail(passed: boolean, reason: string): PresenceEvaluation {
  return { passed, reason };
}
