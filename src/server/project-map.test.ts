import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mapProject, readMap } from "./project-map.ts";

const node = (key: string, parentKey: string, file = "app.js", line = 1) => ({
  key,
  parentKey,
  kind: "component",
  label: `Label ${key}`,
  description: `Does ${key}`,
  file,
  line,
});
const answering = (...nodes: ReturnType<typeof node>[]) => ({ ask: async () => ({ nodes }) });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "vc-viewer-test-"));
  await writeFile(join(dir, "app.js"), "one\ntwo\nthree\n");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("project maps", () => {
  it("builds the tree from the AI's flat answer and saves it in the project", async () => {
    const map = await mapProject(answering(node("app", ""), node("feed", "app", "app.js", 3)), dir);
    expect(map).toMatchObject({
      label: "Label app",
      children: [{ kind: "component", file: "app.js", line: 3 }],
    });
    expect(await readMap(dir)).toEqual(map);
    expect(JSON.parse(await readFile(join(dir, ".vc-viewer/map.json"), "utf8"))).toEqual(map);
  });

  it("drops locations that don't match a real line inside the project", async () => {
    const map = await mapProject(
      answering(node("app", ""), node("a", "app", "app.js", 99), node("b", "app", "../x.js")),
      dir,
    );
    for (const child of map.children) expect(child).not.toHaveProperty("file");
  });

  it("keeps every level, and places each node once even when parent keys loop", async () => {
    const chain = ["app", "a", "b", "c", "d", "e"].map((key, i, keys) =>
      node(key, keys[i - 1] ?? ""),
    );
    const map = await mapProject(answering(...chain, node("e", "e")), dir);
    let depth = 0;
    for (let level = [map]; level.length; level = level.flatMap((n) => n.children)) depth++;
    expect(depth).toBe(7);
  });

  it("re-maps one node and leaves the rest of the map alone", async () => {
    const first = await mapProject(
      answering(node("app", ""), node("a", "app"), node("b", "app")),
      dir,
    );
    const [a, b] = first.children;
    const map = await mapProject(answering(node("new", ""), node("child", "new")), dir, a.id);
    expect(map.id).toBe(first.id);
    expect(map.children[0]).toMatchObject({ id: a.id, label: "Label new", children: [{}] });
    expect(map.children[1]).toEqual(b);
  });
});
