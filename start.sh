#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_URL="http://localhost:5173"
BACKEND_SESSION="samba-backend"
FRONTEND_SESSION="samba-frontend"

command -v tmux >/dev/null || { echo "tmux not installed" >&2; exit 1; }

start_session() {
  local name="$1" dir="$2" cmd="$3"
  if tmux has-session -t "$name" 2>/dev/null; then
    echo "[$name] already running — attach with: tmux attach -t $name"
  else
    tmux new-session -d -s "$name" -c "$dir" "$cmd"
    echo "[$name] started"
  fi
}

start_session "$BACKEND_SESSION" "$REPO" \
  "uv run python -m uvicorn backend.main:app --reload --port 8000 --reload-exclude '.venv/*' --reload-exclude 'data/*'"

start_session "$FRONTEND_SESSION" "$REPO/frontend" "npm run dev"

echo -n "waiting for frontend"
for _ in {1..60}; do
  if curl -fs "$FRONTEND_URL" >/dev/null 2>&1; then
    echo " ready"
    break
  fi
  echo -n "."
  sleep 0.5
done

if command -v xdg-open >/dev/null; then
  xdg-open "$FRONTEND_URL" >/dev/null 2>&1 &
elif command -v open >/dev/null; then
  open "$FRONTEND_URL" >/dev/null 2>&1 &
else
  echo "open manually: $FRONTEND_URL"
fi

cat <<EOF

backend : tmux attach -t $BACKEND_SESSION
frontend: tmux attach -t $FRONTEND_SESSION
stop    : tmux kill-session -t $BACKEND_SESSION && tmux kill-session -t $FRONTEND_SESSION
EOF
