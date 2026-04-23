#!/usr/bin/env bash
# Install and register a GitHub Actions self-hosted runner for this repo,
# then install it as a systemd service so it auto-starts on boot.
#
# Needs:
#   - `gh` CLI authenticated as someone with admin access to the repo
#   - `sudo` (for svc.sh install)
#
# Safe to re-run: --replace causes the existing registration to be
# replaced rather than duplicated. If a systemd unit already exists it'll
# be stopped and reinstalled.

set -euo pipefail

REPO="akhlaaqbadulla/Themis-landing"
RUNNER_NAME="themis-landing-deploy"
RUNNER_LABELS="themis-landing,self-hosted,Linux,X64"
RUNNER_DIR="${HOME}/actions-runner"

log() { printf '\033[1;36m→\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v gh >/dev/null   || err "gh CLI not installed"
command -v curl >/dev/null || err "curl required"
command -v tar  >/dev/null || err "tar required"
command -v jq   >/dev/null || err "jq required"

gh auth status >/dev/null 2>&1 || err "gh not authenticated (run: gh auth login)"

log "preparing ${RUNNER_DIR}"
mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

# Stop any existing runner service before reconfiguring
if [[ -f svc.sh ]]; then
  log "stopping existing service (if any)"
  sudo ./svc.sh stop      || true
  sudo ./svc.sh uninstall || true
  if [[ -f .runner ]]; then
    log "de-registering previous runner"
    TOKEN_REMOVE=$(gh api -X POST "/repos/${REPO}/actions/runners/remove-token" --jq .token)
    ./config.sh remove --token "${TOKEN_REMOVE}" --unattended || true
  fi
fi

# Fetch latest runner release
log "fetching latest runner release info"
LATEST=$(gh api /repos/actions/runner/releases/latest)
VERSION=$(jq -r '.tag_name' <<<"${LATEST}" | sed 's/^v//')
URL=$(jq -r --arg v "${VERSION}" '.assets[] | select(.name == "actions-runner-linux-x64-\($v).tar.gz") | .browser_download_url' <<<"${LATEST}")
[[ -n "${URL}" && "${URL}" != "null" ]] || err "could not resolve runner download URL"

log "downloading runner ${VERSION}"
curl -fsSL -o runner.tar.gz "${URL}"
tar xzf runner.tar.gz
rm runner.tar.gz

log "requesting registration token from ${REPO}"
REG_TOKEN=$(gh api -X POST "/repos/${REPO}/actions/runners/registration-token" --jq .token)

log "configuring runner (name=${RUNNER_NAME}, labels=${RUNNER_LABELS})"
./config.sh \
  --url "https://github.com/${REPO}" \
  --token "${REG_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_LABELS}" \
  --work _work \
  --unattended \
  --replace

log "installing as systemd service"
sudo ./svc.sh install "${USER}"
sudo ./svc.sh start

log "runner status"
sudo ./svc.sh status | head -20

echo
log "✓ runner registered as '${RUNNER_NAME}' on repo ${REPO}"
log "  workflow at .github/workflows/deploy.yml will fire on push to main"
