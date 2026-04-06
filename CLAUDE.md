## Session Resume Protocol
At the start of EVERY new session, before doing anything else:
1. Read the last 50 lines of `.claude/session-memory.md`
2. Read `.claude/CURRENT_TASK.md` if it exists
3. Tell me: what was last completed, what files were touched, what is next
4. Do NOT re-read source files unless the current step requires it

## Ongoing Memory Rule
After every major action (file edited, feature done, bug fixed) update `.claude/CURRENT_TASK.md` with:
- Last completed step
- Files modified
- Next step
- Any blockers or decisions pending

## Do NOT read these unless specifically asked
- node_modules/
- .next/
- package-lock.json
- dev.db
- tsconfig.tsbuildinfo
