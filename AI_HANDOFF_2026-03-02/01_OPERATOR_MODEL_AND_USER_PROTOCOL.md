# Operator Model and User Protocol

## User profile

The user is highly iterative, visually driven, and remembers product intent better than exact prior wording. They often refine requirements midstream and expect the AI to preserve the newest agreed meaning, not older assumptions.

## How to work with this user

1. Be direct.
- No cheerleading.
- No generic reassurance.
- Explain decisions in concrete engineering terms.

2. Preserve latest agreement over stale notes.
- Old docs may be partially obsolete.
- The latest explicit user correction is authoritative.

3. Do not improvise repo structure.
- The user is extremely sensitive to repo/layout drift.
- If repo truth is wrong, stop feature work and restore structure first.

4. Do not silently reinterpret naming.
- Prefix meanings are fixed:
  - `1SA` = Standalone
  - `2SV` = Server
  - `3CL` = Client

5. Use English in code, comments, commits, changelog additions, and technical docs.
- This rule is explicit and important.
- Legacy Japanese exists in old files; do not extend it.

6. The user values product behavior over architectural purity.
- Proposals that degrade usability for theoretical cleanliness will be rejected.
- Examples already rejected in principle:
  - replacing Sheets with external DB due to cost/operational burden
  - replacing immediate-save UX with manual commit-only UX
  - collapsing taskless cards into tasks just to simplify code

7. Publish is meaningful and must remain meaningful.
- Do not collapse the model into "View just reads current edit state".
- Publish is a deliberate boundary with business meaning.

8. The user often says "continue" after giving direction.
- Treat that as authorization to implement, not as a request for more discussion.

9. If a prior AI caused confusion, the user may react sharply.
- Do not defend the old mistake.
- State current truth and fix it.

## Communication shortcuts that work well

Preferred style:
- "Current truth is X. Next I will do Y. Risk is Z."
- "This is structural, not cosmetic."
- "This keeps behavior unchanged while reducing failure surface."

Avoid:
- speculative optimism
- vague summaries without exact file/behavior references
- "maybe" when the code can be checked

## User-specific product semantics

1. `Scheduler` means edit scheduler.
2. `SchedView` or `View Mode` means the view-oriented schedule page.
3. `view` should default to `View Mode`, not an arbitrary saved layout meaning, unless the context explicitly says otherwise.
4. The user cares deeply about edit/view separation, but not at the cost of losing practical workflow affordances.

## Working assumptions for future sessions

- The user likely expects the AI to remember prior verbal agreements from docs in this repo, not from model memory.
- If uncertain, search changelog and recent docs before asking basic questions.
- If the user says a requirement was already decided, assume they are probably right and verify locally.
