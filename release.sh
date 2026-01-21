#!/usr/bin/env bash
set -euo pipefail

SERVER="root@166.1.60.87"

MSG="${1:-auto deploy $(date '+%Y-%m-%d %H:%M:%S')}"

echo "[1/8] Repo: $(pwd)"
echo "[2/8] Node: $(node -v)  NPM: $(npm -v)"

echo "[3/8] Build check..."
npm run build

echo "[4/8] Git add..."
git add -A

if git diff --cached --quiet; then
  echo "No changes to commit. Skipping push/deploy."
  exit 0
fi

echo "[5/8] Git commit..."
git commit -m "$MSG"

echo "[6/8] Git push..."
git push

echo "[7/8] Deploy on server..."
ssh -o StrictHostKeyChecking=accept-new "$SERVER" "bash -lc 'chmod 755 /root/deploy.sh 2>/dev/null || true; bash /root/deploy.sh'"

echo "[8/8] Done."
