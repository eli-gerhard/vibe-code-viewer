import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import envPaths from "env-paths";
import { APP_ID, type RecentProject } from "../shared/api.ts";
import { readMap } from "./project-map.ts";

// Kept in this computer's per-user app-data folder, outside every project, so it's never committed.
export const RECENT_FILE = join(envPaths(APP_ID).data, "recent-projects.json");

// Folders opened before that still have a saved map, most recent first.
export async function readRecent(file: string): Promise<RecentProject[]> {
  const paths = await readPaths(file);
  const maps = await Promise.all(paths.map((path) => readMap(path).catch(() => undefined)));
  return paths.filter((_, i) => maps[i]).map((path) => ({ path, name: basename(path) }));
}

// Puts `path` first, keeping the 10 most recent.
export async function addRecent(file: string, path: string) {
  const paths = [path, ...(await readPaths(file)).filter((saved) => saved !== path)];
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(paths.slice(0, 10), null, 2));
}

async function readPaths(file: string): Promise<string[]> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return [];
  }
}
