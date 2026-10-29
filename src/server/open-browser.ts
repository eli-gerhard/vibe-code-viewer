import { spawn } from "node:child_process";

// Opens a URL in the default browser with each OS's built-in opener. (The popular `open` package
// ships helper files next to its code, which a compiled single-file binary can't carry.)
export function openBrowser(url: string): void {
  const [command, args]: [string, string[]] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];

  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => console.log(`Open ${url} in your browser.`));
  child.unref();
}
