#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h}"
cd "$project_dir"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22.12 or newer is required. Install it, then run this command again."
  exit 1
fi

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)'; then
  echo "Node.js 22.12 or newer is required (found $(node --version))."
  exit 1
fi

if [[ ! -x node_modules/.bin/vite ]]; then
  echo "Installing the project's pinned dependencies..."
  npm ci
fi

port="$(node -e 'const net = require("node:net"); const server = net.createServer(); server.listen(0, "127.0.0.1", () => { process.stdout.write(String(server.address().port)); server.close(); });')"
url="http://127.0.0.1:${port}/"

echo "Starting Zombie Fire Suppression Sim at $url"
npm run dev -- --port "$port" --strictPort &
server_pid=$!

cleanup() {
  kill "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for attempt in {1..480}; do
  if curl --silent --fail "$url" >/dev/null; then
    # Launch Safari first: on a cold first run its Start Page can consume the
    # initial open request before the requested URL is loaded.
    open -a Safari
    sleep 1
    open -a Safari "$url"
    echo "The simulator is open in Safari. Keep this Terminal window open while using it."
    wait "$server_pid"
    exit $?
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "The local app server stopped before it could open."
    wait "$server_pid"
    exit $?
  fi
  if (( attempt % 40 == 0 )); then
    echo "Waiting for the local app server..."
  fi
  sleep 0.25
done

echo "The local app server did not become ready."
exit 1
