// Compiles the CLI into standalone executables (no Node needed) for the one-line installer.
// Usage: npm run build:binaries [-- target...]   e.g. npm run build:binaries -- darwin-arm64
import { execFileSync } from "node:child_process";

const TARGETS = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "windows-x64"];

const requested = process.argv.slice(2);
const unknown = requested.filter((target) => !TARGETS.includes(target));
if (unknown.length > 0) {
  console.error(`Unknown target(s): ${unknown.join(", ")}. Choose from: ${TARGETS.join(", ")}`);
  process.exit(1);
}

for (const target of requested.length > 0 ? requested : TARGETS) {
  const outfile = `dist/bin/vibe-code-viewer-${target}${target.startsWith("windows") ? ".exe" : ""}`;
  execFileSync(
    "bun",
    [
      "build",
      "src/cli.ts",
      "--compile",
      "--minify",
      `--target=bun-${target}`,
      `--outfile=${outfile}`,
    ],
    { stdio: "inherit" },
  );

  // Apple Silicon only runs signed binaries. An ad-hoc signature is free and needs no Apple account.
  if (target.startsWith("darwin")) {
    if (process.platform === "darwin") {
      execFileSync("codesign", ["--force", "--sign", "-", outfile], { stdio: "inherit" });
    } else {
      console.warn(`Skipped signing ${outfile}: macOS binaries can only be signed on a Mac.`);
    }
  }
}
