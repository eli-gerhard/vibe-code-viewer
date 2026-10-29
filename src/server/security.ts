import type { MiddlewareHandler } from "hono";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

// The server only listens on this machine, but any website the user visits could still try to
// reach it through DNS rebinding. Those requests carry the attacker's domain as the Host, so
// anything not addressed to localhost is rejected.
export const localhostOnly: MiddlewareHandler = async (c, next) => {
  if (!LOCAL_HOSTNAMES.has(new URL(c.req.url).hostname)) return c.text("Forbidden", 403);
  await next();
};
