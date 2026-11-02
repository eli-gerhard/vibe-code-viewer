import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { Codex } from "@openai/codex-sdk";
import which from "which";
import type { AgentId, AgentStatus } from "../shared/api.ts";

const execFileAsync = promisify(execFile);

export interface AgentDefinition {
  id: AgentId;
  name: string;
  command: string;
  installUrl: string;
  // Runs `prompt` in `cwd` with read-only file access and returns the answer, shaped by `schema`.
  ask: (prompt: string, schema: Record<string, unknown>, cwd: string) => Promise<unknown>;
}

// Both SDKs run the user's own installed CLI (their sign-in), found on PATH, instead of a bundled copy.
export const AGENTS: AgentDefinition[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    installUrl: "https://code.claude.com/docs/en/setup",
    async ask(prompt, schema, cwd) {
      const messages = query({
        prompt,
        options: {
          cwd,
          pathToClaudeCodeExecutable: await which("claude"),
          model: "claude-haiku-5-5",
          effort: "high",
          tools: ["Read", "Glob", "Grep"],
          // --restricted confines the file tools to `cwd` and ignores the user's settings files.
          extraArgs: { restricted: null },
          strictMcpConfig: true,
          persistSession: false,
          outputFormat: { type: "json_schema", schema },
        },
      });
      for await (const message of messages) {
        if (
          message.type === "result" &&
          message.subtype === "success" &&
          message.structured_output
        ) {
          return message.structured_output;
        }
      }
      throw new Error("Claude Code finished without returning a map.");
    },
  },
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    installUrl: "https://developers.openai.com/codex/cli",
    async ask(prompt, schema, cwd) {
      const thread = new Codex({ codexPathOverride: await which("codex") }).startThread({
        workingDirectory: cwd,
        skipGitRepoCheck: true,
        sandboxMode: "read-only",
        approvalPolicy: "never",
        model: "gpt-6-luna",
        modelReasoningEffort: "high",
      });
      const { finalResponse } = await thread.run(prompt, { outputSchema: schema });
      return JSON.parse(finalResponse);
    },
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
