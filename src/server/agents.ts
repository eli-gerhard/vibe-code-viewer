import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import type { AgentId, AgentStatus } from "../shared/api.ts";

const execFileAsync = promisify(execFile);

export interface AgentDefinition {
  id: AgentId;
  name: string;
  command: string;
  installUrl: string;
}

export const AGENTS: AgentDefinition[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    installUrl: "https://code.claude.com/docs/en/setup",
  },
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    installUrl: "https://developers.openai.com/codex/cli",
  },
];

export function detectAgents(): Promise<AgentStatus[]> {
  return Promise.all(AGENTS.map(detectAgent));
}

export async function detectAgent(agent: AgentDefinition): Promise<AgentStatus> {
  const status = { id: agent.id, name: agent.name, installUrl: agent.installUrl };
  try {
    const { stdout } = await execFileAsync(agent.command, ["--version"], {
      timeout: 10_000,
      // npm-installed CLIs on Windows are .cmd shims, which only resolve through a shell.
      shell: process.platform === "win32",
    });
    return { ...status, installed: true, version: parseVersion(stdout) };
  } catch {
    return { ...status, installed: false };
  }
}

export function parseVersion(output: string): string | undefined {
  return output.match(/\d+\.\d+\.\d+[\w.-]*/)?.[0];
}

// Apps opened from a desktop icon get a minimal PATH, so append the usual places the AI CLIs
// install to. Appending keeps the user's own PATH order in charge.
export function withCommonBinDirs(path: string): string {
  if (process.platform === "win32") return path;
  const dirs = [join(homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  const existing = new Set(path.split(delimiter));
  return [path, ...dirs.filter((dir) => !existing.has(dir))].filter(Boolean).join(delimiter);
}
