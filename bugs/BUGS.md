# Bug log

<!-- One entry per bug: BUG-<n>, date, linked task, severity (critical/major/minor), steps to reproduce, expected, actual, status (open/fixed/verified). -->

## BUG: task-9 accessibility test failed once on desktop (flaky)
- Severity: minor (test only)
- Linked task: TASK-9 (seen during the site-v1 full run after merging TASK-10)
- Found: 2026-11-19 by the main session
- What happened: the full suite on site-v1 (5442abf) had 93 passed, 1 failed, 2 skipped. The failure was `[desktop] tests/task-9.spec.js:23 no images without alt, no unnamed buttons, no skipped heading levels`. Re-running tests/task-9.spec.js on desktop with --repeat-each 3 passed 12/12, so it is intermittent. The error text was not captured.
- Status: verified (QA 2026-11-19: 2 full runs on 0732ddb, 137 passed, 3 skipped, 0 failed each)
- Cause: tests that did not block Google Fonts waited on fonts.googleapis.com / fonts.gstatic.com over the real network, which stalled `load` / `networkidle` under full-suite load; the default worker count (half the CPUs) on WSL added to the load.
- Fix: playwright.config.js now starts Chromium with `--host-resolver-rules` that make both Google Fonts hosts fail DNS at once, for every test in both projects (no spec edits; page.route mocks such as tests/github-mock.js are unaffected). `workers` capped at 4 (2 on CI), `retries: 0`. Verified with 3 full-suite runs in a row: 137 passed, 3 skipped, 0 failed each (3.1m, 3.4m, 2.4m).

## BUG-1: Admin page scrolls sideways at 375px (header "View site" button runs off screen)
- Found by: QA
- Task: TASK-6 (found while testing TASK-11; the header is unchanged by TASK-11, the GitHub panel itself fits)
- Severity: minor
- Steps to reproduce: 1. Open /admin/index.html at a 375px wide viewport. 2. Check `document.documentElement.scrollWidth`.
- Expected: no horizontal scroll (scrollWidth 375).
- Actual: scrollWidth is 393. The `View site` link in `.site-header-inner` ends at x=393, because the PUZZ KEZZ wordmark plus the EVENT MANAGER badge leave too little room.
- Status: verified (QA 2026-11-19: 2 full runs on 0732ddb, 137 passed, 3 skipped, 0 failed each)
- Cause: the wordmark (nowrap) plus the inline EVENT MANAGER badge and the View site button need more than 375px on one row.
- Fix: css/admin.css - below 480px the badge drops under the wordmark (display block, margin var(--space-1)), so the header stays one row with View site on screen like the storyboard. New test in tests/task-6.spec.js checks scrollWidth <= clientWidth and the button edge at 375px.

## BUG-2: Several older tests failed under full-suite load on TASK-11 QA run (flaky)
- Found by: QA
- Task: TASK-1, TASK-6, TASK-9, TASK-10, TASK-11 (tests only)
- Severity: minor (test only)
- Steps to reproduce: 1. Run the whole suite with default workers (5.9 min, heavy load). 2. 5 desktop tests fail: task-1.spec.js:81 (no horizontal scroll), task-6.spec.js:52, task-9.spec.js:5, task-10.spec.js:200, task-11.spec.js:174.
- Expected: pass.
- Actual: timeouts / detached frame / attribute not set in time. All five pass when re-run with --workers=2. The product code is not at fault. The tests that do not block Google Fonts are the likely cause.
- Status: verified (QA 2026-11-19: 2 full runs on 0732ddb, 137 passed, 3 skipped, 0 failed each)
- Cause: tests that did not block Google Fonts waited on fonts.googleapis.com / fonts.gstatic.com over the real network, which stalled `load` / `networkidle` under full-suite load; the default worker count (half the CPUs) on WSL added to the load.
- Fix: playwright.config.js now starts Chromium with `--host-resolver-rules` that make both Google Fonts hosts fail DNS at once, for every test in both projects (no spec edits; page.route mocks such as tests/github-mock.js are unaffected). `workers` capped at 4 (2 on CI), `retries: 0`. Verified with 3 full-suite runs in a row: 137 passed, 3 skipped, 0 failed each (3.1m, 3.4m, 2.4m).

