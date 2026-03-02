# AI Handoff Package

Purpose: transfer full working context from the current machine/session to the next Codex instance with minimal ambiguity.

Read order:
1. `00_READ_FIRST.md`
2. `05_CRITICAL_INVARIANTS_AND_GUARDRAILS.md`
3. `01_OPERATOR_MODEL_AND_USER_PROTOCOL.md`
4. `02_PROJECT_TIMELINE_AND_OPEN_MILESTONES.md`
5. `03_MODULE_OBJECT_INTENT.md`
6. `04_FOUNDATIONAL_MENTAL_MODEL.md`
7. `06_NEXT_SESSION_START_CHECKLIST.md`
8. `07_NEW_MACHINE_GIT_AND_CLASP_RECOVERY.md`

Current source of truth:
- Local physical workspace: `src/`
- `.clasp.json`: `rootDir = ./src`
- Git local worktree binding: repo root Git dir + `core.worktree = <repo>/src`
- Remote Git tracked MOTK files appear at repository root, not under `src/`

Non-negotiable docs already in repo:
- `change_log/2025-12-21_000_TAKE00_Agent-Operating-Procedure.md`
- `DEVELOPER_CODING_RULES.md`

This package is AI-facing, not user-facing. It intentionally prioritizes precision over readability.
