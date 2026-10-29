import { delimiter } from "node:path";
import { describe, expect, it } from "vitest";
import { detectAgent, parseVersion, withCommonBinDirs } from "./agents.ts";

describe("agent detection", () => {
  it("parses versions from each CLI's --version output", () => {
    expect(parseVersion("2.1.3 (Claude Code)\n")).toBe("2.1.3");
    expect(parseVersion("codex-cli 0.98.0\n")).toBe("0.98.0");
    expect(parseVersion("no version here")).toBeUndefined();
  });

  it("reports a CLI that isn't on PATH as not installed", async () => {
    const status = await detectAgent({
      id: "claude",
      name: "Missing CLI",
      command: "vibe-code-viewer-missing-cli",
      installUrl: "https://example.com",
    });
    expect(status).toMatchObject({ installed: false });
  });

  it.skipIf(process.platform === "win32")("appends common install dirs to PATH once", () => {
    const path = withCommonBinDirs(["/usr/bin", "/opt/homebrew/bin"].join(delimiter));
    const dirs = path.split(delimiter);
    expect(dirs[0]).toBe("/usr/bin");
    expect(dirs.filter((dir) => dir === "/opt/homebrew/bin")).toHaveLength(1);
    expect(dirs).toContain("/usr/local/bin");
  });
});
