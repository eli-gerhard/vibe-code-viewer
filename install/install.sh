#!/bin/sh
# Installs Vibe Code Viewer on macOS or Linux:
#   curl -fsSL https://raw.githubusercontent.com/eli-gerhard/vibe-code-viewer/main/install/install.sh | sh
#
# Optional environment variables:
#   VCV_VERSION      Release tag to install, e.g. v0.1.0 (default: latest)
#   VCV_INSTALL_DIR  Where to put the program (default: ~/.vibe-code-viewer)
#   VCV_NO_LAUNCH    Set to 1 to skip opening the app when the install finishes
set -eu

REPO="eli-gerhard/vibe-code-viewer"
APP_NAME="Vibe Code Viewer"
INSTALL_DIR="${VCV_INSTALL_DIR:-$HOME/.vibe-code-viewer}"
BIN="$INSTALL_DIR/bin/vibe-code-viewer"
LINK_DIR="$HOME/.local/bin"

fail() {
  echo "Error: $1" >&2
  exit 1
}

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "Unsupported system $(uname -s). On Windows, use install.ps1 (see the README)." ;;
esac

case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) fail "Unsupported processor $(uname -m)." ;;
esac

# A Terminal running under Rosetta reports x86_64 on Apple Silicon Macs; prefer the native build.
if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi

if [ -n "${VCV_VERSION:-}" ]; then
  url="https://github.com/$REPO/releases/download/$VCV_VERSION/vibe-code-viewer-$os-$arch"
else
  url="https://github.com/$REPO/releases/latest/download/vibe-code-viewer-$os-$arch"
fi

echo "Downloading $APP_NAME for $os-$arch..."
mkdir -p "$(dirname "$BIN")"
curl -fL --progress-bar "$url" -o "$BIN.download" || fail "Download failed from $url"
chmod +x "$BIN.download"
# Stop a running copy so reopening the app picks up the new version.
pkill -f "$BIN" 2>/dev/null || true
mv "$BIN.download" "$BIN"

# Make `vibe-code-viewer` available as a terminal command.
mkdir -p "$LINK_DIR"
ln -sf "$BIN" "$LINK_DIR/vibe-code-viewer"

# Clickable launchers. On macOS, apps opened from Finder get a minimal PATH, so the launcher starts
# the viewer through a login shell to see the same PATH as the user's terminal (and find claude/codex).
if [ "$os" = darwin ]; then
  launcher="$HOME/Applications/$APP_NAME.app"
  mkdir -p "$launcher/Contents/MacOS"
  cat >"$launcher/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>io.github.eli-gerhard.vibe-code-viewer</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict>
</plist>
EOF
  cat >"$launcher/Contents/MacOS/launch" <<EOF
#!/bin/sh
exec "\${SHELL:-/bin/zsh}" -lc 'nohup "$BIN" >>"$INSTALL_DIR/viewer.log" 2>&1 &'
EOF
  chmod +x "$launcher/Contents/MacOS/launch"
  launch_hint="Open \"$APP_NAME\" from your Applications folder"
else
  apps_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  mkdir -p "$apps_dir"
  cat >"$apps_dir/vibe-code-viewer.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Exec="$BIN"
Terminal=false
Categories=Development;
EOF
  launch_hint="Open \"$APP_NAME\" from your app menu"
fi

echo ""
echo "$APP_NAME is installed."

if ! command -v claude >/dev/null 2>&1 && ! command -v codex >/dev/null 2>&1; then
  echo ""
  echo "Vibe Code Viewer uses Claude Code or Codex to map your projects, and neither was found."
  echo "Install one and sign in once:"
  echo "  Claude Code: https://code.claude.com/docs/en/setup"
  echo "  Codex:       https://developers.openai.com/codex/cli"
fi

case ":$PATH:" in
  *":$LINK_DIR:"*) command_hint="or run: vibe-code-viewer" ;;
  *) command_hint="or run: $BIN" ;;
esac

echo ""
echo "$launch_hint, $command_hint"

if [ "$os" = darwin ] && [ "${VCV_NO_LAUNCH:-0}" != 1 ]; then
  open "$launcher"
fi
