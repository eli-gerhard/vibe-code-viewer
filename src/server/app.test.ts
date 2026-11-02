import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

const dir = await mkdtemp(join(tmpdir(), "vc-viewer-test-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

const app = createApp({
  version: "1.2.3",
  assets: {
    "/index.html": {
      type: "text/html; charset=utf-8",
      body: Buffer.from("<h1>Viewer</h1>").toString("base64"),
    },
  },
  detectAgents: async () => [],
  recentFile: join(dir, "recent-projects.json"),
});

const local = "http://127.0.0.1:4747";

describe("local server", () => {
  it("reports its health", async () => {
    const res = await app.request(`${local}/api/health`);
    expect(await res.json()).toEqual({ app: "vibe-code-viewer", version: "1.2.3" });
  });

  it("rejects requests addressed to another host", async () => {
    const res = await app.request("http://attacker.example/api/health");
    expect(res.status).toBe(403);
  });

  it("rejects cross-site form posts", async () => {
    const res = await app.request(`${local}/api/agents`, {
      method: "POST",
      headers: {
        origin: "http://attacker.example",
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    expect(res.status).toBe(403);
  });

  it("rejects project paths that aren't existing folders", async () => {
    for (const path of ["relative/folder", "/vibe-code-viewer-missing-folder"]) {
      const res = await app.request(`${local}/api/project?path=${encodeURIComponent(path)}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "That folder doesn't exist." });
    }
  });

  it("lists opened folders that still have a saved map, most recent first", async () => {
    const [first, second, unmapped] = ["first", "second", "unmapped"].map((name) =>
      join(dir, name),
    );
    for (const project of [first, second]) {
      await mkdir(join(project, ".vc-viewer"), { recursive: true });
      await writeFile(join(project, ".vc-viewer", "map.json"), "{}");
    }
    await mkdir(unmapped);
    for (const path of [first, second, unmapped, first]) {
      await app.request(`${local}/api/project?path=${encodeURIComponent(path)}`);
    }
    const res = await app.request(`${local}/api/recent-projects`);
    expect(await res.json()).toEqual(
      [first, second].map((path) => ({ path, name: basename(path) })),
    );
  });

  it("serves the web UI for page routes", async () => {
    const res = await app.request(`${local}/projects/example`);
    expect(await res.text()).toBe("<h1>Viewer</h1>");
  });

  it("does not serve the web UI for unknown API routes or files", async () => {
    expect((await app.request(`${local}/api/missing`)).status).toBe(404);
    expect((await app.request(`${local}/missing.js`)).status).toBe(404);
  });
});
