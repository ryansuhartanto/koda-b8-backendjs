#!/usr/bin/env bash
set -eum

pgids=""

trap 'for pgid in $pgids; do kill -- "-$pgid" 2>/dev/null; done' EXIT

start() {
  "$@" &
  pgids="$pgids $!"
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

bun run test:parity
