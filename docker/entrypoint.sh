#!/usr/bin/env bash
# Supervisor for the unified ERP container.
#
# Runs Caddy plus both Fastify backends as one process tree. If any child
# exits, the rest are stopped and the container exits with the child's status,
# so the platform restarts a genuinely broken instance instead of serving a
# half-dead one.
set -euo pipefail

# Public port. The platform (Fly, Docker, etc.) routes traffic here.
export CADDY_PORT="${PORT:-8080}"
# Private loopback ports for the backends. Never exposed.
export MUSHAK_PORT="${MUSHAK_PORT:-9080}"
export LOKKHI_PORT="${LOKKHI_PORT:-9081}"

echo "[erp] caddy on :${CADDY_PORT}, mushak api on :${MUSHAK_PORT}, lokkhi api on :${LOKKHI_PORT}"

pids=()

start() {
	"$@" &
	pids+=("$!")
}

stop_all() {
	trap - TERM INT
	if [ "${#pids[@]}" -gt 0 ]; then
		kill -TERM "${pids[@]}" 2>/dev/null || true
	fi
	wait || true
}

trap 'echo "[erp] stopping"; stop_all; exit 0' TERM INT

start caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

# Each backend reads PORT and HOST from its environment. `cd` so relative
# imports and any path lookups resolve from the package root.
start env PORT="$MUSHAK_PORT" HOST=0.0.0.0 \
	bash -c 'cd /app/mushak/backend && exec node dist/index.js'

start env PORT="$LOKKHI_PORT" HOST=0.0.0.0 \
	bash -c 'cd /app/lokkhi/backend && exec node dist/index.js'

# Block until the first child exits, then tear the container down.
set +e
wait -n
status=$?
echo "[erp] a child process exited with status ${status}; shutting down"
stop_all
exit "$status"
