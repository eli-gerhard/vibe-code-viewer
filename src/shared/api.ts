// Types shared by the local server and the web UI.

export const APP_ID = "vibe-code-viewer";

export interface HealthResponse {
  app: typeof APP_ID;
  version: string;
}

export type AgentId = "claude" | "codex";

export interface AgentStatus {
  id: AgentId;
  name: string;
  installed: boolean;
  version?: string;
  installUrl: string;
}

// What a map node is, with the plain hint the map's key shows. The AI's fuller guidance on each
// kind is in the mapping prompt (`src/server/project-map.ts`).
export const NODE_KINDS = {
  app: "the entire project",
  screen: "a page on the app",
  component: "a part of a screen",
  element: "a visual feature or style",
  process: "a series of actions",
  action: "one thing the app does",
  data: "information the app stores",
  connection: "a service the app talks to",
} as const;

export type NodeKind = keyof typeof NODE_KINDS;

// One concept in a project's map. `file` and `line` point at the code that most directly drives
// it, and are left out when the AI's answer didn't match a real line in the project. `kind` is
// missing from maps saved before kinds existed.
export interface MapNode {
  id: string;
  kind?: NodeKind;
  label: string;
  description: string;
  file?: string;
  line?: number;
  children: MapNode[];
}

export interface ProjectResponse {
  path: string;
  name: string;
  map?: MapNode;
}

// A folder opened before that still has a saved map, for reopening in one click.
export type RecentProject = Omit<ProjectResponse, "map">;

// `path` is missing when the user closes the folder window without choosing.
export interface PickFolderResponse {
  path?: string;
}

// Without `nodeId` the whole app is mapped; with it, only that node and everything under it.
export interface MapRequest {
  path: string;
  nodeId?: string;
}

export interface ErrorResponse {
  error: string;
}
