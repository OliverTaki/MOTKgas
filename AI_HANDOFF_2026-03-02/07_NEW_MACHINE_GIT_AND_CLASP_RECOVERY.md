# New Machine Git and `clasp` Recovery Guide

Purpose: make the next machine reproducible without guessing which system is authoritative at a given moment.

## Authority model

There are two different authorities and they must not be confused.

1. Git authority
- `origin/main` is the source of truth for repository content.
- Before local edits, sync from `origin/main`.

2. Apps Script authority
- The authoritative GAS state is whatever source was most recently and intentionally pushed with `clasp`.
- If another machine performed the latest correct `clasp push`, that machine's source is the current GAS truth until Git and GAS are reconciled again.

Operational rule:
- Never assume that Git truth and GAS truth are identical without checking.

## Local structure invariants

These must be restored first on any new machine.

### Expected repo facts

- Repo root: `.../MOTKgas063`
- Physical source workspace: `.../MOTKgas063/src`
- `.clasp.json` must contain:
  - `"rootDir": "./src"`
- Git local worktree must point to:
  - `.../MOTKgas063/src`
- Remote tracked MOTK files must appear at repo root, not under a tracked `src/` directory

## First-time validation commands

Run these exactly and inspect the outputs.

```bash
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 config --local --get core.worktree
cat /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063/.clasp.json
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 ls-tree --name-only HEAD | sed -n '1,40p'
```

Expected:
- `core.worktree` = `/Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063/src`
- `.clasp.json` shows `rootDir: ./src`
- `git ls-tree` shows MOTK source files at root (`1SA_*.js`, `2SV_*.js`, `3CL_*.html`, `appsscript.json`), not `src/...`

## Normal startup sequence on a new machine

### Step 1: sync Git truth

```bash
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 fetch origin
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 pull --rebase origin main
```

Use this before feature work.

### Step 2: verify `clasp`

```bash
cd /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063
clasp status
```

If `clasp` is not authenticated, re-login on that machine.

### Step 3: decide whether Git and GAS are already aligned

Questions:
1. Was the latest correct code change already pushed to GAS from another machine?
2. Was that same change also committed and pushed to `origin/main`?

Cases:
- If both yes: do nothing special; proceed.
- If Git is newer than GAS: `clasp push` from this machine is appropriate.
- If GAS is newer than Git because another machine pushed first: do not blindly `clasp push` from stale local code.

## Safe `clasp` decision table

### Case A: Git is confirmed latest and should become GAS
Use:

```bash
cd /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063
clasp push
```

### Case B: Another machine already pushed the intended GAS state
Use this logic:
- first get that state into Git if possible
- then sync this machine from Git
- only then run `clasp push` if needed

Do not overwrite GAS from an older local checkout.

### Case C: Unclear which side is newer
Stop and compare before any `clasp push`.

## Common failure modes and fixes

### 1. `git` looks correct but files physically appear outside `src`
Meaning:
- repo structure drift or duplicate source files were introduced

Fix:
- restore the invariant that MOTK source exists physically under `src/`
- remove duplicate MOTK source files outside `src/`
- do not change `.clasp.json` to compensate

### 2. `git ls-tree HEAD` shows `src/...`
Meaning:
- remote tracked structure drifted and is wrong for this repo policy

Fix:
- stop feature work
- restore tracked tree to root-file layout
- keep local physical `src/` workspace intact

### 3. `clasp push` from this machine seems to overwrite newer GAS work
Meaning:
- local code was not actually the latest intended GAS truth

Fix:
- re-establish the latest intended source from the machine that pushed correctly
- get that state into Git
- pull it here
- then push again only if necessary

### 4. `clasp` auth fails on new machine
Typical fix path:

```bash
cd /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063
clasp login
clasp status
```

If the script ID is wrong, inspect `.clasp.json` but do not edit it unless the user explicitly requests configuration repair.

### 5. `git status` looks clean but `origin/main` is ahead
Always check explicitly:

```bash
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 fetch origin
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 rev-list --left-right --count main...origin/main
```

Interpretation:
- `0 0` = aligned
- `0 N` = remote ahead
- `N 0` = local ahead
- `N M` = diverged

## Recommended pre-edit guard on every machine

```bash
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 fetch origin && \
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 rev-list --left-right --count main...origin/main && \
git -C /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063 config --local --get core.worktree && \
cat /Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063/.clasp.json
```

If any result is unexpected, stop and repair structure/truth alignment first.

## What not to do

1. Do not change `.clasp.json` just because the new machine is confused.
2. Do not move source files outside `src/`.
3. Do not assume `clasp push` is harmless.
4. Do not assume GAS is newer than Git or vice versa without checking.
5. Do not fix repo drift by introducing tracked `src/` paths in remote Git.

## Practical summary

Short version:
- Git truth: `origin/main`
- GAS truth: last intentional `clasp push`
- Before pushing anything, know which one is supposed to win
- Repo structure invariants are mandatory and come before feature work