## BUG-3: TASK-12 tests miss under load (double-click "Step 1 of 7" wait, addEvent "Saved" wait) (flaky)
- Found by: QA
- Task: TASK-12 (tests only; also seen once in tests/task-10.spec.js:103 under the same load)
- Severity: minor (test only)
- Steps to reproduce: 1. Run `npx playwright test` while the machine is busy (other sessions running Playwright). 2. The "double-clicking Publish" test (tests/task-12.spec.js:474, delay at :463) waits for `Step 1 of 7`, which shows only during a 600ms delay, so it can miss. Also seen once: `[phone] task-12.spec.js:71` timed out in `addEvent` waiting 5s for "Saved PUB", and `[desktop] task-10.spec.js:103` timed out on the full-size swap.
- Expected: pass every time.
- Actual: intermittent timeout. Each passed on immediate re-run (task-12:71 phone 8/8, task-10:103 desktop 5/5). The product behaves correctly (QA checked the double-click and lock behaviour by hand).
- Status: verified (QA 2026-11-19: task-10/11/12 --repeat-each=3 261 passed 3 skipped 0 failed; full suite 189 passed 3 skipped 0 failed; mock still strict; 10 of 10 real phone taps on Save event and Publish worked with smooth scrolling)
- Cause: (1) the lock/busy checks raced fixed mock delays (600ms Publish, and the same pattern in the Discard lock test's 1200ms and task-11's 400ms "Testing..."), so under load the request finished before the checks ran; (2) `addEvent` lost its Save click: on the phone layout the page smooth-scrolls (`scroll-behavior: smooth`) to the far-down Save button, and under load mouse-up landed after the scroll moved it (Save stayed focused, no submit, status empty for 30s) - a race, not slowness; (3) the task-10 full-size swap (fetch + decode a 2400x1600 PNG, cross-fade, then src swap) can take over the default 5s under load. No product bug.
- Fix: tests/github-mock.js - new strict `github.hold(match)` that keeps one matching request open until the test calls `release()` (`arrived` resolves when it reaches the mock; an unreleased hold fails the test). tests/task-12.spec.js - double-click Publish and Discard-lock tests hold the GitHub read until the locked state (and the forced click) is checked, then release; `addEvent` uses the keyboard (Enter on New event, Enter in the name field) and the 15s result wait. tests/task-11.spec.js - Test connection holds the request until "Testing..." is checked. tests/task-10.spec.js - the swap wait after release() is 15s. Runs: task-12 + task-10 --repeat-each=3: 198 passed, 0 failed; full suite twice: 189 passed, 3 skipped, 0 failed each (4.3m, 4.6m).

## BUG-4: A reload loses the pending site photo but keeps the draft choice (Publish can send a portrait path with no file)
- Found by: QA
- Task: TASK-14
- Severity: minor (already noted by the reviewer as a nice-to-have)
- Steps to reproduce: 1. In /admin/ Site photos, make a Portrait and click "Use for Portrait". 2. Reload the page. 3. Look at the Publish panel.
- Expected: the pending list and the draft agree (either the photo is still pending, or the draft choice is reset).
- Actual: the pending file is gone (in memory only), but `puzzkezz.site.draft` still has `portrait: "media/site/portrait.webp"`. The Publish panel shows "~ data/site.json changed" and the Publish button is enabled, so a publish would point `data/site.json` at a file that is not in the repo (the public page then falls back to the placeholder). Not reproduced: "a pending share image survives Discard" was not separately checked.
- Status: verified (TASK-16, QA 2026-11-19: repro by hand now stops with the message naming media/site/portrait.webp, no write)
- Fix: Publish now checks the `portrait` in the data/site.json and every reel `thumb` in the data/reels.json of the commit against the repo tree (after the tree read, before the removal dialog and any write; also on Try again). A path that is neither a file on GitHub nor a file of this publish stops the publish with "Portrait points at a photo that is not on GitHub and not in this publish: media/site/portrait.webp." (reels: "Reel cover <kana> (<id>) ..."), with no POST or PATCH (`brokenSitePhotoLinks` in js/admin/publish.js). Repro test: tests/task-16.spec.js "BUG-4 repro" (Use for Portrait, reload, Publish).

## BUG-5: Undoing an attach on a published SAMPLE event does not bring back its "Sample" tag
- Found by: QA
- Task: TASK-16
- Severity: minor (known nice-to-have from the reviewer; reproduced)
- Steps to reproduce: 1. Published event X has `sample: true` (all 8 live events do). 2. In /admin/ attach a new photo pair to X (this drops `sample` from the draft). 3. Press "Remove from publish" on the pair.
- Expected: X is back to what is live, including its SAMPLE tag; the button reads "Nothing to publish".
- Actual: the note says "Photo for CF 2026 set back to the published photo." and the photo is back, but the event row no longer shows "SAMPLE" and the Publish button stays enabled ("Publish to GitHub"). The next publish drops `sample` from the live event.
- Status: verified (QA 2026-11-19)
- Cause: `revertPhoto` only put back `photo` / `photoFull`; the `sample` flag that `attachPhoto` deletes was never restored from the published events.json.
- Fix: `revertPair` (js/admin/publish.js) passes the published event's `sample` value (looked up in the same base events.json as the photo, both the "published photo" and "no published photo" branches) and `revertPhoto` (js/admin/manager.js) sets it back. Tests in tests/task-16.spec.js.

