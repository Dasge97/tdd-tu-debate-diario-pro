#!/bin/sh
set -eu

mkdir -p /shared/jobs/inbox
mkdir -p /shared/jobs/outbox
mkdir -p /shared/jobs/logs

if [ -f /etc/alpine-release ]; then
  for candidate in \
    /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-musl/bin/opencode \
    /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64-baseline-musl/bin/opencode \
    /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-arm64-musl/bin/opencode
  do
    if [ -x "$candidate" ]; then
      export OPENCODE_BIN_PATH="$candidate"
      echo "Using Alpine-compatible opencode binary: $OPENCODE_BIN_PATH"
      break
    fi
  done
fi

if command -v opencode >/dev/null 2>&1; then
  echo "opencode CLI detected: $(command -v opencode)"
else
  echo "opencode CLI was not found in PATH"
fi

node /workspace/bin/generate-config.js

if [ "${OPENCODE_AUTO_PROCESS:-true}" = "true" ]; then
  exec node /workspace/bin/watch-jobs.js
fi

tail -f /dev/null
