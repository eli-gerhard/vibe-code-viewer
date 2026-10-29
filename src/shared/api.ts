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
