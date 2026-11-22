#!/usr/bin/env bash
# Deploy ASK HRFlow to the Hostinger VPS without clobbering production secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-76.13.4.214}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/hrflow_vps}"
REMOTE="${DEPLOY_REMOTE:-/home/automystics-hrflow/htdocs/hrflow.automystics.tech}"
USER_REMOTE="${DEPLOY_USER:-automystics-hrflow}"

cd "$ROOT"
npm run build

rsync -az --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude uploads \
  --exclude test-results \
  --exclude .env \
  --exclude .deploy-secrets \
  -e "ssh -i $KEY -o StrictHostKeyChecking=yes" \
  "$ROOT/" "root@$HOST:$REMOTE/"

ssh -i "$KEY" "root@$HOST" bash -s <<EOF
set -euo pipefail
# Always restore production env from the secrets vault (never ship workspace .env)
if [[ -f $REMOTE/.deploy-secrets/hrflow.env ]]; then
  cp $REMOTE/.deploy-secrets/hrflow.env $REMOTE/.env
  chmod 600 $REMOTE/.env
fi
chown -R $USER_REMOTE:$USER_REMOTE $REMOTE
sudo -u $USER_REMOTE -H bash -lc 'cd $REMOTE && pm2 restart ask-hrflow'
sleep 2
curl -sf http://127.0.0.1:3122/api/health
echo
EOF
