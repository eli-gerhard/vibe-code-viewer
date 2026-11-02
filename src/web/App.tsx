import { type FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import type {
  AgentStatus,
  ErrorResponse,
  MapNode,
  PickFolderResponse,
  ProjectResponse,
  RecentProject,
} from "../shared/api.ts";
import { ProjectView } from "./ProjectView.tsx";

// Calls a local API route (a POST when `body` is given), throwing the server's error message.
async function api<T>(url: string, body?: object): Promise<T> {
  const init = body && { method: "POST", body: JSON.stringify(body) };
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  const data = await res.json();
  if (!res.ok) throw new Error((data as ErrorResponse).error);
  return data;
}

export function App() {
  const [project, setProject] = useState<ProjectResponse>();
  const [mapping, setMapping] = useState<string>();
  const [error, setError] = useState<string>();

  // Maps the whole app, or only `node` and everything under it.
  async function remap(path: string, name: string, node?: MapNode) {
    setMapping(node?.label ?? name);
    setError(undefined);
    try {
      const map = await api<MapNode>("/api/project/map", { path, nodeId: node?.id });
      setProject((current) => (current?.path === path ? { ...current, map } : current));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMapping(undefined);
    }
  }

  function open(opened: ProjectResponse) {
    setProject(opened);
    if (!opened.map) remap(opened.path, opened.name);
  }

  return project ? (
    <ProjectView
      project={project}
      mapping={mapping}
      error={error}
      onRemap={(node) => remap(project.path, project.name, node)}
      onClose={() => setProject(undefined)}
    />
  ) : (
    <Home onOpen={open} />
  );
}

function Home({ onOpen }: { onOpen: (project: ProjectResponse) => void }) {
  const [agents, setAgents] = useState<AgentStatus[]>();
  const [error, setError] = useState(false);
  const [openError, setOpenError] = useState<string>();
  const [typedPath, setTypedPath] = useState<string>();
  const [recent, setRecent] = useState<RecentProject[]>([]);

  useEffect(() => {
    api<AgentStatus[]>("/api/agents")
      .then(setAgents)
      .catch(() => setError(true));
    api<RecentProject[]>("/api/recent-projects").then(setRecent);
  }, []);

  const open = (path: string) =>
    api<ProjectResponse>(`/api/project?path=${encodeURIComponent(path)}`)
      .then(onOpen)
      .catch((err: Error) => setOpenError(err.message));

  async function choose() {
    setOpenError(undefined);
    try {
      const { path } = await api<PickFolderResponse>("/api/pick-folder", {});
      if (path) open(path);
    } catch {
      setOpenError("Couldn't open a folder window. Paste the folder's full path instead.");
      setTypedPath("");
    }
  }

  function submitPath(event: FormEvent) {
    event.preventDefault();
    if (typedPath) open(typedPath);
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-12">
      <header>
        <h1 className="font-serif text-3xl font-medium">Vibe Code Viewer</h1>
        <p className="text-muted-foreground">
          See what your project does, mapped by your own AI CLI.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading font-medium">AI CLIs on this computer</h2>
        {error && (
          <p className="text-destructive">Couldn't reach the local server. Is it still running?</p>
        )}
        {!agents && !error && <p className="text-muted-foreground">Checking…</p>}
        {agents && (
          <ItemGroup>
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </ItemGroup>
        )}
        {agents && !agents.some((agent) => agent.installed) && (
          <p>Install Claude Code or Codex, sign in once, then reload this page.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading font-medium">Your project</h2>
        <Button
          className="self-start"
          onClick={choose}
          disabled={!agents?.some((agent) => agent.installed)}
        >
          Choose project folder…
        </Button>
        {typedPath !== undefined && (
          <form className="flex gap-2" onSubmit={submitPath}>
            <Input
              value={typedPath}
              onChange={(event) => setTypedPath(event.target.value)}
              placeholder="/Users/you/my-app"
              aria-label="Project folder path"
            />
            <Button type="submit" variant="outline">
              Open
            </Button>
          </form>
        )}
        {openError && <p className="text-sm text-destructive">{openError}</p>}
      </section>

      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading font-medium">Recent projects</h2>
          <ItemGroup>
            {recent.map((project) => (
              <Item key={project.path} variant="outline">
                <ItemContent className="min-w-0">
                  <ItemTitle>{project.name}</ItemTitle>
                  <ItemDescription className="truncate">{project.path}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="outline" size="sm" onClick={() => open(project.path)}>
                    Open
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </section>
      )}
    </main>
  );
}

function AgentRow({ agent }: { agent: AgentStatus }) {
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{agent.name}</ItemTitle>
      </ItemContent>
      <ItemActions>
        {agent.installed ? (
          <Badge variant="secondary">Installed{agent.version && ` · v${agent.version}`}</Badge>
        ) : (
          <Button variant="link" asChild>
            <a href={agent.installUrl} target="_blank" rel="noreferrer">
              How to install
            </a>
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
