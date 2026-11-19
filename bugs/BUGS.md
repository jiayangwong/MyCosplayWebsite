# Bug log

<!-- One entry per bug: BUG-<n>, date, linked task, severity (critical/major/minor), steps to reproduce, expected, actual, status (open/fixed/verified). -->

## BUG: task-9 accessibility test failed once on desktop (flaky)
- Severity: minor (test only)
- Linked task: TASK-9 (seen during the site-v1 full run after merging TASK-10)
- Found: 2026-11-19 by the main session
- What happened: the full suite on site-v1 (5442abf) had 93 passed, 1 failed, 2 skipped. The failure was `[desktop] tests/task-9.spec.js:23 no images without alt, no unnamed buttons, no skipped heading levels`. Re-running tests/task-9.spec.js on desktop with --repeat-each 3 passed 12/12, so it is intermittent. The error text was not captured.
- Status: fixed
- Cause: tests that did not block Google Fonts waited on fonts.googleapis.com / fonts.gstatic.com over the real network, which stalled `load` / `networkidle` under full-suite load; the default worker count (half the CPUs) on WSL added to the load.
- Fix: playwright.config.js now starts Chromium with `--host-resolver-rules` that make both Google Fonts hosts fail DNS at once, for every test in both projects (no spec edits; page.route mocks such as tests/github-mock.js are unaffected). `workers` capped at 4 (2 on CI), `retries: 0`. Verified with 3 full-suite runs in a row: 137 passed, 3 skipped, 0 failed each (3.1m, 3.4m, 2.4m).

## BUG-1: Admin page scrolls sideways at 375px (header "View site" button runs off screen)
- Found by: QA
- Task: TASK-6 (found while testing TASK-11; the header is unchanged by TASK-11, the GitHub panel itself fits)
- Severity: minor
- Steps to reproduce: 1. Open /admin/index.html at a 375px wide viewport. 2. Check `document.documentElement.scrollWidth`.
- Expected: no horizontal scroll (scrollWidth 375).
- Actual: scrollWidth is 393. The `View site` link in `.site-header-inner` ends at x=393, because the PUZZ KEZZ wordmark plus the EVENT MANAGER badge leave too little room.
- Status: fixed
- Cause: the wordmark (nowrap) plus the inline EVENT MANAGER badge and the View site button need more than 375px on one row.
- Fix: css/admin.css - below 480px the badge drops under the wordmark (display block, margin var(--space-1)), so the header stays one row with View site on screen like the storyboard. New test in tests/task-6.spec.js checks scrollWidth <= clientWidth and the button edge at 375px.

## BUG-2: Several older tests failed under full-suite load on TASK-11 QA run (flaky)
- Found by: QA
- Task: TASK-1, TASK-6, TASK-9, TASK-10, TASK-11 (tests only)
- Severity: minor (test only)
- Steps to reproduce: 1. Run the whole suite with default workers (5.9 min, heavy load). 2. 5 desktop tests fail: task-1.spec.js:81 (no horizontal scroll), task-6.spec.js:52, task-9.spec.js:5, task-10.spec.js:200, task-11.spec.js:174.
- Expected: pass.
- Actual: timeouts / detached frame / attribute not set in time. All five pass when re-run with --workers=2. The product code is not at fault. The tests that do not block Google Fonts are the likely cause.
- Status: fixed
- Cause: tests that did not block Google Fonts waited on fonts.googleapis.com / fonts.gstatic.com over the real network, which stalled `load` / `networkidle` under full-suite load; the default worker count (half the CPUs) on WSL added to the load.
- Fix: playwright.config.js now starts Chromium with `--host-resolver-rules` that make both Google Fonts hosts fail DNS at once, for every test in both projects (no spec edits; page.route mocks such as tests/github-mock.js are unaffected). `workers` capped at 4 (2 on CI), `retries: 0`. Verified with 3 full-suite runs in a row: 137 passed, 3 skipped, 0 failed each (3.1m, 3.4m, 2.4m).
