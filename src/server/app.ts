import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { type AgentStatus, APP_ID, type HealthResponse } from "../shared/api.ts";
import { type EmbeddedAssets, serveEmbedded } from "./assets.ts";
import { localhostOnly } from "./security.ts";

export interface AppOptions {
  version: string;
  assets: EmbeddedAssets;
  detectAgents: () => Promise<AgentStatus[]>;
}

export function createApp({ version, assets, detectAgents }: AppOptions) {
  return new Hono()
    .use(localhostOnly, csrf())
    .get("/api/health", (c) => c.json({ app: APP_ID, version } satisfies HealthResponse))
    .get("/api/agents", async (c) => c.json(await detectAgents()))
    .use(serveEmbedded(assets));
}
