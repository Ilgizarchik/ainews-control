#!/usr/bin/env bash
set -euo pipefail

SERVER="root@166.1.60.87"
REMOTE_SCRIPT="/root/deploy.sh"
MSG="${1:-auto deploy $(date '+%Y-%m-%d %H:%M:%S')}"

echo "----------------------------------------"
echo "STARTING RELEASE CYCLE"
echo "Repo: $(pwd)"
echo "Time: $(date)"
echo "----------------------------------------"

# 1. Build Check
echo "[1/3] Building locally..."
npm run build

# 2. Git Commit & Push
echo "[2/3] Git operations..."
git add -A

if git diff --cached --quiet; then
  echo "No changes to commit."
  # Optional: decide if we should stop or continue. 
  # The user description says "release.bat = build -> commit/push -> deploy".
  # If there is nothing to commit, we might still want to push if local is ahead?
  # But usually "release" implies sending NEW changes.
  # However, if the user just wants to deploy existing local commits that weren't pushed?
  
  # Let's check if there are unpushed commits.
  if [ -z "$(git log origin/main..HEAD)" ]; then
     echo "No local changes and no unpushed commits. Nothing to do."
     echo "Use deploy.bat if you just want to restart the server."
     exit 0
  else
     echo "Found unpushed commits. Proceeding to push..."
  fi
else
  git commit -m "$MSG"
fi

git push

# 3. Deploy on Server
echo "[3/3] Triggering server deploy..."
ssh -o StrictHostKeyChecking=accept-new "$SERVER" "$REMOTE_SCRIPT"

echo "----------------------------------------"
echo "RELEASE COMPLETED SUCCESSFULLY"
echo "----------------------------------------"
