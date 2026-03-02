# Critical Invariants and Guardrails

## Repo invariants

1. `git config --local --get core.worktree` must equal `<repo>/src`
2. `.clasp.json` must keep `"rootDir": "./src"`
3. `git ls-tree --name-only HEAD` must not contain tracked `src/` paths
4. Do not create duplicate MOTK source files outside `src/`

## Language invariants

1. New code comments: English only
2. New changelog content: English only
3. New commit messages: English only
4. New technical docs for AI/developers: English only

## Behavioral invariants

1. No silent fallback on critical data paths
2. No hidden default IDs for required routing/state
3. No quick hacks left behind once a stable path exists
4. The app must remain runnable at every commit

## Product invariants

1. `Scheduler` = edit mode
2. `SchedView` / `View Mode` = view-oriented schedule page
3. Publish remains meaningful
4. Taskless cards remain supported
5. `card_view_meta` is for published taskless view state, not casual live edit persistence

## Working-method invariants

1. Read TAKE00 before each feature session
2. Declare TAKE00 active in first assistant message
3. Verify repo truth before editing
4. Each TAKE requires:
- changelog file
- `clasp push`
- named `clasp deploy`
- git commit
- git push

## Anti-patterns to avoid

1. Changing `.clasp.json` casually
2. Reintroducing tracked `src/` entries in remote Git tree
3. Moving MOTK source outside `src/`
4. Making SchedView read live edit scratch state
5. Treating Publish as optional noise
