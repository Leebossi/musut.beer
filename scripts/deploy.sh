#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${1:-/var/www/musut.beer}"
GATEWAY_PATH="${2:-/opt/musut-gateway}"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="$DEPLOY_PATH/releases/$TIMESTAMP"
GATEWAY_RELEASE_DIR="$GATEWAY_PATH/releases/$TIMESTAMP"

mkdir -p "$DEPLOY_PATH/releases" "$DEPLOY_PATH/shared"
mkdir -p "$GATEWAY_PATH/releases" "$GATEWAY_PATH/shared"
mkdir -p "$RELEASE_DIR"
mkdir -p "$GATEWAY_RELEASE_DIR"

rsync -a --delete "$DEPLOY_PATH/incoming/site/" "$RELEASE_DIR/"
if [[ -d "$DEPLOY_PATH/incoming/protected" ]]; then
	mkdir -p "$DEPLOY_PATH/shared/protected-origin"
	rsync -a --delete "$DEPLOY_PATH/incoming/protected/" "$DEPLOY_PATH/shared/protected-origin/"
fi

ln -sfn "$RELEASE_DIR" "$DEPLOY_PATH/current"

if [[ -d "$DEPLOY_PATH/incoming/gateway" ]]; then
	rsync -a --delete "$DEPLOY_PATH/incoming/gateway/" "$GATEWAY_RELEASE_DIR/"

	if [[ -f "$GATEWAY_RELEASE_DIR/package.json" ]]; then
		(
			cd "$GATEWAY_RELEASE_DIR"
			npm ci --omit=dev
		)
	fi

	ln -sfn "$GATEWAY_RELEASE_DIR" "$GATEWAY_PATH/current"

	if command -v systemctl >/dev/null 2>&1; then
		systemctl --user daemon-reload || true
		systemctl --user restart musut-gateway.service || true
	fi
fi

# Optional: keep only latest 5 releases
ls -1dt "$DEPLOY_PATH"/releases/* | tail -n +6 | xargs rm -rf || true
ls -1dt "$GATEWAY_PATH"/releases/* | tail -n +6 | xargs rm -rf || true

echo "Deployed site release: $RELEASE_DIR"
echo "Deployed gateway release: $GATEWAY_RELEASE_DIR"
