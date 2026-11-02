import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROMPT = "Choose your project folder";

// A web page can't learn a chosen folder's real path, so the server opens the OS's own picker.
const PICKERS: Partial<Record<NodeJS.Platform, [string, string[]]>> = {
  darwin: ["osascript", ["-e", `POSIX path of (choose folder with prompt "${PROMPT}")`]],
  win32: [
    "powershell.exe",
    [
      "-NoProfile",
      "-STA",
      "-Command",
      // A topmost owner keeps the window from opening behind the browser.
      `Add-Type -AssemblyName System.Windows.Forms; $owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog -Property @{ Description = '${PROMPT}' }; if ($dialog.ShowDialog($owner) -eq 'OK') { $dialog.SelectedPath }`,
    ],
  ],
  linux: ["zenity", ["--file-selection", "--directory", `--title=${PROMPT}`]],
};

// Resolves to undefined when the user cancels; rejects when no picker is available.
export async function pickFolder(): Promise<string | undefined> {
  const picker = PICKERS[process.platform];
  if (!picker) throw new Error("No folder window is available on this system.");
  try {
    const { stdout } = await execFileAsync(...picker);
    return stdout.trim() || undefined;
  } catch (error) {
    // osascript and zenity exit with 1 on cancel.
    if ((error as { code?: unknown }).code === 1) return undefined;
    throw error;
  }
}
