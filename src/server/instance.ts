import { type ServerType, serve } from "@hono/node-server";
import type { Hono } from "hono";
import { APP_ID, type HealthResponse } from "../shared/api.ts";

// Clicking the app icon again should reopen the running viewer rather than start a second one.
export async function findRunningInstance(port: number): Promise<HealthResponse | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    const body = (await res.json()) as Partial<HealthResponse>;
    return body.app === APP_ID ? (body as HealthResponse) : undefined;
  } catch {
    return undefined;
  }
}

export function listen(app: Hono, port: number): Promise<{ server: ServerType; port: number }> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) =>
      resolve({ server, port: info.port }),
    );
    server.once("error", reject);
  });
}
