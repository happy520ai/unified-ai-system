#!/usr/bin/env bash
# Unified AI System MCP Service - macOS installer (launchd LaunchAgent)
#
# Usage:
#   ./deploy/install-mcp-service-macos.sh install
#   ./deploy/install-mcp-service-macos.sh uninstall
#   ./deploy/install-mcp-service-macos.sh status

set -euo pipefail

ACTION="${1:-install}"
REPO_ROOT="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
LOG_FILE="${LOG_FILE:-$REPO_ROOT/logs/mcp-service.log}"

if [ -z "$NODE_BIN" ]; then
  echo "node not found in PATH; set NODE_BIN=/path/to/node" >&2
  exit 1
fi

START_SCRIPT="$REPO_ROOT/packages/mcp-service/bin/start-service.js"
if [ ! -f "$START_SCRIPT" ]; then
  echo "daemon start script missing at $START_SCRIPT; confirm repository layout" >&2
  exit 1
fi

PLIST_PATH="$HOME/Library/LaunchAgents/io.github.happy520ai.unified-ai-system-mcp.plist"
LABEL="io.github.happy520ai.unified-ai-system-mcp"
mkdir -p "$REPO_ROOT/logs"
ERR_FILE="${LOG_FILE%.log}.err.log"
mkdir -p "$(dirname "$PLIST_PATH")"

case "$ACTION" in
  install)
    cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
      <string>$NODE_BIN</string>
      <string>$START_SCRIPT</string>
      <string>--daemon</string>
      <string>--repo-root</string>
      <string>$REPO_ROOT</string>
      <string>--log-file</string>
      <string>$LOG_FILE</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$REPO_ROOT</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
      <key>SuccessfulExit</key>
      <false/>
      <key>ThrottleInterval</key>
      <integer>5</integer>
    </dict>
    <key>ProcessType</key>
    <string>Background</string>
    <key>StandardOutPath</key>
    <string>${LOG_FILE}</string>
    <key>StandardErrorPath</key>
    <string>${ERR_FILE}</string>
  </dict>
</plist>
EOF
    UID_NUM=$(id -u)
    launchctl bootstrap "gui/$UID_NUM" "$PLIST_PATH" 2>/dev/null \
      || launchctl load "$PLIST_PATH"
    echo "installed: $PLIST_PATH"
    ;;
  uninstall)
    UID_NUM=$(id -u)
    launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "uninstalled"
    ;;
  status)
    UID_NUM=$(id -u)
    launchctl print "gui/$UID_NUM/$LABEL" 2>/dev/null || echo "not loaded"
    ;;
  *)
    echo "Usage: $0 {install|uninstall|status} [repo-root]" >&2
    exit 1
    ;;
esac