## BUG-6: "Remove from publish" overwrites an unsaved typed photo path in the open form
- Found by: QA
- Task: TASK-16
- Severity: minor (known nice-to-have from the reviewer; reproduced)
- Steps to reproduce: 1. Attach a pair to published event X (form open). 2. Type another path into Display photo without saving. 3. Press "Remove from publish".
- Expected: the unsaved typed path is kept (or at least the user is warned).
- Actual: the draft matched the pair so it is reverted, and the form field is replaced by the published path; the typed text is lost. The note is shown.
- Status: verified (QA 2026-11-19). Note: if the user then saves the form, the typed path is saved with the pair's old full-size path (file no longer pending), and the Sample tag is not restored; Publish then stops with the TASK-16 "not on GitHub" message, no write. Safe, minor.
- Cause: `revertPhoto` always wrote the reverted paths into the open form's Display / Full-size photo fields, whatever they held.
- Fix: `revertPair` passes the pair's own paths; `revertPhoto` only updates the form fields (and preview) while both still hold exactly those paths. Otherwise the typed text is left alone and the saved draft is still set back (the note is shown as before). Files: js/admin/manager.js, js/admin/publish.js; test in tests/task-16.spec.js.

## BUG-7: /admin/ Publish targets branch `main`, but GitHub Pages serves `site-v1`
- Found by: release-manager (release check for v1.0.0, 2026-11-19)
- Task: TASK-11, TASK-12
- Severity: major (release blocker)
- Steps to reproduce: 1. Open js/admin/github-config.js: `branch: 'main'`. 2. On origin the only branch is `site-v1` (the default branch, served by GitHub Pages). 3. In /admin/ with a real token press "Publish to GitHub".
- Expected: Publish reads `git/ref/heads/site-v1` and moves `refs/heads/site-v1`, so the live site updates; Test connection says "(site-v1)".
- Actual: Publish reads `git/ref/heads/main`, which does not exist on origin (404), so it fails; if a `main` branch existed, the commit would go to a branch the live site does not serve. Discard / Test connection also read `?ref=main`.
- Status: verified
- Cause: the publish branch in js/admin/github-config.js was set to `main` while the repo's default and Pages branch is `site-v1`; the tests hard-coded `main` too, so they could not catch it.
- Fix: js/admin/github-config.js now has `branch: 'site-v1'` with a comment that it must match the branch GitHub Pages serves (all API paths and the UI text already read `GITHUB.branch`). tests/github-mock.js reads the branch from that config file and exports `BRANCH`; tests/task-11..16 specs use `BRANCH` for `heads/...`, `ref=...` and the "Connected to ... (branch)" text, so they cannot drift again. Wording updated in docs/plan.md, docs/style-guide.md and storyboard/admin/index.html.
- QA re-test (2026-11-19): verified. Full publish (events + photo pair + portrait) only requested git/ref/heads/site-v1 and PATCH git/refs/heads/site-v1; "Connected to ... (site-v1)" and the Publish hint name site-v1; no heads/main or ref=main in js/admin/tests/storyboard; with the app set to main and the tests expecting site-v1, task-11/12 tests fail; full suite 359 passed, 3 skipped.

