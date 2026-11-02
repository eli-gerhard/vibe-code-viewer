import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { type MapNode, NODE_KINDS, type NodeKind } from "../shared/api.ts";
import type { AgentDefinition } from "./agents.ts";

// Saved inside each project, so its owner chooses whether to commit it.
const MAP_DIR = ".vc-viewer";
const MAP_FILE = join(MAP_DIR, "map.json");

// The AI answers with a flat list, since not every CLI accepts a recursive schema.
interface AnswerNode {
  key: string;
  parentKey: string;
  kind: NodeKind;
  label: string;
  description: string;
  file: string;
  line: number;
}

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          parentKey: { type: "string" },
          kind: { type: "string", enum: Object.keys(NODE_KINDS) },
          label: { type: "string" },
          description: { type: "string" },
          file: { type: "string" },
          line: { type: "integer" },
        },
        required: ["key", "parentKey", "kind", "label", "description", "file", "line"],
        additionalProperties: false,
      },
    },
  },
  required: ["nodes"],
  additionalProperties: false,
};

export async function readMap(projectDir: string): Promise<MapNode | undefined> {
  try {
    return JSON.parse(await readFile(join(projectDir, MAP_FILE), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

// Maps the whole app, or re-maps one saved node and everything under it, then saves the map.
export async function mapProject(
  agent: Pick<AgentDefinition, "ask">,
  projectDir: string,
  nodeId?: string,
): Promise<MapNode> {
  const saved = nodeId ? await readMap(projectDir) : undefined;
  const lineage = nodeId ? saved && findLineage(saved, nodeId) : [];
  if (!lineage) throw new Error("That part of the map no longer exists.");

  const prompt = buildPrompt(lineage);
  const answer = (await agent.ask(prompt, ANSWER_SCHEMA, projectDir)) as { nodes: AnswerNode[] };
  const top = answer.nodes.find((node) => !node.parentKey);
  if (!top) throw new Error("The AI's answer was missing its top item. Please try again.");

  // Each node in the answer is placed once, which also stops any loop in the AI's parent keys.
  const unplaced = new Set(answer.nodes);
  unplaced.delete(top);
  const build = async (node: AnswerNode): Promise<MapNode> => {
    const children = [...unplaced].filter((child) => child.parentKey === node.key);
    for (const child of children) unplaced.delete(child);
    return {
      id: randomUUID(),
      kind: node.kind,
      label: node.label,
      description: node.description,
      ...(await locate(projectDir, node.file, node.line)),
      children: await Promise.all(children.map(build)),
    };
  };
  const subtree = await build(top);
  const map = nodeId ? replaceNode(lineage[0], { ...subtree, id: nodeId }) : subtree;

  await mkdir(join(projectDir, MAP_DIR), { recursive: true });
  await writeFile(join(projectDir, MAP_FILE), JSON.stringify(map, null, 2));
  return map;
}

// `lineage` runs from the app's node down to the node being re-mapped; empty for a new map.
function buildPrompt(lineage: MapNode[]): string {
  const [target, parent] = [lineage.at(-1), lineage.at(-2)];
  const siblings = parent?.children.filter((node) => node !== target) ?? [];
  const describe = (node: MapNode) => `- ${node.label}: ${node.description}`;
  const scope =
    target && parent
      ? [
          `The rest of the app is already mapped. Map only "${target.label}" (${target.description}) and what's under it.`,
          `Where it sits in the map, from the top:\n${lineage.slice(0, -1).map(describe).join("\n")}`,
          siblings.length > 0 &&
            `Other parts under the same parent, already covered, so don't repeat them:\n${siblings.map(describe).join("\n")}`,
        ]
      : ["Map the whole app."];

  return [
    "You are mapping a vibe-coded app, in a way that non-technical people can navigate. Explore the code in the current folder, then respond with a tree hierarchy that fully maps the app, as described below.",
    ...scope.filter(Boolean),
    `How to build the tree:
- Include things an app user could recognize, understand, point at, or ask to change, organized by what the app does.
  - This does not necessarily need to be aligned with how the files are laid out (e.g. a button on a frontend file that triggers a function defined in a different file that calls on a basic supporting function in a third file can all be one node)
  - One part of the code can be represented by more than one node (i.e. if multiple components trigger the same action).
- Skip technical setup (packages, build, environment, types, tests, helpers).
- Go as deep as the app needs (all user-facing functionality must be included somewhere), and stop where the next level down would only be technical detail, basic styling (e.g. a button), or other tiny & obvious behavior (e.g. links, text).
- A guide for when to add child nodes is whether or not the node can be described without containing redundant information to its parent or child.`,
    `Parts of a node:
- label: a short, plain name. No filler adjectives/adverbs.
- description: ONE short, plain sentence (no semi-colons or run-on sentences either) containing only details that are actionable (i.e. things the user can change in code) or necessary for identification.
- kind:
  - app [the whole thing]
  - screen [a page people see]
  - component [a user-visible part of a page that can trigger events; can "absorb" other node types (e.g. a button that only triggers one action can be a "component" node that describes the action with no children)]
  - element [the visual representation of a component, only needed where complexity earns a node, like dialogs but not buttons]
  - action [an isolataed thing the app does; for limits/conditions checks, state the criteria/cutoff in the description]
  - process [a series (or parallel) of actions, sub-processes, data pulls/saves, etc.; used when its parent has other children nodes (never an only child), otherwise its child actions can be called directly from its parent]
  - data [data or other stored info it pulls or saves]
  - connection [another service or third party app it talks to (excl. databases, which are covered by "data")]
  - file and line: the path relative to the current folder, and the 1-based line, of the code that most directly creates or controls this thing (where a button is drawn, a check is made, a request is sent).`,
    `Where each node goes:
- The top level reflects the main functions of app: the handful of main pages/features, anything that runs on its own (like a scheduled job), and one "Foundations" node for shared things.
  - The "Foundations" node things like the global color scheme(s), fonts, layouts (menus, sidebars, footers), and shared fallback/error pages, are worth including. Simple components (buttons, tooltips, text boxes, etc.) should only be included at their implementation spot. Not every piece of text or styling needs its own node. This node holds only what app users see; any data or logic goes under the node that uses it.
- Below that, arrange nodes in a way that a user of the app could intuit without technical knowledge:
  - Dependencies (e.g. an action relies on a piece of data, so the data node becomes a child of the action node)
    - In most cases, a directly triggered feature/function will create a child-parent relationship; multiple direct dependencies from a single parent can be siblings.
  - Positioning (e.g. a component on a screen or a sub-component of a larger component would be nodes)
    - Child vs sibling assignment of a node should generally reflect the visual layout of the app's page
  - Chronology (e.g. a chain of events that occurs in a given order, which are "owned" by a common parent or otherwise not entirely dependent on each other)
    - These are often siblings for cases where a page content changes (the layouts would be siblings), or where an action/process node does not alter the prior node (in this case, simply make sure the siblings are ordered intuitively)
- Anything *functional* that is used in several places, like data or a connection, goes under each thing that uses it, rather than being moved up to a shared parent.`,
    `Some shapes a branch might take are listed below. These are examples to be read for inspiration/clarity and should in no way be read as restrictions on how branches can be arranged:
- A dialog component could have:
  - One direct nodes for the dialog "element" itself
  - A second direct node for a major sub-"component", like a display field which pulls data from the app (meaning it would have at least one child "data" node of its own)
  - A third direct node for a process triggered by a submit button (categorized as a "component", if no other direct children besides the would-be "process" node), which may also have its own children "action" nodes
- A "screen" could have multiple "components" as descentents, as well as an "action" or "process" for any background code that runs on the page
You have full freedom to arrange the tree however you think makes it easiest for its owner to follow.`,
    `Answer with a flat list of nodes. The first node is ${target && parent ? `"${target.label}"` : "the whole app"} itself, with parentKey "". Every other node's parentKey is the key of its parent. Keys are short unique ids you make up.`,
  ].join("\n\n");
}

function findLineage(node: MapNode, id: string): MapNode[] | undefined {
  if (node.id === id) return [node];
  for (const child of node.children) {
    const lineage = findLineage(child, id);
    if (lineage) return [node, ...lineage];
  }
}

function replaceNode(node: MapNode, replacement: MapNode): MapNode {
  if (node.id === replacement.id) return replacement;
  return { ...node, children: node.children.map((child) => replaceNode(child, replacement)) };
}

// Keeps the AI's file and line only when they name a real line inside the project.
async function locate(projectDir: string, file: string, line: number) {
  const path = relative(projectDir, resolve(projectDir, file));
  if (!path || path.startsWith("..") || isAbsolute(path)) return {};
  try {
    const lineCount = (await readFile(join(projectDir, path), "utf8")).split("\n").length;
    return line >= 1 && line <= lineCount ? { file: path, line } : {};
  } catch {
    return {};
  }
}
