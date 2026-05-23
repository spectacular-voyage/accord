import type { StateLocator } from "../manifest/model.ts";

export interface StateLane {
  id?: string;
  resolvedId?: string;
  type?: string;
  laneKey?: string;
  branchPrefix?: string;
  [key: string]: unknown;
}

export interface LaneStateBinding {
  id?: string;
  resolvedId?: string;
  type?: string;
  lane?: string;
  fromLaneState?: StateLocator;
  toLaneState?: StateLocator;
  [key: string]: unknown;
}

export interface ScenarioStep {
  id?: string;
  resolvedId?: string;
  type?: string;
  manifestPath?: string;
  caseId?: string;
  hasLaneBinding?: LaneStateBinding[];
  [key: string]: unknown;
}

export interface ScenarioIndexDocument {
  "@context"?: unknown;
  id?: string;
  resolvedId?: string;
  documentUrl?: string;
  type?: string;
  defaultFixtureRepo?: string;
  branchPrefix?: string;
  assetRoot?: string[];
  hasStateLane?: StateLane[];
  hasStep?: ScenarioStep[];
  [key: string]: unknown;
}
