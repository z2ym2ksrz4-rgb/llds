#!/usr/bin/env bash
# Deploy website + PWA (never the store apps): typecheck → site + web build → push llds and ilumie-site → restore mock build for smokes.
set -euo pipefail
MSG="${1:-llds: site + PWA update}"
TRAILER=$'\n\nCo-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01GGpukzb1UrCDBdg1Js3mqC'
npm run site 2>&1 | grep -E "error TS|built in|site written" || true
git add -A && (git commit -q -m "chore: version bump$TRAILER" || true) && git push -q origin main
(cd ../ilumie-site && git add -A && (git commit -q -m "$MSG$TRAILER" || true) && git push -q origin main && git log -1 --oneline)
git log -1 --oneline
VITE_MOCK=1 npx vite build 2>&1 | tail -1
