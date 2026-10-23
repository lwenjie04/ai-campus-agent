#!/usr/bin/env bash
set -Eeuo pipefail

action="${1:-}"
base_dir="${2:-}"
release_id="${3:-}"
app_port="${4:-}"
archive_path="${5:-}"

if [[ ! "$base_dir" =~ ^/[A-Za-z0-9._/-]+$ || "$base_dir" == "/" || "$base_dir" == *"/../"* || "$base_dir" == */.. ]]; then
  echo "DEPLOY_PATH must be a safe absolute path without parent-directory segments." >&2
  exit 2
fi

if [[ ! "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]]; then
  echo "Release identifier is invalid." >&2
  exit 2
fi

if [[ ! "$app_port" =~ ^[0-9]{1,5}$ ]]; then
  echo "Application port is invalid." >&2
  exit 2
fi
app_port_number=$((10#$app_port))
if ((app_port_number < 1 || app_port_number > 65535)); then
  echo "Application port is invalid." >&2
  exit 2
fi

for required_command in curl node npm pm2 tar timeout; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "Required server command is missing: $required_command" >&2
    exit 2
  }
done

current_link="$base_dir/current"
previous_link="$base_dir/previous"
release_dir="$base_dir/releases/$release_id"
health_url="http://127.0.0.1:$app_port/health"

switch_link() {
  local target="$1"
  local link="$2"
  local next_link="${link}.next"
  ln -sfn "$target" "$next_link"
  mv -Tf "$next_link" "$link"
}

reload_backend() {
  local active_release
  local active_release_id
  active_release="$(readlink -f "$current_link" 2>/dev/null || true)"
  active_release_id="$(basename "$active_release")"
  [[ -n "$active_release" && -d "$active_release" ]] || return 1
  # PM2 can retain an existing app's old cwd when startOrReload reads the new
  # ecosystem file. Delete the named process first so it starts from this exact
  # release path; rollback calls this same function after switching `current`.
  pm2 delete ai-campus-agent-backend >/dev/null 2>&1 || true
  CAMPUS_APP_DIR="$active_release" CAMPUS_APP_PORT="$app_port" CAMPUS_RELEASE_ID="$active_release_id" \
    pm2 start "$active_release/ecosystem.config.cjs" --env production --update-env
  pm2 save
}

wait_for_health() {
  local allow_missing_release_id="${1:-false}"
  local attempt
  local active_release
  local active_release_id
  local response
  active_release="$(readlink -f "$current_link" 2>/dev/null || true)"
  active_release_id="$(basename "$active_release")"
  [[ -n "$active_release" && -d "$active_release" ]] || return 1
  for attempt in {1..30}; do
    response="$(curl --silent --fail --max-time 4 "$health_url" 2>/dev/null || true)"
    if [[ -n "$response" ]] && node -e 'const [expected, raw, allowMissing] = process.argv.slice(1); try { const health = JSON.parse(raw); process.exitCode = health.ok === true && (health.releaseId === expected || (allowMissing === "true" && !health.releaseId)) ? 0 : 1 } catch { process.exitCode = 1 }' "$active_release_id" "$response" "$allow_missing_release_id" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback_current() {
  local failed_release
  local stable_release
  failed_release="$(readlink -f "$current_link" 2>/dev/null || true)"
  stable_release="$(readlink -f "$previous_link" 2>/dev/null || true)"

  if [[ -n "$stable_release" && -d "$stable_release" ]]; then
    switch_link "$stable_release" "$current_link"
    if [[ -n "$failed_release" && -d "$failed_release" ]]; then
      switch_link "$failed_release" "$previous_link"
    fi
    if reload_backend && wait_for_health true; then
      echo "Rolled back to $stable_release."
      return 0
    fi
    echo "Rollback target did not pass the local health check." >&2
    return 1
  fi

  if [[ -L "$current_link" ]]; then
    unlink "$current_link"
  fi
  pm2 delete ai-campus-agent-backend >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
  echo "No previous release exists; removed the first failed release pointer." >&2
  return 1
}

case "$action" in
  deploy)
    if [[ -e "$current_link" && ! -L "$current_link" ]]; then
      echo "$current_link must be a symlink to the active release before CD is enabled." >&2
      exit 2
    fi
    active_release="$(readlink -f "$current_link" 2>/dev/null || true)"
    if [[ -L "$current_link" && ( -z "$active_release" || ! -d "$active_release" ) ]]; then
      echo "The current release link is broken; refusing to deploy." >&2
      exit 2
    fi
    if [[ -n "$active_release" && ! -f "$active_release/ecosystem.config.cjs" ]]; then
      echo "The active release must use ecosystem.config.cjs before CD is enabled." >&2
      exit 2
    fi
    if [[ ! -f "$base_dir/shared/server.env" ]]; then
      echo "Missing persistent server configuration: $base_dir/shared/server.env" >&2
      exit 2
    fi
    if [[ -z "$archive_path" || "$archive_path" != "/tmp/ai-campus-agent-$release_id.tar.gz" || ! -f "$archive_path" ]]; then
      echo "Deployment archive is missing or has an unexpected path." >&2
      exit 2
    fi
    trap 'rm -f -- "$archive_path"' EXIT
    if [[ -e "$release_dir" ]]; then
      echo "Release directory already exists: $release_dir" >&2
      exit 2
    fi

    mkdir -p "$base_dir/releases" "$base_dir/shared/data" "$base_dir/shared/logs"
    mkdir "$release_dir"
    echo "Extracting release archive to $release_dir."
    tar -xzf "$archive_path" -C "$release_dir"

    [[ -f "$release_dir/package.json" && -f "$release_dir/server/index.mjs" ]] || {
      echo "Deployment archive does not contain the application." >&2
      exit 2
    }

    if [[ -d "$release_dir/server/data" ]]; then
      cp -a "$release_dir/server/data/." "$base_dir/shared/data/"
      mv "$release_dir/server/data" "$release_dir/server/data.package"
      ln -s "$base_dir/shared/data" "$release_dir/server/data"
    fi
    if [[ -d "$release_dir/server/logs" ]]; then
      cp -a "$release_dir/server/logs/." "$base_dir/shared/logs/"
      mv "$release_dir/server/logs" "$release_dir/server/logs.package"
    fi
    mkdir -p "$release_dir/server"
    ln -s "$base_dir/shared/logs" "$release_dir/server/logs"
    ln -s "$base_dir/shared/server.env" "$release_dir/server/.env"

    cd "$release_dir"
    echo "Installing production dependencies."
    npm ci --omit=dev

    echo "Switching active release and reloading the backend."
    if [[ -n "$active_release" ]]; then
      switch_link "$active_release" "$previous_link"
    fi
    switch_link "$release_dir" "$current_link"

    echo "Waiting for local health check at $health_url."
    if ! reload_backend || ! wait_for_health; then
      echo "New release failed its local health check; restoring the previous release." >&2
      rollback_current || true
      exit 1
    fi
    echo "Deployed $release_id and passed $health_url."
    ;;

  rollback)
    active_release="$(readlink -f "$current_link" 2>/dev/null || true)"
    if [[ "$active_release" != "$release_dir" ]]; then
      echo "The requested release is not active; no rollback is needed."
      exit 0
    fi
    rollback_current
    ;;

  *)
    echo "Usage: deploy-remote.sh {deploy|rollback} DEPLOY_PATH RELEASE_ID APP_PORT [ARCHIVE_PATH]" >&2
    exit 2
    ;;
esac
