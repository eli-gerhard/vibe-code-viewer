# Vibe Code Viewer

See a hierarchy of what a project does, mapped by the AI CLI you already use ([Claude Code](https://code.claude.com/docs/en/setup) or [Codex](https://developers.openai.com/codex/cli)).

Everything runs on your computer. Vibe Code Viewer has no accounts and no servers of its own. It asks your own Claude Code or Codex to read the project, using your existing sign-in, and shows the result in your browser.

> **Status:** early. The app starts and finds your AI CLI. Mapping projects comes next.

## Before you start

Install **Claude Code** or **Codex** and sign in once. Vibe Code Viewer uses whichever one you have.

## Install

**macOS or Linux:** open Terminal, paste this, and press Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/eli-gerhard/vibe-code-viewer/main/install/install.sh | sh
```

**Windows:** open PowerShell, paste this, and press Enter:

```powershell
irm https://raw.githubusercontent.com/eli-gerhard/vibe-code-viewer/main/install/install.ps1 | iex
```

After that, open **Vibe Code Viewer** from your Applications folder, app menu or Start menu. It opens in your browser. Running the install command again updates it.

**Already use Node.js?** You can run it without installing (coming soon to npm):

```bash
npx vibe-code-viewer
```

## Development

Requires Node.js 22.18+ (24 recommended). [Bun](https://bun.sh) is only needed to build the standalone binaries.

```bash
npm install
npm run dev          # local server + web UI with hot reload at http://localhost:5173
npm test
npm run lint
npm run typecheck
npm run build        # npm package: dist/cli.js
npm run build:binaries -- darwin-arm64   # standalone binary: dist/bin/
```

### Releasing

```bash
npm version patch    # or minor / major
git push --follow-tags
```

Pushing the tag builds the binaries and attaches them to a GitHub release, which is where the install scripts download from.

## License

[MIT](LICENSE)
