#!/usr/bin/env bash
# Runs every smoke test against the mock build on :4173 and prints one line per test. Exit code 1 if any failed.
#   VITE_MOCK=1 npx vite build && (npx vite preview --port 4173 --strictPort &) && ./scripts/smoke-all.sh
cd "$(dirname "$0")/.."; fail=0
for f in $(ls smoke*.mjs | sort -V); do
  out=$(timeout 200 node "$f" 2>&1); code=$?
  if [ $code -ne 0 ] || echo "$out" | grep -qE "TimeoutError|Error:"; then echo "FAIL $f  $(echo "$out" | grep -E 'waiting for|Error' | head -1 | cut -c1-140)"; fail=1; else echo "ok   $f"; fi
done
exit $fail
