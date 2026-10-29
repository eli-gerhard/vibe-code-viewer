import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { detectAgents, withCommonBinDirs } from "./server/agents.ts";
import { createApp } from "./server/app.ts";
import { webAssets } from "./server/generated/web-assets.ts";
import { findRunningInstance, listen } from "./server/instance.ts";
import { openBrowser } from "./server/open-browser.ts";

const DEFAULT_PORT = 4747;

const USAGE = `Usage: vibe-code-viewer [options]

Starts Vibe Code Viewer on this computer and opens it in your browser.

Options:
  -p, --port <port>  Port to listen on (default ${DEFAULT_PORT}, or any free port if taken)
      --no-open      Don't open the browser
  -v, --version      Print the version
  -h, --help         Show this help`;

const { values } = parseArgs({
  options: {
    port: { type: "string", short: "p" },
    "no-open": { type: "boolean" },
    version: { type: "boolean", short: "v" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
if (values.version) {
  console.log(pkg.version);
  process.exit(0);
}

const requestedPort = values.port === undefined ? undefined : Number(values.port);
if (requestedPort !== undefined && !(Number.isInteger(requestedPort) && requestedPort > 0)) {
  console.error(`Invalid port: ${values.port}`);
  process.exit(1);
}
const show = (url: string) => {
  if (!values["no-open"]) openBrowser(url);
};

const running = await findRunningInstance(requestedPort ?? DEFAULT_PORT);
if (running) {
  const url = `http://localhost:${requestedPort ?? DEFAULT_PORT}`;
  console.log(`Vibe Code Viewer is already running at ${url}`);
  show(url);
  process.exit(0);
}

process.env.PATH = withCommonBinDirs(process.env.PATH ?? "");
const app = createApp({ version: pkg.version, assets: webAssets, detectAgents });

let started: Awaited<ReturnType<typeof listen>>;
try {
  started = await listen(app, requestedPort ?? DEFAULT_PORT);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
  if (requestedPort !== undefined) {
    console.error(`Port ${requestedPort} is already in use. Pick another with --port.`);
    process.exit(1);
  }
  started = await listen(app, 0);
}

const url = `http://localhost:${started.port}`;
console.log(`Vibe Code Viewer ${pkg.version} is running at ${url}\nPress Ctrl+C to stop.`);
show(url);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    started.server.close();
    process.exit(0);
  });
}
