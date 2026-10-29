import type { MiddlewareHandler } from "hono";

export interface EmbeddedAsset {
  type: string;
  /** File contents, base64-encoded. */
  body: string;
}

export type EmbeddedAssets = Record<string, EmbeddedAsset>;

// Serves the built web UI from memory, so the npm package and the standalone binary each ship as
// a single file. Page routes without a file extension fall back to index.html for the SPA router.
export function serveEmbedded(assets: EmbeddedAssets): MiddlewareHandler {
  const files = new Map(
    Object.entries(assets).map(([path, asset]) => [
      path,
      { type: asset.type, body: Buffer.from(asset.body, "base64") },
    ]),
  );

  return async (c, next) => {
    const { method, path } = c.req;
    if (method !== "GET" && method !== "HEAD") return next();

    const isPageRoute = !path.startsWith("/api/") && !/\.[^/]+$/.test(path);
    const file = files.get(path) ?? (isPageRoute ? files.get("/index.html") : undefined);
    if (!file) return next();

    // Vite fingerprints everything under /assets/, so those files never change.
    const cacheControl = path.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    return c.body(file.body, 200, { "Content-Type": file.type, "Cache-Control": cacheControl });
  };
}