## BUG-8: 18 older admin/data tests still expect the old 8 sample events (fail since the 21 real events went in)
- Found by: programmer (full-suite runs while building TASK-21 / TASK-22, 2026-11-23, system Chrome)
- Task: TASK-2, TASK-6, TASK-10, TASK-11 (tests only); caused by the 2026-11-23 change "replaced sample events with the 21 real events"
- Severity: major (the full suite cannot pass, so no task can meet "earlier tests still passing")
- Steps to reproduce: on `task/TASK-20-events-hall-bangai` (and the TASK-21 / TASK-22 branches) run the full suite: `npx playwright test` (desktop + phone).
- Expected: the full suite passes.
- Actual: the same 9 tests fail in both projects (18 failures): tests/task-2.spec.js:6 "sample events.json follows the format" (expects `sample: true`), tests/task-6.spec.js:11, :23, :32, :53, :65, :74, tests/task-10.spec.js:202 and tests/task-11.spec.js:135. They count `.event-row` (expect 8 or 9, get 21 or 22) or look for the old SAMPLE events. The app itself is fine: data/events.json now holds the 21 real events with no `sample` flag.
- Also seen once under full-suite load (passed in the next full run and in 3 repeated runs on their own): tests/task-12.spec.js:266 (desktop) and tests/task-19.spec.js:295 (phone). Same kind of load flake as BUG-2 / BUG-3.
- Status: verified (QA 2026-11-23 19:30 run on site-v1 702876d, system Chrome: full suite 494 passed, 4 skipped; only task-19.spec.js:253 and qa-idea-12.spec.js:158 failed because this sandbox's proxy/DNS adds a Google Fonts console error; with fonts stubbed the task-19 test passes, qa-idea-12 passes with proxy bypassed)
- Cause: commit 8b057d5 replaced the 8 SAMPLE events in data/events.json with the 21 real events, but the tests read the real file (counts 8/9, Omatsuri first, `sample: true`). The load flakes are real test races: task-3 "first two polaroids load eagerly" read `.polaroid img` with `evaluateAll` (does not wait) right after `goto`, before the hall rendered; task-12 "Reload alone does not re-base" clicked Reload and then waited for `data-publish-ready="true"`, which the old page already had, so the next click could race the reload.
- Fix (tests only, no product code): the old 8 samples are kept as tests/fixtures/sample-events.json, exported from tests/helpers.js as `SAMPLE_EVENTS`. tests/task-6.spec.js mocks data/events.json with them in beforeEach (all checks unchanged: 8 rows, 9 after add, 7 after delete, sample flag removed on edit, export 8, import/discard). tests/task-10.spec.js:202 mocks them for that test (the new 2026-09-12 event must be first; with real data a 2026-11-07 event sorts above it). tests/task-11.spec.js:135 counts rows before adding and expects one more (works with any data). tests/task-2.spec.js: the old file check now runs on the fixture (8+ samples, 2024-2026, all `sample: true`), plus a new test that the real data/events.json has version 1, 8+ events across 2024-2026, unique ids, every event passing `validateEvent`, and no `sample` flag. Flakes: tests/task-3.spec.js waits for the 4 polaroid images before reading `loading`, and the reduced-motion test waits for the 4 stations before reading transforms (and checks it read 4, so an empty list cannot pass); tests/task-12.spec.js waits for the reloaded page's `load` event before the ready check.
- Not fixed here: tests/task-19.spec.js:295 is only on the TASK-19..22 branches (not touched). It calls `noHorizontalScroll` right after `goto`, before the hall / Hall ??? section has rendered, so the scroll check can run on an unfinished page. Suggested fix on that branch: wait for `#hall-bangai` (or the station count) to be visible before `noHorizontalScroll`. Also note tests/task-3.spec.js on TASK-22 expects 5 stations in the reduced-motion test; the merge of this branch will need that number kept at 5 there.
- How verified (system Chrome, /tmp/pwconf config): task-2/6/10/11 specs 57 passed, 1 skipped; task-6 + task-10:204 + task-11:135 --repeat-each=3 48 passed; task-3 + task-12:266 --repeat-each=3 54 passed; full suite twice: 369 passed, 3 skipped, 0 failed (5.7m, 5.8m).

## BUG-9: gallery.html renders an image without alt text (exists on site-v1, found during TASK-24 QA)
- Found by: QA
- Task: none (public Gallery, TASK-8 area; not caused by TASK-24, which only changes /admin/)
- Severity: major (accessibility: the missing alt breaks the "every image has alt" rule)
- Steps to reproduce: 1. Open gallery.html with the real data/events.json (22 events). 2. Run `document.images` filtered by `!hasAttribute('alt')`, or run tests/task-9.spec.js:23 and tests/qa-idea-12.spec.js:158.
- Expected: every img has an alt attribute (empty alt only for decorative images).
- Actual: one img has no alt attribute; both tests fail on site-v1 and on the TASK-24 branch (same result, both projects).
- Status: fixed
- Cause: js/gallery.js buildViewer() creates the viewer's main photo `<img class="lightbox-img v-img">` inside the closed dialog with no alt; alt was only set in show() when a photo is opened, so with any photo in the data the page had one alt-less img.
- Fix: the viewer img gets a default alt "Selected gallery photo" at creation (show() still replaces it with the photo's own "<event> <year>" alt). File: js/gallery.js. tests/task-9.spec.js:23 and tests/qa-idea-12.spec.js:158 pass (desktop + phone).

## BUG-10: stale public-page tests expect old data (21 events / empty Gallery) after the data now has 22 events with photos (site-v1, found during TASK-24 QA)
- Found by: QA
- Task: none (tests only; exists on site-v1)
- Severity: minor
- Steps to reproduce: run tests/qa-idea-12.spec.js:175 (expects "21 events") and tests/task-8.spec.js:5 (expects "Photos coming soon" when the real data now has photos).
- Expected: tests follow the real data (or mock their own events).
- Actual: both fail in desktop and phone on site-v1 and on the TASK-24 branch. The app is fine.
- Status: fixed
- Cause: the two tests read the real data/events.json but hard-coded its old state (21 events, no photos).
- Fix: tests/task-8.spec.js:5 now mocks its own photo-less events (mockEvents); tests/qa-idea-12.spec.js:175 gets the count from the real data through the app's own loadEvents() and checks "<count> events" instead of a fixed number. Tests only, no app change. Both pass desktop + phone.
