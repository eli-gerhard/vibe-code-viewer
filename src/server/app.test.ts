import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

const app = createApp({
  version: "1.2.3",
  assets: {
    "/index.html": {
      type: "text/html; charset=utf-8",
      body: Buffer.from("<h1>Viewer</h1>").toString("base64"),
    },
  },
  detectAgents: async () => [],
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

  it("serves the web UI for page routes", async () => {
    const res = await app.request(`${local}/projects/example`);
    expect(await res.text()).toBe("<h1>Viewer</h1>");
  });

  it("does not serve the web UI for unknown API routes or files", async () => {
    expect((await app.request(`${local}/api/missing`)).status).toBe(404);
    expect((await app.request(`${local}/missing.js`)).status).toBe(404);
  });
});
