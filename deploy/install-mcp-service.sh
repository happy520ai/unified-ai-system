#!/usr/bin/env bash
# Unified AI System MCP Service - Linux installer (systemd --user)
#
# Usage:
#   ./deploy/install-mcp-service.sh install
#   ./deploy/install-mcp-service.sh uninstall
#   ./deploy/install-mcp-service.sh status
#
# Requirements: systemd (default on most modern Linux distros), Node >= 20.

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

SERVICE_FILE="$HOME/.config/systemd/user/unified-ai-system-mcp.service"
mkdir -p "$(dirname "$SERVICE_FILE")" "$REPO_ROOT/logs"

case "$ACTION" in
  install)
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Unified AI System MCP Service
After=network.target

[Service]
Type=simple
ExecStart=$NODE_BIN '$START_SCRIPT' --daemon --repo-root '$REPO_ROOT' --log-file '$LOG_FILE'
WorkingDirectory=$REPO_ROOT
Restart=always
RestartSec=5
StandardOutput=append:$REPO_ROOT/logs/mcp-service.out.log
StandardError=append:$REPO_ROOT/logs/mcp-service.err.log
TimeoutStopSec=15

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable unified-ai-system-mcp.service
    systemctl --user start unified-ai-system-mcp.service
    echo "installed: $SERVICE_FILE"
    echo "  exec: $NODE_BIN $START_SCRIPT --daemon"
    echo "  logs: $LOG_FILE"
    ;;
  uninstall)
    systemctl --user stop unified-ai-system-mcp.service 2>/dev/null || true
    systemctl --user disable unified-ai-system-mcp.service 2>/dev/null || true
    rm -f "$SERVICE_FILE"
    systemctl --user daemon-reload
    echo "uninstalled"
    ;;
  status)
    systemctl --user status unified-ai-system-mcp.service --no-pager || true
    ;;
  *)
    echo "Usage: $0 {install|uninstall|status} [repo-root]" >&2
    exit 1
    ;;
esac
