#!/usr/bin/env bash
set -eu

pgids=""

trap 'for pgid in $pgids; do kill -- "-$pgid" 2>/dev/null; done' EXIT

start() {
  setsid "$@" &
  pgids="$pgids $(ps -o pgid= -p $! | tr -d ' ')"
}

# bun swallows the first websocket upgrade; spend it here rather than inside a
# test's own timeout. Best-effort, never gated on: some bun versions swallow
# every upgrade. Key is the RFC 6455 example.
warm() {
  curl -s -o /dev/null --max-time 2 \
    -H 'Connection: Upgrade' \
    -H 'Upgrade: websocket' \
    -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
    "$1/socket.io/?EIO=4&transport=websocket" || true
}

wait_for() {
  deadline=$(($(date +%s) + 30))

  until curl -sf "$1" >/dev/null; do
    for pgid in $pgids; do
      kill -0 -- "-$pgid" 2>/dev/null ||
        { echo "a service exited before $1 came up" >&2; exit 1; }
    done

    [ "$(date +%s)" -lt "$deadline" ] ||
      { echo "timed out waiting for $1" >&2; exit 1; }

    sleep 0.2
  done
}

start bun run serve:go
start bun run serve:js

wait_for "http://localhost:$GO_PORT/healthz"
wait_for "http://localhost:$JS_PORT/healthz"

warm "http://localhost:$GO_PORT"
warm "http://localhost:$JS_PORT"

bun run test:parity
