#!/bin/bash
# Starts a named Claude Code remote-control session in a persistent tmux window.
# Connect from claude.ai → Remote Sessions → "bacta"
SESSION="claude-remote"

tmux has-session -t "$SESSION" 2>/dev/null && {
  echo "Session '$SESSION' already running."
  exit 0
}

tmux new-session -d -s "$SESSION" -c /opt/bacta \
  "claude --remote-control bacta --dangerously-skip-permissions"

echo "Started tmux session '$SESSION'."
