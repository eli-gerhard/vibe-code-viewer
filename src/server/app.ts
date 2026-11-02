import { stat } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import {
  type AgentStatus,
  APP_ID,
  type ErrorResponse,
  type HealthResponse,
  type MapRequest,
  type PickFolderResponse,
  type ProjectResponse,
} from "../shared/api.ts";
import { AGENTS } from "./agents.ts";
import { type EmbeddedAssets, serveEmbedded } from "./assets.ts";
import { pickFolder } from "./pick-folder.ts";
import { mapProject, readMap } from "./project-map.ts";
import { addRecent, readRecent } from "./recent-projects.ts";
import { localhostOnly } from "./security.ts";

export interface AppOptions {
  version: string;
  assets: EmbeddedAssets;
  detectAgents: () => Promise<AgentStatus[]>;
  // Where the list of recently opened folders is kept.
  recentFile: string;
}

export function createApp({ version, assets, detectAgents, recentFile }: AppOptions) {
  return new Hono()
    .use(localhostOnly, csrf())
    .get("/api/health", (c) => c.json({ app: APP_ID, version } satisfies HealthResponse))
    .get("/api/agents", async (c) => c.json(await detectAgents()))
    .post("/api/pick-folder", async (c) =>
      c.json({ path: await pickFolder() } satisfies PickFolderResponse),
    )
    .get("/api/recent-projects", async (c) => c.json(await readRecent(recentFile)))
    .get("/api/project", async (c) => {
      const path = await projectDir(c.req.query("path"));
      await addRecent(recentFile, path);
      return c.json({
        path,
        name: basename(path),
        map: await readMap(path),
      } satisfies ProjectResponse);
    })
    .post("/api/project/map", async (c) => {
      const { path, nodeId } = await c.req.json<MapRequest>();
      const installed = (await detectAgents()).find((agent) => agent.installed);
      const agent = AGENTS.find(({ id }) => id === installed?.id);
      if (!agent) throw new HTTPException(400, { message: "Install Claude Code or Codex first." });
      return c.json(await mapProject(agent, await projectDir(path), nodeId));
    })
    .use(serveEmbedded(assets))
    .onError((error, c) =>
      c.json(
        { error: error.message } satisfies ErrorResponse,
        error instanceof HTTPException ? error.status : 500,
      ),
    );
}

async function projectDir(path: string | undefined): Promise<string> {
  const dir = path && isAbsolute(path) ? resolve(path) : undefined;
  if (!dir || !(await stat(dir).catch(() => undefined))?.isDirectory()) {
    throw new HTTPException(400, { message: "That folder doesn't exist." });
  }
  return dir;
}
