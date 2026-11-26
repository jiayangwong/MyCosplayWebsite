# Team workflow

This project uses nine subagents in `.claude/agents/`. Route work like this:

1. User shares an idea -> **idea-collector** (writes docs/ideas.md)
2. Idea ready -> **planner** (writes docs/plan.md, waits for user approval)
3. Plan approved -> **designer** (writes docs/style-guide.md, waits for user approval)
4. Style approved -> **storyboard-creator** (builds storyboard/, waits for user approval in docs/approval.md)
5. Storyboard approved -> run this loop automatically for each task, without asking the user each time:
   - **programmer** builds the next todo task on its own branch
   - **reviewer** reviews it -> if changes requested, back to **programmer** -> re-review
   - **qa** tests it -> if bugs, **bugfixer** fixes them -> **qa** re-tests
   - when reviewed + QA passed -> **programmer** merges the branch into main
   - repeat until all tasks are done, then report to the user
6. All tasks done -> **release-manager** runs final checks and asks the user before deploying.
7. User reports a bug at any time -> **bugfixer** directly (then **qa** re-tests).

Flow: idea-collector -> planner -> designer -> storyboard-creator -> [programmer -> reviewer -> qa <-> bugfixer] -> release-manager

## Daily schedule (user decision 2026-11-23, window updated 2026-11-26)
- **programmer** works whenever the user gives tasks, and does not wait for review. It builds the next tasks and leaves them for review.
- **reviewer, qa, bugfixer, release-manager** only work between **19:30 and 08:00 (GMT+8)**: they rest by default, start at **19:30 GMT+8** every day, and only if something is pending for them. Outside that window they do not run. This replaces "run automatically" in step 5. A direct user request in chat overrides it.
- A push notification is sent when the programmer finishes a task group, and when each of these four roles starts.

## Gates
- Only the user can approve the plan, the style guide, the storyboard, and a deploy.
- Never start programmer, reviewer or qa unless docs/approval.md contains `STORYBOARD APPROVED`.
- New features or design changes found during coding go back to idea-collector / planner. They are not added mid-task.
- If the same task fails review or QA 3 times, stop the loop and ask the user.

## Definition of Done (a task)
- Meets every acceptance criterion in docs/plan.md
- Matches the approved storyboard and uses the style guide
- `Review: approved` (no open must-fix items)
- `QA: passed`, automated test for it in tests/ passing, earlier tests still passing
- No open critical/major bugs linked to it
- Branch merged into main, changelog entry added

## Definition of Done (a release)
- Every task in scope is Done
- release-manager checklist passed, version tagged, changelog written
- User said yes to deploy, and the live URL has been checked

## Shared files (the agents communicate through these)
- docs/ideas.md - ideas
- docs/plan.md - plan, tasks, status lines (Review / QA)
- docs/style-guide.md - visual rules and CSS variables
- docs/approval.md - storyboard approval
- docs/reviews.md - code review results
- docs/changelog.md - changes and release notes
- storyboard/ - clickable prototype
- tests/ - automated Playwright tests
- bugs/BUGS.md - bug log
