#!/usr/bin/env bash
set -euo pipefail

GIT_DIR="$(git rev-parse --absolute-git-dir)"
REPO_ROOT="$(cd "${GIT_DIR}/.." && pwd)"
WORKTREE_ROOT="$(git rev-parse --show-toplevel)"
EXPECTED_WORKTREE="${REPO_ROOT}/src"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

warn() {
  echo "[WARN] $1"
}

ok() {
  echo "[OK] $1"
}

check_clasp_rootdir() {
  local clasp_file="${REPO_ROOT}/.clasp.json"
  [[ -f "${clasp_file}" ]] || fail ".clasp.json not found at repo root."
  if ! grep -Eq '"rootDir"[[:space:]]*:[[:space:]]*"\./src"' "${clasp_file}"; then
    fail ".clasp.json rootDir must stay \"./src\"."
  fi
  ok ".clasp.json rootDir is ./src"
}

check_worktree_binding() {
  local actual
  actual="$(git config --get core.worktree || true)"
  [[ -n "${actual}" ]] || fail "core.worktree is not set."
  if [[ "${actual}" != "${EXPECTED_WORKTREE}" ]]; then
    fail "core.worktree mismatch. expected=${EXPECTED_WORKTREE} actual=${actual}"
  fi
  ok "core.worktree is bound to ${EXPECTED_WORKTREE}"
}

check_local_layout() {
  local root_count src_count
  root_count="$(find "${REPO_ROOT}" -maxdepth 1 -type f \( -name '1SA_*' -o -name '2SV_*' -o -name '3CL_*' -o -name 'appsscript.json' \) | wc -l | tr -d ' ')"
  src_count="$(find "${REPO_ROOT}/src" -maxdepth 1 -type f \( -name '1SA_*' -o -name '2SV_*' -o -name '3CL_*' -o -name 'appsscript.json' \) | wc -l | tr -d ' ')"
  [[ "${root_count}" == "0" ]] || fail "MOTK files must not exist physically at repo root (found ${root_count})."
  [[ "${src_count}" -gt 0 ]] || fail "No MOTK files found under src/."
  ok "local physical layout is correct (root=0, src=${src_count})"
}

check_git_tracking_layout() {
  local tracked_root tracked_src
  tracked_root="$(git ls-files | grep -Ec '^(1SA_|2SV_|3CL_).+|^appsscript\.json$' || true)"
  tracked_src="$(git ls-files | grep -Ec '^src/(1SA_|2SV_|3CL_|appsscript\.json)$' || true)"
  [[ "${tracked_root}" -ge 18 ]] || fail "Git must track MOTK root files (expected at least 18, actual=${tracked_root})."
  [[ "${tracked_src}" == "0" ]] || fail "Git must not track MOTK files at src/* paths."
  ok "git tracking layout is correct (root-tracked=${tracked_root}, src-tracked=0)"
}

check_exclude_file() {
  local ex="${REPO_ROOT}/.git/info/exclude"
  if [[ -f "${ex}" ]] && grep -Eq '^src/$' "${ex}"; then
    fail ".git/info/exclude contains 'src/' and breaks tracking."
  fi
  ok ".git/info/exclude does not block src/"
}

main() {
  [[ "${WORKTREE_ROOT}" == "${EXPECTED_WORKTREE}" ]] || fail "show-toplevel must resolve to ${EXPECTED_WORKTREE}. actual=${WORKTREE_ROOT}"
  ok "git show-toplevel resolves to ${WORKTREE_ROOT}"
  check_clasp_rootdir
  check_worktree_binding
  check_local_layout
  check_git_tracking_layout
  check_exclude_file
  warn "Repo-flow guard passed. Safe to proceed."
}

main "$@"
