import { useEffect, useState } from "react";
import type { AgentStatus } from "../shared/api.ts";

export function App() {
  const [agents, setAgents] = useState<AgentStatus[]>();
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json() as Promise<AgentStatus[]>)
      .then(setAgents)
      .catch(() => setError(true));
  }, []);

  return (
    <main>
      <h1>Vibe Code Viewer</h1>
      <p className="tagline">See what your project does, mapped by your own AI CLI.</p>

      <section>
        <h2>AI CLIs on this computer</h2>
        {error && <p className="error">Couldn't reach the local server. Is it still running?</p>}
        {!agents && !error && <p className="muted">Checking…</p>}
        {agents && (
          <ul className="agents">
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </ul>
        )}
        {agents && !agents.some((agent) => agent.installed) && (
          <p>Install Claude Code or Codex, sign in once, then reload this page.</p>
        )}
      </section>

      <p className="muted">Choosing a project to map is coming next.</p>
    </main>
  );
}

function AgentRow({ agent }: { agent: AgentStatus }) {
  return (
    <li>
      <span>{agent.name}</span>
      {agent.installed ? (
        <span className="badge">Installed{agent.version && ` · v${agent.version}`}</span>
      ) : (
        <a href={agent.installUrl} target="_blank" rel="noreferrer">
          How to install
        </a>
      )}
    </li>
  );
}
