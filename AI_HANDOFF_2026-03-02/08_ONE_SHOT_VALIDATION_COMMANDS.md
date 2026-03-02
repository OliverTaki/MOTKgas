# One-Shot Validation Commands for a New Machine

Purpose: run a single compact validation sequence after moving to a new machine.

## Use this when

- Git works but you do not trust repo truth yet
- `clasp` may or may not be authenticated
- you need to know whether Git, local layout, and deploy routing are aligned before feature work

## One-shot shell block

Run this block as-is:

```bash
REPO="/Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063"

echo "== A. Fetch remote =="
git -C "$REPO" fetch origin || exit 1

echo "== B. Branch sync status =="
git -C "$REPO" rev-list --left-right --count main...origin/main || exit 1

echo "== C. Worktree truth =="
git -C "$REPO" config --local --get core.worktree || exit 1

echo "== D. .clasp.json =="
cat "$REPO/.clasp.json" || exit 1

echo "== E. Tracked tree sample =="
git -C "$REPO" ls-tree --name-only HEAD | sed -n '1,40p' || exit 1

echo "== F. Local status =="
git -C "$REPO" status --short --branch || exit 1

echo "== G. clasp status =="
cd "$REPO" && clasp status || exit 1
```

## Expected outputs

### Branch sync

`git rev-list --left-right --count main...origin/main`

Interpretation:
- `0 0` = local Git aligned with remote Git
- `0 N` = remote ahead, pull first
- `N 0` = local ahead, inspect before push
- `N M` = diverged, stop and reconcile

### Worktree truth

Expected exact result:

```bash
/Users/horikawa.daisuke/Desktop/MOTK/MOTKgas063/src
```

### `.clasp.json`

Expected:

```json
{
  "scriptId": "...",
  "rootDir": "./src"
}
```

The `scriptId` can vary only if the project intentionally changed. The important invariant is `rootDir: ./src`.

### Tracked tree sample

Expected characteristics:
- root MOTK files visible directly in the tree (`1SA_*.js`, `2SV_*.js`, `3CL_*.html`, `appsscript.json`)
- no tracked `src/...` paths
- handoff docs may appear as root-level tracked entries because Git worktree is bound to `src/`

### `clasp status`

Expected:
- authenticated session works
- file set is readable
- no obvious configuration error

## If any step fails

### If fetch fails
- network or Git auth issue; fix that before anything else

### If branch sync is not `0 0`
- do not run `clasp push` yet
- reconcile Git first

### If `core.worktree` is wrong
- stop feature work
- restore the repo truth model before touching files

### If `.clasp.json` does not show `./src`
- stop
- do not edit it casually
- treat this as a configuration repair task

### If tracked tree shows `src/...`
- remote Git structure drifted
- stop and repair structure first

### If `clasp status` fails
- re-authenticate `clasp`
- do not assume deploy routing is safe until it passes

## Optional second-stage app validation

After the shell block passes, manually validate these URLs/pages:

1. Settings
2. Debug Panel
3. Scheduler
4. SchedView
5. pNav `Schedule` opening SchedView in a new tab

## Decision rule after the check

Only when all of the following are true should feature work begin:
- branch sync is acceptable
- `core.worktree` is correct
- `.clasp.json` is correct
- tracked tree shape is correct
- `clasp status` passes

If not, do repair work only.
