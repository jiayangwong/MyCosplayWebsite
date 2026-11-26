# Code reviews

<!-- The reviewer adds one section per task review: TASK-<n>, branch, date, result (approved / changes requested), must-fix and nice-to-have items. -->

## Review TASK-10 - 2026-11-18
Branch: `task-10-photo-viewer` (commit 1712a53, diff vs `site-v1`)
Result: CHANGES REQUESTED
- [must-fix] js/gallery.js:74-75 + :113 - Keyboard focus is lost when the focused Previous/Next button hides on the first/last photo. Verified: Tab to "Next photo", press Enter on the last-but-one photo -> `document.activeElement` is `<body>`, and ArrowLeft then does nothing because the arrow keys are only handled on the `<dialog>`. This breaks the style guide's "Left/Right arrows go to the previous/next photo" for keyboard and screen-reader users. Fix: in `show()`, if the button being hidden has focus, move focus to the other nav button when it is visible, or to Close otherwise. Optionally also handle arrows when focus is on body while the dialog is open. Add a test for it: Enter on Next until the last photo, then expect focus inside the dialog and ArrowLeft working.
- [must-fix] tests/task-10.spec.js:70-81 - The "never request photoFull before the viewer opens" test is flaky by design. It waits for `networkidle` on pages that load Google Fonts, and it does not block them. A slow or hanging fonts request stops `networkidle` and the test times out. This is the same problem that was already fixed in tests/task-9.spec.js:25-26. Fix: add `await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());` before the loop. (It passed 12/12 with --repeat-each 6 here, and the full suite passed 92 + 2 skips, so this is network-dependent, not logic-dependent.)
- [nice-to-have] js/events-data.js:59-64 - `photoPathError` meets the plan's literal rules, but some values still get through. `https:\\evil.com/x.webp` has no `://`, and `new URL()` turns `\` into `/` for http(s), so `siteUrl()` resolves it to an external host. Other schemes also pass, for example `data:` and `javascript:`. The risk is low because only the owner writes these values and they are used as `<img src>` only. Before TASK-13 (Publish deletes files under media/events/), consider also refusing any `scheme:` prefix (`/^[a-z][a-z0-9+.-]*:/i`) and backslashes.
- [nice-to-have] css/pages.css:126, :154, :168-169 - Hard-coded `rgba(...)` and `#FFFFFF`. The comments say which token each value comes from, but tokens would be safer: `color-mix(in srgb, var(--color-line) 30%, transparent)` and `var(--color-surface)`, or a new `--color-white` token.
- [nice-to-have] js/gallery.js:116-123 - When the master is shown, both `full` and `disp` hold the decoded full-size image. That is fine at this scale. If memory becomes a problem on phones, clear `full.src` after the swap.
- Ruling on the programmer's question: ACCEPTED. A failed `photoFull` shows the small "Full size unavailable" `role="status"` label with an aria-hidden icon, no `role="alert"` and no pop-up. This follows the approved storyboard (storyboard/gallery.html:32) and docs/style-guide.md ("If the master fails ... show mono 'Full size unavailable' ... no error pop-up"), which take priority over the plan's looser "no error shown" wording. The display copy stays, and that is tested.
- Checked and OK: validation rules and photoFull-needs-photo; admin labels and `aria-describedby`; empty fields omitted; export key order; import with or without photoFull; tiles, Hall and Events use `photo` only; no innerHTML (all text goes through `textContent` / `make()`); stale loads blocked by `token`; Close gets focus on open and focus returns to the tile on close; native `showModal()` makes the page inert, with no scroll behind it; the white focus ring token is used; the cross-fade uses `--dur-fast`, which is 0 under reduced motion; no secrets or local paths; scope limited to TASK-10 files.

## Review TASK-10 (round 2) - 2026-11-18
Branch: `task-10-photo-viewer` (commit eff0502)
Result: APPROVED
- Round-1 must-fix 1 (focus lost at the ends): fixed in js/gallery.js:74-81. If the focused Previous/Next button hides, focus moves to the other nav button, or to Close. New test "keyboard: focus stays in the viewer..." covers both ends and checks the arrow keys afterwards.
- Round-1 must-fix 2 (test depends on the network): fixed. tests/task-10.spec.js now aborts Google Fonts before `networkidle`, the same way task-9 does.
- Path check (round-1 nice-to-have, done): `photoPathError` now also refuses backslashes and any `scheme:` prefix (`/^[a-z][a-z0-9+.-]*:/i`). A colon later in the path, like `b:c.webp`, is still allowed. Tests cover `https:\\`, `data:`, `javascript:`, `http:evil.com` and the photoFull versions.
- Full suite re-run by the reviewer: 94 passed, 2 skipped (project skips), 0 failed.
- No new must-fix items. The round-1 colour-token and memory nice-to-haves are still open and do not block.

## Review TASK-7 - 2026-11-19
Branch: `task-7-lattice-watermark` (commit 541d0f8, diff vs `site-v1`)
Result: CHANGES REQUESTED
- [must-fix] js/admin/watermark.js:295-302, :354-360, :433 - Every card keeps its fully decoded `ImageBitmap` (`item.bitmap`) for as long as the page is open, so it can be re-rendered. A 24 MP photo is about 96 MB decoded, so a normal batch of 20-30 event photos holds 2-3 GB and will crash the tab. Only "Remove" frees it, and ready cards have no Remove button. Fix: call `item.bitmap.close()` and clear it once both files are encoded (also in the error path), and decode again from `item.file` when re-rendering. `processItem` already decodes when `bitmap` is missing, so the re-render loop only needs to stop using `item.bitmap` as its "readable" test (for example, use a flag set after the first successful decode). Add a test that `item.bitmap` is gone after processing and that a re-render still works.
- [nice-to-have] css/admin.css:207 - `rgba(207, 200, 218, 0.6)` is `--color-line` hard-coded, and the style guide says 30%, not 60%. Use `color-mix(in srgb, var(--color-line) 30%, transparent)`. Also, css/admin.css:193 uses an 11px chip font, but the guide's thumbnail labels are mono 12px (`var(--fs-small)`).
- [nice-to-have] js/admin/watermark.js:340-351 - For a new event that is not saved yet, the pending pair keeps the predicted id. If the date or short form changes before "Save event", the pair and the form paths still point at the old id. TASK-13 should re-check the pending pairs against the saved ids, or the uploader should re-key or drop the pair when `onEventChange` gives a different id.
- [nice-to-have] js/admin/watermark.js:151-157 - The master is drawn with a second full-size layer canvas, so peak memory is about twice the master. It is freed right away (`layer.canvas.width = 0`), so this is fine on desktop. Only worth changing if desktop crashes show up on very large originals.
- [nice-to-have] After Attach, the event preview asks for `media/events/<id>/<name>.webp`, which does not exist yet, and gets a 404 (seen in the test log). This is the existing TASK-10 preview behaviour. A later task could show the local blob until Publish.
- Rulings on the programmer's decisions:
  1. One composited layer at the chosen opacity, ink shadow off: ACCEPTED. The plan asks for "one layer opacity, so overlapping parts are not brighter", and the guide calls the shadow optional ("keep it off if the 40% white pixel test fails"). The storyboard's per-stroke `globalAlpha` is only a sketch.
  2. A per-card "Attach to selected event" button instead of the storyboard's dropdown + bulk button: ACCEPTED, no change needed. The approved plan names this exact button and says the target is the event in the editor form. A bulk "add all ready photos" does not fit "one photo per event". The "Files will be saved for event: ..." line plays the dropdown's role. The rest of the layout matches the storyboard: drop zone + controls grid, two-thumbnail card, chips, status line, paths, error card with Remove. The storyboard should be brought in line later (storyboard-creator), but this does not block.
  3. Re-attaching replaces the older pending pair for the same event: ACCEPTED. An event has one photo/photoFull, and the form only points at the newest pair.
  4. The leave-page warning stops once both files of every pending pair are downloaded: ACCEPTED. This is the plan's wording ("not published or downloaded"). A re-render resets `downloaded`, so new output warns again, which is correct.
  5. "Too large" applies to all iOS browsers: ACCEPTED. Every iOS/iPadOS browser uses WebKit and has the same canvas limit. The iPadOS desktop-UA check is right. Canvas-creation failure and a null `toBlob` also give the message on every platform.
  6. "Could not read this file" was added and the 400 KB message was not built: ACCEPTED. The read message comes from the style guide and storyboard. The 400 KB line is not in the plan's criteria, which take priority (display quality is fixed at 0.85, so the user could do nothing about it anyway).
  7. Re-render waits 200 ms after the last change, then does one card at a time: ACCEPTED. The work goes through the same serial queue, and `rerenderQueued` merges bursts.
  8. For an unsaved new event, Attach shows "Press Save event": ACCEPTED (see the nice-to-have above about the id changing).
- Checked and OK: `WM_DIVISOR` = 80 is exported and is the only place the number appears; `watermarkLayout` formula and ratios; lattice, hearts, text and line breaks match storyboard/wm.js (and long text drops the segment instead of drawing a negative line); master and display sizes, 16383 cap, no enlarging; WebP q 0.95 / 0.85; `-full` naming and -2/-3 de-duplication against the draft, the form and pending pairs; per-photo errors do not block other photos; the 25 MB rule disables Attach; downloads and Download all; Attach fills `#f-photo` / `#f-photo-full` and the draft. Safety: no network call with image data (the test checks this), only blob URLs of the outputs are used, EXIF is dropped by canvas re-encoding, and `createImageBitmap` applies the EXIF orientation first. No innerHTML anywhere: file names go through `textContent` / text nodes. Old blob URLs are revoked on re-render and on Remove. `fonts.load` waits for Space Mono with a 4 s cap. Accessibility: labelled inputs, `<output>` for opacity, `role="status"` / `role="alert"`, the bar is aria-hidden and stops under reduced motion, alt text on thumbnails, focus ring on the drop zone. Scope: only TASK-7 files (the `SITE.watermark` default is used only by the uploader).
- Tests: full suite 110 passed, 2 skipped (project skips), 0 failed. task-1/9/10 run with `--repeat-each=3`: 96 passed, 6 skipped, 0 failed. TASK-7 does not cause the flakiness. It changes no public page and no task-1/9/10 file. tests/task-7.spec.js aborts Google Fonts itself, and the uploader's font wait does not delay page load or the `uploaderReady` flag. The earlier flakiness comes from those specs not blocking Google Fonts.

## Review TASK-7 (round 2) - 2026-11-19
Branch: `task-7-lattice-watermark` (commit 9093d3a)
Result: APPROVED
- Round-1 must-fix (decoded photos held in memory): fixed in js/admin/watermark.js `processItem`. The `ImageBitmap` is now a local variable. It is closed right after both files are encoded, and also in `finally` on every error path. A re-render decodes `item.file` again, and the loop uses an `item.readable` flag. `removeItem` no longer needs to close anything. The new test wraps `createImageBitmap` and checks that the open count is 0 after the first run and after an opacity re-render, and that `made` is at least 4.
- Round-1 nice-to-haves done: the bar uses `color-mix(in srgb, var(--color-line) 30%, transparent)`, and chips use `var(--fs-small)` (12px).
- Re-keying unsaved pairs (new `isEditingSavedEvent()` + `rekeyUnsavedPairs`): checked these edge cases, all OK.
  - Clearing the date or short form (id becomes null) changes nothing. The pair moves when a full id comes back.
  - The new id picks a free name: the item's own old pair and the old-id form paths cannot clash with the new id.
  - `currentEventId` de-duplicates against saved ids, so the new id never lands on a saved event.
  - "Save event" uses the same `makeEventId` as the prediction, then `startEdit` sets `editingId`, so later date edits do not move the pair (tested).
  - After "New event" / "Cancel", the form photo is empty, so old `unsaved` items are skipped.
  - A pair the user replaced, or a path typed by hand, is skipped because the form photo does not match.
  - There is no recursion: `attachPhoto` does not call `notify`.
- [nice-to-have] js/admin/watermark.js:364-379 - `rekeyUnsavedPairs` does not check `item.state`. In the rare case where an attached card later fails on re-render (error, or now over 25 MB), changing the date would add a pending pair with no files again. Skip items that are not `ready` or that are `tooBig`. (The unsaved re-key also rewrites the save-status line and re-requests the 404 preview on every keystroke. This is harmless.)
- Round-1 nice-to-haves still open, not blocking: the 2x layer canvas for the master, and the preview 404 before Publish.
- Full suite re-run by the reviewer: 114 passed, 2 skipped, 0 failed.

## Review TASK-11 - 2026-11-19
Result: CHANGES REQUESTED
Security check: the token is sent only by `githubFetch` (github-token.js), always to `GITHUB.apiBase + path`. The path must start with a single `/`, so it cannot change the host. The token is not put in a URL or a body and is never logged. The request uses `credentials: 'omit'` and `referrerPolicy: 'no-referrer'`. Classic `ghp_` tokens and empty input are refused before anything is stored. The panel sets all text with `textContent`, there is no `innerHTML`, and the token is never printed back (only the last 4 characters). The CSP `connect-src 'self' https://api.github.com` and the no-referrer meta are both present, and the test proves a fetch to example.com is blocked. The leak watcher and the `auto` fixture with an unhandled-call check are good.
Tests: 132 passed, 3 skipped, 1 failed (task-9 OG-meta, desktop) in the full run under load. A re-run of task-9 + task-11 passed 27/27, so the failure is a timing flake on public pages this task does not touch.
Rulings on the programmer's decisions: all 8 accepted.
1. `bypassCSP` only in task-7.spec.js is fine. The app never fetches blob: URLs, the helper does, and TASK-11 checks the CSP with bypass off.
2. `connect-src` only matches the plan.
3. The plan wins over the style guide: the Forget confirm, "Save token", the plan's message texts and "Token saved, ends in ...xxxx".
4. The disabled Publish stub until TASK-12 is fine.
5. The saved-not-tested state, the 20s timeout, refusing characters outside `[A-Za-z0-9_]`, and trimming are all fine and are not scope creep.
6. role=alert for errors, the 2px bar from the style guide (the style guide wins on visuals) and the "How to get a token" details are fine.
7. The mock design is sound, apart from the item below.
8. `git ls-files --cached --others --exclude-standard` is a good scan source.
- [must-fix] tests/github-mock.js:186-187 - `GET /contents/...?ref=X` quietly falls back to head when X is not a known commit, while real GitHub returns 404 ("No commit found for the ref"). TASK-12's stale check depends on step 3 sending the right `ref={head}`. With this fallback, a bug that sends a wrong ref (for example `ref=undefined`) would still pass the tests. Suggested fix: accept no ref (use head), the branch name (head), or a known commit SHA. Anything else should return 404. Add one small assertion in task-11.spec.js or a mock self-test.
- [nice-to-have] tests/github-mock.js:191 - `path: x[1]` returns the URL-encoded path. Return the decoded path, as GitHub does.
- [nice-to-have] tests/github-mock.js:199-215 - POST trees does not check `mode`/`type`, and POST commits does not check that `parents` exist. Validating both (422 like GitHub) would catch more TASK-12/13 mistakes inside the mock itself.
- [nice-to-have] tests/github-mock.js:179 - GET trees ignores `?recursive=1`. That is fine for now because TASK-13 is already planned to extend it. When it does, the non-recursive form should return top-level entries only, so a missing `recursive=1` cannot pass.
- [nice-to-have] css/admin.css:261-264 - `.ibar` copies `.wm-ibar` (lines 207-211) rule for rule. Share one class, for example `.ibar, .wm-ibar { ... }`.
- [nice-to-have] admin/index.html:8 - as defence in depth, consider adding `object-src 'none'; base-uri 'none'; form-action 'self'` to the CSP. These directives are allowed in a meta CSP and do not touch `connect-src`.

## Review TASK-11 (round 2) - 2026-11-19
Result: APPROVED
- Must-fix resolved: tests/github-mock.js `/contents` now accepts only no ref, the branch name (also `heads/main` or `refs/heads/main`) or a known commit SHA. Anything else gets a 404, like GitHub. The new self-test in task-11.spec.js covers `ref=undefined` and an unknown SHA.
- Extras checked:
  - `/contents` returns the decoded path.
  - POST trees returns 422 for a bad path, type or mode.
  - POST commits returns 422 for missing parents.
  - The fake repo starts with this checkout's data/events.json, which TASK-12 needs.
  - The CSP adds `object-src 'none'; base-uri 'none'; form-action 'self'`, and the test checks that no `default-src`/`connect-src` widens the policy. The admin page has no `<base>` or `<object>`, and its form is handled in JS.
  - `.ibar` shares the `.wm-ibar` rules.
  All of this stays within TASK-11.
- Tests: full run 134 passed, 3 skipped, 1 failed. The failure was task-1 on the phone project (a public page this task does not touch). Re-running task-1 + task-9 + task-11 gave 39 passed and 0 failed, so it was a timing flake under load. This is the same kind of flake as round 1.
- [nice-to-have] tests/github-mock.js GET trees still ignores `?recursive=1`. TASK-13 is already planned to extend it; when it does, a non-recursive call should list top-level entries only.

## Review TASK-12 - 2026-11-19
Result: CHANGES REQUESTED
- Checked and correct:
  - The 7 calls run in the plan's order, and the PATCH is always the last write and always sends `force: false`. The commit has `parents: [head]`, the tree has `base_tree` and only `data/events.json`, and the contents read uses `ref={head}`.
  - A failure at any earlier step never reaches the PATCH, so the ref cannot move.
  - The blob is sent as `encoding: 'utf-8'` and the text is JSON-encoded by fetch as UTF-8. The browser's `gitBlobSha` uses TextEncoder bytes. I checked this with a scratch test (not committed): a Japanese + emoji event name round-trips byte for byte, the stored `baseEventsSha` equals the git SHA of the committed file, and a second publish works and reloads as "Nothing to publish".
  - `githubFetch` is the only code that sends the token. It sends with `cache: 'no-store'`, so the step-1 ref read and the extra re-read cannot come from the browser cache.
  - `busy` is set before the first await. The double-click test also forces a click through the disabled state.
  - The `github` fixture is automatic, unhandled routes fail the test, and the leak watcher is on.
  - Full suite: 175 passed, 3 skipped, 0 failed.
- Rulings on the programmer's decisions:
  1. Accepted. The plan's stale wording with Export backup / Reload replaces the storyboard's "Try again". Try again would only repeat the same stale check with the same base. See must-fix 1: the Reload path has to actually lead somewhere.
  2. Accepted. Storing `baseEventsSha` + `baseEventsText` and comparing in Export format is right: data/events.json is not in Export format today, so a raw-text compare would always show "changed". A null SHA (no Web Crypto, or a failed load) stops the publish as stale, which is the safe side. Setting the base to the *committed* text, not the current draft, correctly keeps edits made during a publish pending.
  3. Accepted. The calls, the encoded branch, and the commit message `(<n> events, 0 photos)` are fine.
  4. Accepted in principle. The extra re-read cannot cause a double commit: a retry rebuilds on the current head, the stale check runs again, and `force: false` holds. It cannot give a false success either: `made.sha` is a new commit whose parent is `head`, so the ref pointing at it means this publish went live. The "not confirmed" branch needs a change, see must-fix 2.
  5. Accepted. 401; 403/404 split by write vs read; rate limit from 429 or 403 with `x-ratelimit-remaining: 0` / `retry-after`; 409/422 count as stale only on the PATCH; a 404 on contents counts as stale; other errors show "GitHub said no (N)".
  6. Accepted. The busy flag, the Import/Discard locks via `lockFileActions`, and Forget token locked via `PUBLISH_BUSY_EVENT`.
  7. Accepted. "Step N of 7" is a fair use of the style guide's step-text pattern for a single-file publish (TASK-13 extends it). "Nothing to publish" plus the hint is right.
  8. Good coverage of the plan's list. Gaps: non-ASCII text, and the stale recovery path (both below).
- [must-fix] js/admin/publish.js:24 + admin/index.html:178-188 + js/admin/manager.js:433 - The stale recovery is a dead end. After the stale message, "Reload" restores the draft *with its old `baseEventsSha`*, so the next Publish is stale again, forever. I reproduced this with a scratch test: stale -> Reload -> Publish -> stale. The only way out (Discard draft, then Import the backup) is never explained. Fix: keep the plan's first line, but make the muted next line say what to do. For example: "Nothing was changed on GitHub. After reloading, press Discard draft to load the newest events.json, then Import your backup (or redo your edits) and publish." Do not quietly re-base the draft on reload, because that would overwrite the other device's change. Add a test: stale -> Export backup -> Discard -> Import backup -> Publish succeeds with exactly one commit.
- [must-fix] js/admin/publish.js:236 - After a network error or 5xx on the PATCH, if the re-read does not show `made.sha`, the code re-throws the original error, and the page says "Nothing was changed on GitHub." That is not known. A PATCH aborted by the 30s timeout can still be applied by GitHub afterwards, and a ref read right after a write can lag. Fix: in that branch throw the `unsure` error (keep the `made.sha` match as success), and update the test "PATCH connection drops but GitHub did not move the ref" to expect the unsure text. This stays safe: a Try again after an unsure result cannot double-commit (see ruling 4).
- [nice-to-have] js/admin/publish.js:204 - So that a Try again after "unsure" ends in the truth instead of the stale box: if step 3 finds `current.sha === gitBlobSha(text)` (GitHub already has exactly this draft), show success and `setBase` without writing anything.
- [nice-to-have] js/admin/manager.js:433 - A draft saved before Publish existed takes the *current* published SHA as its base. If the repo changed after that draft was made, the stale check would not catch it. This is a one-time migration case. Safer: use `{ sha: null }` so the first publish stops as stale and the user follows the (fixed) recovery steps. Or at least show a banner.
- [nice-to-have] tests/task-12.spec.js - Add a Japanese / emoji event name to the happy path (the decoded blob equals Export, and the stored base SHA equals the fake repo's SHA), so a later switch to base64 encoding cannot break non-ASCII text unnoticed.
- [nice-to-have] css/admin.css:285 - `.pend li { padding: 6px 10px }` uses raw px. Use the spacing tokens if they are close enough.

## Review TASK-12 (round 2) - 2026-11-19
Result: CHANGES REQUESTED
- Must-fix 1 (stale dead end) is resolved:
  - The stale box lists the 4 steps.
  - Discard with a token reads `contents/data/events.json?ref=main` and takes both events and base from that one response, so the pair always matches.
  - A reload keeps the old base, and an old draft gets `sha: null`, so its first Publish stops as stale.
  - The new tests cover the full recovery path (one commit, and both events end up live), Reload alone still being stale, and an old draft.
- Must-fix 2 (unproven "Nothing was changed") is resolved. When the ref re-read does not show `made.sha`, the page now shows the unsure message, and the abort, 500 and "applied later" cases are tested.
- Answers to the coordinator's questions:
  - **Discard -> GitHub read:**
    - No leak. It goes only through `githubFetch`, so the token is sent only as the Bearer header to api.github.com, with `no-store`, and is never logged.
    - No unmocked calls in older specs. task-6 is the only other spec that presses Discard, and it never saves a token, so `loadFromRepo` returns before any fetch. In task-11/12 the mock handles `?ref=main`.
    - A file over 1 MB (`encoding: "none"`) or any failed read falls back to the site copy, which is the safe side.
  - **"Already on GitHub" success:** safe.
    - It fires only when the blob SHA at the `head` read in step 1 equals the git SHA of the exact text being published. No write happens, so nothing can be overwritten.
    - The page says "Published" only when that text is already on main. That holds whether the earlier PATCH landed late or another device pushed the same bytes.
    - The link goes to `head`, and step 3 read the file at `ref=head`, so that commit really contains the file. It may not be the commit that first added it, which is acceptable.
  - **Discard re-basing:** it does not hide a stale situation.
    - The new base is exactly the file the user now sees.
    - A lagging contents read can only give an older base, which then fails the stale check (safe).
    - Overwriting the other change after Import is the user's explicit manual merge, and step 3 tells them to check it.
- Tests:
  - Full run: 184 passed, 1 failed, 3 skipped. The failure was the phone project, "stale (ref): PATCH returns 422", on `toContainText`.
  - task-12.spec.js with `--repeat-each=3`: 143 passed, 1 failed, a different test (phone, "failure: 404 on the tree write", `#pub-ok` not visible after Try again).
  - In the error-context snapshot, the publish had finished successfully after the 5s expect timeout ran out. These are timing flakes, not logic bugs. Still, 2 failures in 2 runs will fail QA and break the stable suite.
- [must-fix] tests/task-12.spec.js - The publish-outcome assertions use the default 5s expect timeout. A Publish runs 7-11 mocked round trips (one or two runs when Try again is involved), and on the phone project under 4 workers that does not always finish in 5s. Give the assertions that wait for the result box an explicit longer timeout, for example `{ timeout: 15000 }` or a `PUBLISH_DONE` constant (`#pub-ok`, `#pub-err`/`#pub-err-text`, `#pub-stale`). Then run `npx playwright test tests/task-12.spec.js --repeat-each=3` with 0 failures.
- [nice-to-have] js/admin/publish.js:25 - `staleNext` now repeats the 4 steps from admin/index.html, but the stale box never shows `error.next`, so the two copies can drift. Keep the steps in one place, for example `staleNext: 'Nothing was changed on GitHub.'`.
- [nice-to-have] js/admin/manager.js `loadFromRepo` - There is no timeout, and Publish stays enabled while Discard waits for GitHub. A publish started in that window is still safe (stale check, `force: false`), but the screen could then show an older base. Use an AbortController timeout, as `api()` does, and disable Publish/Import while Discard runs.

## Review TASK-12 (round 3) - 2026-11-19
Result: APPROVED
- The round-2 must-fix is resolved:
  - All publish-outcome waits use `RESULT_TIMEOUT` (15s) through `expect.configure`, and each test gets 60s.
  - The stale steps now live only in admin/index.html (`staleError()` passes an empty `next`).
- Lock/unlock in Discard is correct on every path:
  - If the confirm is cancelled, Discard returns before anything is locked.
  - `loadFromRepo` and `loadPublished` never throw: on a timeout, abort, non-OK reply, bad JSON or a file over 1 MB they return null or the empty fallback. Even so, `finally` always clears `draftLoading`, calls `lockFileActions(false)` and re-renders.
  - Publish and Discard cannot overlap: Discard is locked while publishing, and `publish()` returns while `isDraftLoading()`, including on a forced click.
  - The 30s AbortController also covers a body that stalls during `response.json()`.
  - New tests cover both the delayed read and the aborted read.
- Save-token "click miss" (programmer's extra change): I could not reproduce it, and I treat it as a test artefact, not a product bug.
  - I ran a scratch probe (not committed) on the phone project 40 times, alongside the task-3 and task-7 specs. It used the old fill + click helper right after the ready flags and logged the button's page position every animation frame plus every click target.
  - Result: 40/40 saved. Every click landed on `#gh-save`, and the button did not move between the ready flags and the click.
  - The click handler is attached before `data-github-ready` is set.
  - The only movement is *after* a save: the "Token saved, ends in ..." line (above the buttons) appears and pushes the buttons down 32px. That cannot swallow the Save tap itself.
  - The task-11 spec still covers the real click path. No bug filed.
  - The fill + Enter helper with a wait for "Token saved" is fine, and it also exercises the Enter handler.
- Tests:
  - Full suite once: 189 passed, 3 skipped, 0 failed.
  - task-12 with `--repeat-each=3`: 155 passed, 1 failed (desktop, "double-clicking Publish makes only one commit..." line 474). It saw `Step 2/4/7 of 7` but never `Step 1 of 7`.
  - That assertion races a fixed `{ delay: 600 }` on the first ref read. Under load the page is already past step 1 when the poll starts.
  - This is test-only. The lock and the one-commit result were not wrong; the run never got that far. It is a single assertion, not the systematic 5s problem from round 2, so it does not block approval. It should be fixed before or during QA (see below).
- [nice-to-have, fix before QA] tests/task-12.spec.js:463,474 - Hold the first `REF_GET` on a gate the test releases (for example a promise resolved after the lock assertions) instead of `{ delay: 600 }`. Or assert `/Step [1-7] of 7/`. Then the transient "Step 1" state cannot be missed. If QA hits it first, log it as a test-only bug for the bugfixer.
- [nice-to-have, TASK-11 follow-up, not a bug] admin/index.html:137-139 - The "Token saved" line appears above Save / Test / Forget and pushes them down 32px right after a save. A quick second tap aimed at Test connection could land on the wrong spot. Consider putting `#gh-saved` below the button row or reserving its height.

## Review TASK-13 - 2026-11-19
Result: CHANGES REQUESTED
- Branch `task-13-photo-publish` (17b3382), diffed against `site-v1`. Full suite: 229 passed, 3 skipped, 0 failed (same as the programmer's numbers).
- Data safety, checked and OK:
  - One atomic commit: every image blob, the events.json blob and every `sha: null` entry go in one `POST git/trees` (`base_tree` = head's tree), then one commit (parent = head), then `PATCH ref` with `force: false`. The ref is the last call, so a failure at any blob, tree or commit step leaves the ref where it was. The 500, network-abort and branch-moved-mid-upload tests prove this.
  - Deletions: `removalCandidates` only takes `type: 'blob'` tree entries that pass `isRemovable` (prefix `media/events/`, exact lowercase `.webp`, no empty, `.` or `..` segments, not used in the committed text, not a new path). A truncated listing gives an empty list. The guard runs before the dialog and again right before the tree POST, and it uses local Sets nothing else can change. The untouchable-files test covers `.WEBP`, `.webp.png`, `media/eventsx/`, `media/events.webp`, `img/` and `favicon.svg`. (Exception: the must-fix below.)
  - `publishHooks.editRemovals` is only ever set by the tests through `import()`. Nothing in the app sets it, and page content cannot reach it without running same-origin script (which would already mean XSS). It also cannot widen deletions: whatever it returns still has to pass both guard runs and the confirm dialog. Sound as a test seam.
  - WeakSet: only `encode()` in watermark.js marks blobs, right after `renderWatermarked` draws the lattice and `toBlob` returns. The original `File` never passes through `encode`, and the set cannot be listed or forged. `prepare()` refuses any file whose blob is not in the set, before any request. Sound. TASK-15 must mark the new marked blob too (marking makes a new Blob).
  - Limits: `prepare()` runs before `run()`, so the 20-pair limit, the 25 MB check, the allowed paths, the pipeline check and the extra checks all happen with no request sent. The button is also disabled for limit problems.
  - Base64: `readAsDataURL` with the `data:...,` prefix cut off is correct for binary. The test that re-hashes the decoded content against the tree SHA proves the bytes survive.
  - "Already published" shortcut: with photos it returns success only if the listing is not truncated and every pending file's git blob SHA (from its bytes) matches the tree entry at that exact path. Otherwise it falls through to the stale check. No false success found.
  - Token: every new request goes through `api()` -> `githubFetch`. The only `fetch(` calls outside github-token.js are the existing same-origin data reads.
- Rulings on the programmer's decisions:
  1. 8 steps, stale check before the tree read (except on the already-published path, which only reads), TASK-12 tests updated from 7 to 8 calls: approved.
  2. WeakSet pipeline marker plus the `addFileCheck` hook for TASK-15: approved.
  3. All refusals happen before any request: approved.
  4. `isRemovable` rules: approved as rules for the path itself, but `used` must be normalised (must-fix 1).
  5. Only photos used by saved draft events are published: approved (matches the criteria; unsaved form pairs wait for Save).
  6. Pending list layout (pairs with sizes, `~ data/events.json`, predicted `-` rows marked "(no event uses it)", total line): approved. It matches the storyboard order (+, ~, -), and the dialog stays the source of truth.
  7. Native `<dialog>`, Cancel first and focused, Esc as Cancel, phone stacks the buttons with Cancel last: approved. Matches the style guide and the storyboard.
  8. Progress text "Step 5 of 8: Uploading file N of M" (M counts events.json): approved. It meets the plan's "Uploading file 3 of 9".
  9. Mock `recursive` / `treeTruncated` (top level without `recursive`, half the list with `truncated: true`): approved.
  10. A draft that still references a pair after "Remove from publish": **not a must-fix for TASK-13**. The criteria define the button and say nothing about the draft paths, so the code matches the spec. It is a real product gap, though, and worse than a missing image: if the pair replaced an older photo, the predicted `-` rows still remove the old, working files, so the event goes live with a broken image and its old photo deleted. This needs a design decision (block Publish, warn, or put the old paths back in the form), so it goes to the **idea-collector -> planner** as a new idea. It should be decided before the release, not after.
- [must-fix] js/admin/publish.js:154-166 (`usedPathsIn`) together with js/events-data.js:59 (`photoPathError`) - "Used" is an exact string match, but the validator accepts paths the public site still loads as the same file:
  - `./media/events/X/old.webp`
  - `media/events/X/./old.webp`
  - `media/events/X/old.webp?v=2` or `...#x`
  - `siteUrl()` resolves each of these with `new URL(path, ROOT)`, so the site shows `media/events/X/old.webp`. But `isRemovable` decides that file is unused and deletes it, and the image breaks on the live site. A path like this can come from the form or from Import. This breaks "nothing still used is ever removed".
  - Fix (pick one): (a) in `usedPathsIn`, also add each path's resolved form, for example `decodeURIComponent(new URL(p, 'https://x.invalid/').pathname.slice(1))`, so every way of writing a path protects the file; or (b) remove nothing (as with a truncated tree, with a clear note) when any event's `photo` / `photoFull` is not already in canonical form.
  - Add a test: event X uses `./media/events/X/old.webp` (and one with `?v=2`), the repo has `media/events/X/old.webp`, and Publish lists and removes nothing.
- [nice-to-have] js/admin/publish.js:587-605 (`confirmRemovals`) - It only resolves on the buttons or on `cancel`. Chrome's close-watcher rules can close a modal dialog on Esc *without* firing `cancel` when there was no user activation since it opened. Then the promise never settles and Publish stays "Publishing..." until a reload. No data risk (nothing has been written yet), but listen for `close` too and resolve `false` unless Yes was pressed.
- [nice-to-have] js/admin/publish.js:333,335 - `path === EVENTS_PATH` and `rest.length < 1` can never be true after the prefix check (split always returns at least one item). It is harmless defence in depth; drop it or leave a one-line comment.
- [nice-to-have] tests/task-13.spec.js - There is no test for the "already published" shortcut *with photos* (unsure PATCH that was applied later, then Try again finds the text and both images on GitHub -> success with reads only, no second commit). The logic is right, but this is the path most likely to regress.

## Review TASK-13 (round 2) - 2026-11-19
Result: CHANGES REQUESTED
- Commit e330c4c re-reviewed. Full suite: 243 passed, 3 skipped, 0 failed.
- Round-1 must-fix is mostly resolved:
  - `usedPathsIn` adds both the raw and the resolved form of each path.
  - `allPathsCanonical` makes Publish remove nothing when a path is written in an unusual form, and the guard uses the same extended set.
  - The new tests cover `./`, `/./`, `?v=2` and `#x`, both as unit checks and end to end.
- Round-1 nice-to-haves are done:
  - `close` counts as Cancel, and `settled` stops a second answer: the `close` event that follows Yes is ignored.
  - The "already published" shortcut with photos now has a test.
- Removing the 2 checks from `isRemovable` was safe:
  - `path === EVENTS_PATH` can never be true, because `data/events.json` fails the `startsWith('media/events/')` check first.
  - `rest.length < 1` can never be true, because `split` always returns at least one item.
  - The segment checks that matter (`''`, `.`, `..`, a bare `.webp`) are still there.
- Other ways of writing a path, run through `resolvedPath` and `allPathsCanonical` in Node:
  - Percent-encoding (`old%2Ewebp`, `%2e%2e`, `%6F`): resolves to a different string, so it counts as not plain and nothing is removed. A bad escape (`%zz`) makes `decodeURIComponent` throw, which gives null, which also counts as not plain. Safe.
  - Leading `/`: refused by `photoPathError`. Even if one got past it (for example a hand-edited events.json in the repo), it counts as not plain. Safe.
  - Backslash: refused by `photoPathError`. The URL parser also turns `\` into `/`, so it counts as not plain. Safe.
  - Leading or trailing spaces, tabs or newlines: the URL parser strips them, so they count as not plain. Safe.
  - Case differences (`Media/events/...`): counts as plain and does not protect `media/events/...`. Correct: GitHub Pages paths are case-sensitive, so that reference never loaded the lowercase file.
  - **Doubled slash (`media//events/X/old.webp`, `media/events/X//old.webp`): still counts as plain**, because the URL parser keeps empty segments. See must-fix 1.
- Rulings from round 1 stand. Item 10 ("Remove from publish" leaves the draft pointing at missing photos) stays a new idea for the idea-collector, to be decided before the release.
- [must-fix] js/admin/publish.js `allPathsCanonical` - A photo value with an empty segment (`//`) passes as plain form.
  - Many web servers merge doubled slashes. If GitHub Pages does, `media//events/X/old.webp` shows `media/events/X/old.webp` on the live site, but Publish treats that file as unused and removes it. We cannot check how Pages behaves from here, so fail safe.
  - Fix: also require no empty segment, for example `resolvedPath(value) === value && !value.split('/').includes('')`.
  - Add `media//events/X/old.webp` and `media/events/X//old.webp` to `UNUSUAL` in tests/task-13.spec.js. A one-line fix plus 2 test rows.

## Review TASK-13 (round 3) - 2026-11-19
Result: APPROVED
- Commit 69865fe re-reviewed.
- Tests:
  - My run: tests/task-12.spec.js plus tests/task-13.spec.js with `--workers=2`: 134 passed, 0 failed.
  - I did not run the full suite this round, because memory on the machine is tight. The programmer reports 271 passed, 3 skipped, 0 failed, and the coordinator's task-13 run with `--repeat-each=3` gave 246 passed, 0 failed.
- The round-2 must-fix is resolved. `isCanonicalPath` requires all of these:
  - the allowlist regex `^[A-Za-z0-9._~-]+(?:/[A-Za-z0-9._~-]+)*$`, which rules out empty segments (so no `//`, no leading or trailing `/`), and any `%`, `?`, `#`, `;`, `\`, `:`, whitespace or non-ASCII character;
  - no `.` or `..` segment;
  - `resolvedPath(v) === v`.
- If any event's path is not canonical, nothing is removed. Both `//` forms are now covered by unit tests and end-to-end tests.
- The allowlist is correct. The only forms that still count as canonical name a genuinely different file on a case-sensitive host that does not trim dots: uppercase letters, a trailing `.`, and `...`, `~` or `.hidden` names (checked in Node). `photoPathError` also still refuses any `..` substring.
- The deletion guards are still airtight:
  - `isRemovable` is unchanged apart from the 2 dead checks removed in round 2.
  - The used set holds both the raw and the resolved form of each path.
  - The not-canonical fail-safe, like the truncated-tree one, sets the list to `[]` before the hook and before both guard runs.
- No false fail-safe in normal use. Uploader paths are `media/events/<date>-<slugify(short)>/<slugify(name)>[-n][-full].webp`, and `slugify` only gives `[a-z0-9-]` (it applies NFKD and strips accents and other non-ASCII). I checked awkward inputs (`IMG_2024 (1).JPG`, Japanese-only names, `Café Ünïcode.heic`, `a.b.c.png`, a short form of `C.F! 冬`): every resulting path is canonical. The current data/events.json has no photo paths. Only hand-typed unusual paths turn removals off, and then the note says why.
- Earlier rulings stand.
- Follow-up for idea-collector (not blocking): "Remove from publish" leaves the draft pointing at photos that are not on GitHub. Because removals are still predicted, an event that replaced its photo could go live with a broken image and its old photo deleted. It should be decided before the release.

## Review TASK-15 - 2026-11-19
Result: APPROVED
- Reviewed commit f0e7f62 against site-v1.
- Tests (my runs, `--workers=2`):
  - tests/task-15.spec.js: 14 passed.
  - Full suite: 285 passed, 3 skipped, 0 failed.
- Marker correctness: checked against the WebP container spec and PNG spec.
  - VP8X is correct: 10-byte payload, flags only `L` (alpha, VP8L hint bit only), reserved bytes 0, canvas width-1 and height-1 as 24-bit little-endian. The VP8 size comes from the 14-bit fields after the `9d 01 2a` start code. The VP8L size comes from the 14+14 bits after `0x2f`.
  - The RIFF size is `4 + body`, and every chunk is re-emitted padded to an even length.
  - An existing VP8X (Chrome's ALPH case) is kept as it is. Old PZWM chunks are replaced, so there is never a second marker.
  - The unknown chunk sits after the image data, which the spec allows for extended files.
  - Chromium decodes the marked file to the same size with identical pixels (test). libwebp's demuxer refuses a VP8X canvas that does not match the frame, so this also proves the canvas fields. Firefox and Safari use the same libwebp parsing rules.
  - PNG: the `tEXt` chunk (`puzzkezz-wm\0<json>`, Latin-1) goes before the first IDAT. The CRC covers type + data. The reader checks the CRC and stops looking at the first IDAT.
  - The reader is strict but robust. It needs RIFF/WEBP, VP8X first, a chunk walk inside the RIFF size and the file length, a marker of at most 1 KB, and exact `wm`/`v` with positive integer `f`/`div`. Everything is in try/catch, so it never throws.
- An unmarked file cannot reach a commit through Publish:
  - `encode()` marks the file and registers only the new marked Blob in the WeakSet. The unmarked encoder Blob is never registered.
  - `prepare()` runs the path checks, then the WeakSet check, then `watermarkMarkerCheck` on every file, before any request. It runs on every publish and every Try again.
  - A Blob that cannot be read gives `bytes = null` and is refused.
  - The test proves both layers separately: an unmarked Blob that is registered is caught by the marker check, and a marked Blob that is not registered is caught by the WeakSet.
- Repo guard is meaningful:
  - It walks the filesystem and skips only the 5 folders at the root. `storyboard/` and `tests/` are scanned.
  - Allowlist entries are pinned by exact path + SHA-256 + reason. A stale or missing entry fails.
  - Unmarked fixtures must decode to 16 colours or fewer.
  - References in the JSON files and the public HTML are resolved and must exist.
  - Each message starts with the file path.
  - The self-test reports exactly the 3 bad files, and a noisy "fixture" fails the colour rule.
- Node `data:` URL import: acceptable. wm-marker.js has no imports, and if a relative import is ever added the import fails loudly instead of passing silently. A cleaner long-term option is a `js/admin/package.json` with `{"type":"module"}`, so it can be imported by file URL (this needs a check that the static server and the browser are unaffected). Not blocking.
- Allowlist ruling (open question 21):
  - The plan line "only og-image.png is allowlisted" was written without knowing about the committed docs screenshots and the reference PNG. The programmer handled it correctly: each file is pinned by hash, the reason says "no photo of Puzz", the test forbids `media/` and `storyboard/` entries, and the question is raised for the user.
  - I viewed og-image.png, docs/screenshots/admin-pc.png, docs/screenshots/home-phone-full.png and extra_asset/puzz-extra-asset/sashisuseso-reference.png. All of them are UI with sample data, `[Portrait]`/"photo soon" placeholders, or text only. None has a photo of a person.
  - Accepted as an interim until the user answers question 21. If the user wants the files deleted instead, that is a small follow-up (remove the files and their entries).
- Scope and UI text: only TASK-15 files changed. The help-box sentence matches the criterion word for word. The Publish message matches the plan exactly.
- [nice-to-have] js/admin/wm-marker.js:156-157 - `webpChunks` already returns null when the last chunk is missing its pad byte (`next > end`), so the re-pad branch can never run. Remove it, or relax `webpChunks` on purpose and keep it.
- [nice-to-have] js/admin/watermark.js:187-189 - if marking fails, the user is told "This browser can't make WebP files", which is misleading. A specific message (or the generic processing-failed message) would be clearer.
- [nice-to-have] tests/wm-guard.js:34 - symlinked image files are skipped by the scan (`isFile()` is false). A referenced symlink is still caught by the reference check, but an unreferenced one is not. Consider `fs.statSync` for symlinks, or reporting them as problems.
- [nice-to-have] tests/task-15.spec.js:501 - pin the exact allowlisted path set in the test. Adding an entry would then need a visible test change too, which matches the plan's "only og-image.png" intent once question 21 is answered.
- [nice-to-have] tests/wm-guard.js:92 - only `<img src>` is checked. If `srcset`/`<source srcset>` is ever used, add it.

## Review TASK-14 - 2026-11-19
Result: APPROVED
Round 1. Branch `task-14-site-photos` (f0c87da), diffed against site-v1. Full suite run once with `--workers=2`, in chunks: 305 passed, 3 skipped (the same device-specific skips as before), 0 failed. This includes task-1 to 5, 8 and 9 after the `.wm-card` -> `.sp-card` CSS change, and the TASK-15 real repo scan.
- One pipeline: `makeSitePhoto` goes through `encode()`, so it uses `renderWatermarked` -> `drawLattice` -> `watermarkLayout`, then `addWatermarkMarker` (`f` = `watermarkLayout(w, h).f`, `div` = `WM_DIVISOR`), then `markPipelineFile` on the marked Blob only. There is no second size rule: it uses `displaySize`/`DISPLAY_QUALITY`, and the text and opacity come from the shared uploader controls.
- Share image crop: `coverCrop` picks the centred source rectangle with the 1200:630 ratio (for 2400x1600 that is 2400x1260 at y=170). It is drawn into the 1200x630 canvas, and only then is the lattice layer drawn over the full width x height. So the watermark covers the whole output, with no stretching. The PNG gets the `tEXt` marker, and files over 5 MB are refused with the plan's exact message.
- Publish safety:
  - `sitePathProblem` accepts only `media/site/portrait.webp` for portrait, `og-image.png` for share, and `media/reels/<id>.webp` for reel, where `<id>` must be in the published reels.json and the target must match the path. It runs in `prepare()` before any request, together with the WeakSet check and the marker check.
  - One tree + one commit + one `PATCH` with `force: false`.
  - Each JSON keeps its own base SHA. events.json keeps the TASK-12 rule (a base is required). site.json may be missing on both sides (null === null), and any other difference counts as stale.
  - Site paths never match the removal rules (`media/events/` only), and `newPaths` excludes them anyway.
- Site-only publish: events.json is not read, not written and not stale-checked, and there are no removals. This cannot lose event data, because events.json is not in the tree, so `base_tree` keeps whatever is on GitHub. `force: false` still stops a race on the ref. `withEvents` is true whenever the events draft differs from its base or event photos are pending, so an events edit is never silently left out. Nothing is removed or overwritten wrongly: the only overwrites are the fixed site paths, by design ("replaced in place").
- reels.json: `formatReels(JSON.parse(current file))` gives back the committed file byte for byte (checked in Node). A thumb change alters exactly one line. reels.json is only committed when a thumb differs from the base.
- Public pages: the placeholder (role and aria-label) stays until the image has loaded. A 404, `portrait: null`, a missing site.json or an unsafe path leaves it untouched, and this is tested. Reel covers use `loading="lazy"` and alt "<en> reel cover", and the placeholder label comes back if the image fails to load. `og:image` HTML is unchanged.
- Ruling on the programmer's extras (accepted, not scope creep):
  - Discard draft also restarts the site draft. Without this, the site draft would keep an old base after the events reload, and the confirm text says so.
  - "Remove from publish" on a site photo reverts that value to the published one. This is the safety-minded counterpart of the remove button: it stops a draft from pointing at a file that will not be on GitHub.
- Item 8 / open question 22: the current repo state passes (task-15 real scan green, og-image.png still the allowlisted screenshot). TASK-14 is acceptable with Q22 open: nothing on the live site breaks, and only the test run fails after the first Share image publish, naming the file. Recommendation for the user, which does not weaken the guard:
  - Keep exact-hash allowlisting as it is.
  - Add one narrow rule: when an allowlisted file's hash no longer matches but the file **carries the marker**, the guard passes it and reports the entry as stale (a warning, or a separate soft-fail list). A marked file would pass anyway if it were not allowlisted, so no unmarked file can slip through. An unmarked file with a stale hash still fails exactly as today.
  - The task-15 assertion "og-image.png is on the allowlist" (tests/task-15.spec.js:501) becomes "og-image.png is allowlisted or marked".
  - This is a TASK-15 change, for the planner and user to decide. It does not block TASK-14.
- [nice-to-have] js/admin/site-draft.js:252 - the site draft (portrait/thumb) survives a reload in localStorage, but the pending file is memory-only. After a reload without publishing, Publish would commit site.json/reels.json pointing at a file that is not on GitHub. The pages fall back to the placeholder, but the TASK-15 repo guard then fails on the missing reference. The events draft has the same gap, and TASK-16 (proposed) addresses it for event photos. Suggest the planner extends the TASK-16 link check to `portrait`/`thumb` (for site paths, check them against the tree + the files in the publish).
- [nice-to-have] js/admin/publish.js:291 - after Discard draft, a pending **Share image** stays in the publish set (`siteFileUsed` is always true for share), although the confirm now says "events and site photos". Clear pending site files on discard, or word the confirm so it does not promise that. Also related: pending.js:109 keeps warning on beforeunload for site files that are no longer used by the draft.
- [nice-to-have] js/reels.js:26 - `safeThumb` duplicates `safeRelativePath` in js/portrait.js (and is slightly weaker: it has no `\\` or `://` check). Export one helper and use it in both.
- [nice-to-have] js/admin/publish.js:286 - `reelCoverPath(m[1]) === path` is always true once the regex matched. Drop it, or keep it as a deliberate belt-and-braces with a comment.

## Review TASK-16 - 2026-11-19
Result: APPROVED
Round 1. Branch `task-16-broken-link-guard` (8b1be17), diffed against site-v1. I ran the whole suite once with `--workers=2`, in 2 chunks: 351 passed, 3 skipped (the same device skips as before), 0 failed. The task-12/13/14/16 chunk passed 200/200.
- **No write after a broken link:**
  - `run()` reads the tree (after the stale check) and then calls `brokenPhotoLinks` + `brokenSitePhotoLinks`. It throws before `removalCandidates`, the guard, the dialog and the first `POST`.
  - Try again calls `publish()`, so it goes through the same path. The "hold" test shows that no write happens while the tree read is held.
  - The "already published" early exit only returns when every JSON text and file is already on GitHub byte for byte. Nothing is written, so it can't publish a new broken link. This matches the plan.
  - Site-only publishes: events.json is not in the commit, so it is live and not checked (per plan). The site JSON texts in `data` are always checked.
  - Truncated tree: any path that is not new gives `unchecked` (stop), even if it appears in the partial listing.
  - I found no bypass.
- **False positives:**
  - These all pass and are tested: files in this publish (`newPaths`), files already in the repo, events with no photo, `img/...` outside `media/events/`, deleted events (not in the text, still removal candidates), and a portrait that is already on GitHub.
  - Sample events have no photo, so they pass.
- **False negatives:**
  - Only `type: "blob"` entries count. A folder (`tree`) or submodule (`commit`) entry at that path gives `missing`.
  - The match is exact, so a case difference (`Old.webp` vs `old.webp`) gives `missing`. That is correct for GitHub Pages.
  - Every non-plain form stops at `isCanonicalPath` before the tree lookup.
  - Plain paths outside `media/events/` are not checked for events. That is the plan's explicit choice (TASK-15 guard).
- **`revertPair` / `revertPhoto`:**
  - It finds the event by id and only acts when the draft `photo` equals the pair's `photo` and `photoFull` equals the pair's (or is empty). This matches the criterion.
  - It runs synchronously on the click and reads the current draft, so an earlier undo can never overwrite a later saved edit.
  - The button is disabled while publishing.
  - `revertPhoto` touches only that event's two photo fields plus the open form's photo fields and preview.
  - When several pairs share one file, each is reverted under the same rule. This is correct, because the file is gone for all of them.
- **Messages:**
  - The wording and the two-line split match the plan.
  - Problems are listed in the order of `exportText`: newest first, then portrait, then reels.
  - "(and N more)" counts distinct `who` values, and `who` includes the event or reel id. So it counts events and site photos, not each path.
  - Every message names the event (short, year, id) or the file.
- **TASK-13 test changes:** justified.
  - The unusual-path tests still prove that nothing was removed and the files are still there, now with "no write". The pure `isCanonicalPath`/`allPathsCanonical` test is unchanged.
  - The truncated test was split, so the TASK-13 "Could not list all old photos" note is still covered when there are no photo references.
  - Removing `notCanonical` from `run()` loses no protection: removals only happen when `withEvents` is true, and in that case every non-plain event path has already thrown.
- **Programmer's decisions:**
  - (1) Site links checked under every prefix: accepted (plan (3)).
  - (2) The truncated stop shows no "(and N more)": accepted.
  - (3) Reverting every pair of the removed file: accepted.
  - (4) The last note wins: accepted.
  - (5) `notCanonical` dropped from `run()`, with `allPathsCanonical` kept for the pending preview: accepted (see above).
  - (6) The TASK-13 truncated test split into two: accepted.
  - (7) `#pub-note` is a new element with `role="status"`, styled with tokens only: accepted.
  - (8) BUG-4 marked `fixed (TASK-16)` on the task branch: accepted. It only reaches site-v1/main with the merge, which is what the plan asks. QA must re-run the BUG-4 steps, and if QA fails, the status goes back to open.
- [nice-to-have] js/admin/manager.js:457 - `revertPhoto` does not restore `sample`.
  - `attachPhoto` deletes `sample` (manager.js:442), so after attach + Remove on a published sample event, the draft still differs from live. The button stays enabled, and the next publish drops the "Sample" tag.
  - Today all 8 live events are samples (none has a photo), so this is the first realistic use.
  - Suggestion: restore `sample: true` from the published event when the event is otherwise unchanged. This is a behaviour change, so it is for the planner to decide. Nothing is lost or broken; the change shows as "events.json changed".
- [nice-to-have] js/admin/manager.js:466 - if X is open in the form and the user typed a different photo path without saving, Remove overwrites that unsaved field. Consider leaving the form fields alone when they differ from the pair.
- [nice-to-have] js/admin/publish.js:850 - the check runs against the tree before removals. A hand-edited live `portrait`/`thumb` pointing into `media/events/` (unused by events) could pass the check and then be removed in the same commit. This is a pre-existing TASK-13 rule and out of scope. Suggest the planner adds site JSON links to `used` later.
- [nice-to-have] js/admin/publish.js:404 - when the first problem is `unchecked` but a later one is `form`, the user only sees "can't be checked". This only happens with a truncated tree, so it is very unlikely.
- [nice-to-have] tests/task-16.spec.js:401 - the "folder" case uses `media/events` (outside the prefix). Add `media/events/<id>` with a `tree` entry, plus a case-difference path (`Old.webp`), to pin the "missing" result for both.

## Review TASK-17 - 2026-11-19
Result: APPROVED

Round 1. Branch `task-17-guard-marked-stale-hash` (e75b801), diffed against site-v1. Only `tests/wm-guard.js`, `tests/task-15.spec.js`, `docs/plan.md` and `docs/changelog.md` changed. `tests/wm-allowlist.json` is unchanged. Test runs with `--workers=2`: task-15 had 16 passed. The full suite had 359 passed, 3 skipped (the same device skips as before), 0 failed. No temp folders were left in /tmp, the worktree is clean, and no processes are left.

- **Does it weaken the guard? No.** The new branch is reached only when the path is on the allowlist **and** its hash no longer matches. It passes only if `isValidMarker(readMarker(bytes))` is true, and that check is stricter than the existing truthy check for files that are not on the allowlist (wm-guard.js:145). So a changed allowlisted file now needs exactly what any new file already needed, and no more is allowed than before. The cases:
  - **Hand-made marker:** it passes, but it already passed as an unlisted file in TASK-15. The plan (section 4) says plainly that the marker "catches mistakes... It is not a lock". This task opens no new hole.
  - **Wrong version / foreign id:** `parseMarker` already returns null unless `wm === WM_ID` and `v === WM_VERSION`, and `isValidMarker` checks both again. Both are tested (v:2 PNG and foreign PNG with a fixed CRC both fail).
  - **Corrupt CRC:** `readFromPng` needs `crcOk`. Tested, and it fails.
  - **Wrong chunk position:** PNG markers after the first IDAT return null, and a WebP needs VP8X first. Both rules are unchanged from TASK-15.
  - **Allowlisted, unmarked, hash changed:** still fails with the exact TASK-15 message. This is asserted word for word.
  - **Not allowlisted:** the path is unchanged (`img/loose.png` still fails).
  - **Injected reader (decision 2):** a reader that returns a truthy but wrong object (`{wm:'other'}`, `v:2`, a missing `v`, `true`, a string) does not open the stale rule. Tested with five fakes against `checkRepo`.
- **What the marker proves:** `wm: "puzzkezz-lattice", v: 1` is exactly what wm-marker.js writes (`WM_ID`, `WM_VERSION`). The marker proves the file "came out of the uploader pipeline". It does not prove that the pixels carry a visible watermark. This matches the plan. TASK-15 already accepts any marked file on that basis, and the plan's honest-limit note covers forgery. TASK-17 extends the same trust to a replaced allowlist file, and nothing beyond it.
- **Real-repo test:** og-image.png is "allowlisted or marked", which matches the criterion. The other 10 entries are still pinned: no stale note is allowed for any path except og-image.png, and each hash is asserted. This is stricter than the plan asks. It is right, because those entries are docs screenshots and a reference image that the uploader never replaces. Stale notes are shown as an annotation and a console line, as required.
- **Tests:** they are meaningful, not tautological. They are real marked/edited PNG bytes run through the real reader and `checkRepo`, with exact problem and stale lists. The TASK-15 self-test also asserts `stale` is `[]`. The temp folder is made with `mkdtempSync(os.tmpdir())` and removed in `finally`, so nothing is written to the repo.
- **Extra `v:2` test:** fine to keep. It pins the version rule in the reader as well as in `isValidMarker`.
- [nice-to-have] tests/wm-guard.js:104 - `'puzzkezz-lattice'` and `1` repeat `WM_ID` / `WM_VERSION` from js/admin/wm-marker.js. The repetition is understandable, because the guard is CommonJS and the marker module is loaded asynchronously. A one-line test assertion would stop silent drift if the version is ever bumped: `isValidMarker({ wm: marker.WM_ID, v: marker.WM_VERSION })` is true.
- [nice-to-have] tests/wm-guard.js:145 - files that are not on the allowlist still pass on any truthy `readMarker` result. This is safe with the real reader, which validates the marker. Using `isValidMarker` there too would close the injected-reader case everywhere. That is outside this task ("nothing else in the guard changes"), so it is for the planner to decide later.

## Review TASK-19 - 2026-11-23
Result: APPROVED

Round 1. Reviewed `feature/hall-bangai` (first Home commit 7988c22) together with `task/TASK-19-home-hall-bangai` (ae65ee9, 8dc9c53), diffed against site-v1. Run with system Chrome on a separate port and worktree: task-19 + task-3 + task-4 = 66 passed (desktop + phone). The suite failures seen (task-2:6, task-6, task-10:202, task-11:135) also fail on site-v1 and are BUG-8 (old tests expect the 8 sample events), not this task.

- **Criteria:** all met. Hall ??? is always added after the last year group and before END OF HALL, there is no Hall ??? with no events, there is no hall letter, and the summary counts real events only. The sign has 番外 with ruby + `lang="ja"`. The station pronunciation block has the furigana, `ban-gai`, the English and the speaker `Play pronunciation: ban-gai`. The pop-up title now has furigana, romaji, English **and** a speaker. The polaroid is a `<button>` with the right aria-* set, the kaomoji is `aria-hidden` and it does not flip. The peek animation is off under reduced motion. The strip has `???` + one tick, click-to-scroll and the highlight. Native `<dialog>`, `showModal()`, `aria-labelledby`, focus on CLOSE, Esc / CLOSE / backdrop, focus back, scroll lock. moments.json is fetched once, only on the first open. A8 order. Filters, empty and 404 states, the double-open guard, and 1 / 2 / 3 columns (user choice: 1 column under 600px, one "Videos & links" chip).
- **Security:** every moment string goes through `textContent`. `innerHTML` is only used for the fixed SVG icons. Links are http/https only (`isHttpUrl`), and `javascript:` is rejected and tested. Photo paths must be relative with no `..`, no scheme and no leading `/`. Duplicate ids are skipped. Other links get `rel="noopener"`. No iframe and no third-party request before a click (tested).
- **Storyboard:** matches the approved HOME screen and album pop-up. The approved storyboard draws `???` as a normal year on the line (storyboard/style.css comment "??? is a normal year (same dot, label and line)"), and the build does the same.
- **Tests:** tests/task-19.spec.js covers every listed case with real assertions. These include the request counts, `:modal`, focus targets, the warning count for bad moments, the third-party request list and the column counts.
- [nice-to-have] docs/plan.md TASK-19 "Timeline" says `???` is "set apart from the year line", and docs/ideas.md says "detached, not joined to the main line". The approved storyboard and the build join it to the line. I followed the storyboard (it is the approved one). The planner should make the wording match, or the user can ask for a detached `???` as a new change.
- [nice-to-have] css/components.css:344 - on a 375px phone the title wraps as "番外 THE EXTRA / ONE" with the speaker on its own line. `white-space: nowrap` on `.bm-en` (or a smaller size under 600px) would keep it on one line.
- [nice-to-have] js/bangai.js:191 - with no moments at all, the chips still show above the empty message. The storyboard's empty state hides the chips (`.is-empty .bm-filters`). This is not required by the criteria.
- [nice-to-have] js/bangai.js:180 - `opening` can never be true when `open()` is entered (the body is synchronous). `dialog.open` is the real guard, so `opening` can go.
- [nice-to-have] css/components.css:350 - `.bm-chip` uses literal `0.8125rem` and `22px` radius. These copy the storyboard, but a token (or the existing chip style) would be better.
- [nice-to-have] js/embed.js:106 (pre-existing) - when a facade becomes an iframe inside the dialog, focus falls back to the document. Moving focus to the new iframe would keep keyboard users in place.
- [nice-to-have] commit 8dc9c53 also changes `.claude/agents/programmer.md` (model). This is not TASK-19 work. Keep agent config changes in their own commit.

## Review TASK-20 - 2026-11-23
Result: APPROVED

Round 1. Diff `task/TASK-19-home-hall-bangai..task/TASK-20-events-hall-bangai` (4f03d69). task-20 + task-5 + task-19 = 56 passed (desktop + phone, system Chrome).

- **Criteria:** all met. The last section has `id="hall-bangai"` with the heading "Hall ??? 番外" (ruby, `lang="ja"`) and a full pronunciation block with a speaker. The jump row ends with `???` -> `#hall-bangai`, and the deep link works. There is one card: kaomoji (`aria-hidden`), the line "Funny and special moments, all years" and "Open album". The card uses `bindAlbumTrigger()` from js/bangai.js (shared code, not a copy), and focus returns to the button. It is not an event: no date, no tag, and the order is unchanged. With no events there is no section. No horizontal scroll at 360px with the album open.
- **Scope/style:** only js/events-page.js, css/pages.css, the test, the plan and the changelog changed. Tokens are used throughout. The storyboard has no Events screen for Hall ???, and the card reuses the dark-card, dashed-purple look of the approved Home sign.
- [nice-to-have] css/pages.css:5 - the `div.year-jump { display: contents }` wrapper inside `nav.year-jump-row` exists so that the TASK-5 selector still counts only years. A one-line comment saying so would help the next reader.

## Review TASK-21 - 2026-11-23
Result: APPROVED

Round 1. Diff `task/TASK-20-events-hall-bangai..task/TASK-21-admin-moments` (e70f71a). task-21 + task-12 + task-14 = 94 passed (desktop + phone). task-6 fails the same way on site-v1 (BUG-8).

- **Criteria:** all met. The list is in A8 order with Edit, Delete (with a confirm) and up/down moves only within the same year. The form fields are labelled, errors show next to the field with `aria-invalid`, and nothing is saved on error. Ids are `<year|x>-<slug>` with `-2`, `-3`... The draft is in `puzzkezz.moments.draft` with its own base `{sha, text}`. "Discard draft" restarts it (through `addDiscardHook`, from GitHub when there is a token). Publish puts `data/moments.json` (A8 order, 2-space indent, trailing newline) in the same single tree and commit. The stale check uses its own base SHA, and an events-only publish does not touch moments.json (tested). The rules are reused from js/bangai.js (`validateMoment` / `sortMoments` / `cleanMoments`), so there is one copy.
- **Security:** moment text is shown with `textContent` only. There is a test with an HTML caption. The token rules are unchanged: the token is only passed to `githubFetch`, and nothing token-related goes into the draft or the logs.
- **Storyboard:** there is no Moments screen. The panel reuses the approved event list and form patterns of /admin/. This is acceptable. The storyboard-creator may add a screen later.
- [nice-to-have] js/admin/moments-draft.js:206 - the base text is `formatMoments(list)` of the raw file, but the draft is `cleanMoments(list)`. If the live file ever holds an invalid moment, the panel shows "data/moments.json changed" right away, and the next publish drops that moment without saying so. Consider showing a note naming the skipped moments.
- [nice-to-have] js/admin/moments-draft.js:270 - moments read back from localStorage are not run through `validateMoment`. TASK-22's publish-time `validateMoment` check now covers what gets committed, so this is only about the panel.

## Review TASK-22 - 2026-11-23
Result: APPROVED

Round 1. Diff `task/TASK-21-admin-moments..task/TASK-22-moment-photos` (c66dc93 + merge 726206e). task-22 + task-21 + task-13 + task-15 + task-16 = 190 passed. task-7 / 12 / 14 / 18 = 104 passed. task-1..5, 8..11, 19, 20 = 145 passed, 3 skipped, and 6 failed, which are exactly the BUG-8 tests that also fail on site-v1. All runs were desktop + phone with system Chrome.

- **Criteria:** all met.
  - **Uploader:** "Moment photo" uses `makeSitePhoto(file, 'webp')`, the same pipeline as the other uploads: 1200px longest side, never enlarged, q0.85, `watermarkLayout` / `WM_DIVISOR`, and the TASK-15 marker. The test checks 1200x800, the marker contents and watermark pixels in all 9 cells. The path is `media/moments/<id>.webp`, or `-2`, `-3`... when the name is taken. "Use for moment" saves the moment and adds the file to the pending list, which counts towards the 20-photo limit. Download works.
  - **Publish:** `momentPathProblem` allows only `media/moments/<own id>(-n).webp` of a draft moment that uses exactly that path. Anything else is refused before any request (tested).
  - **Removal:** `isRemovableMoment` is limited to `.webp` files directly in `media/moments/`, only when moments.json is in the commit, and never when the tree is truncated. Files used by any event or moment, and files new in this publish, are never removed. The removal goes through the same dialog, the same guard and the same single commit.
  - **Broken links:** `brokenMomentPhotoLinks` stops the publish with no write.
  - **Remove from publish:** puts back the published photo, or clears it.
  - **Repo guard:** checks `data/moments.json`. The self-test covers a missing and an unmarked file.
- **Programmer notes (1)-(4)** in the TASK-22 status line: (1) a separate "Moment photo" block, not an 8th picker option; (2) no storyboard screen; (3) a file used by a moment is never removed by an events publish, and the other way round; (4) a moment with no photo and no link stops Publish. All four are accepted, implemented as described, and tested.
- **Security:** the publish-time `validateMoment` also re-checks links (http/https only) and photo paths of draft moments, so a tampered localStorage draft cannot commit a `javascript:` link. All new admin text is set with `textContent`. No token handling changed.
- [nice-to-have] admin/index.html:354 - `#mp-for` has `role="status"` and is re-rendered on every keystroke in the Moments form (because the new-moment id follows the caption). Screen readers will announce it over and over. Drop `role="status"`, or announce only when the target moment changes.
- [nice-to-have] js/admin/publish.js (render, `expectedMomentRemovals`) - the Publish preview lists only old moment photos taken from the base moments.json. The real run also removes stray `.webp` files found in the `media/moments/` tree. The confirmation dialog shows the full list before anything happens, so this is only a preview gap.

## Review TASK-23 - 2026-11-24
Result: CHANGES REQUESTED
Diff `site-v1...task/TASK-23-admin-polish` (code 158011b, plan a732f91, storyboard 54cd3b1). Tests run with system Chrome on a separate port: task-23, task-18, task-7, task-16, desktop and phone: 130 passed, 6 skipped (project-only tests). Checked and fine: (1) X on every `#wm-previews` card from the moment it appears, real `<button type="button">`, `aria-label="Remove <file>"`, `aria-hidden` cross, 44px, focus ring token, old "Remove" button gone, Site/Moment photo blocks untouched; pending card asks first and reuses `undoAttach` through `pendingHooks` (no second copy of the revert logic); a card removed while processing is dropped at each await; X on a pending card is disabled while a publish runs. (2) `folds.js` no longer opens GitHub for "none" or Publish for a pending count; GitHub opens on `err`, Publish on the six result/progress boxes being shown. (3) one-column `.event-row` grid under 768px, buttons Edit, up, down, Delete, left-aligned. (4) DOM order GitHub, Events, Event form, Publish with `display: contents` under 1000px, so Tab order matches; desktop puts Publish back on top with `order: -1`. No token code touched, all new text via `textContent`, no new colours. Test edits in task-7/11/12/13/14/15/16/18/21/22 and qa-idea-12-admin only open a panel first or change the expectations TASK-23 asks for; no assertion was dropped.
- [must-fix] js/admin/watermark.js:500-509 (`removeItem` / `removeNow`) - after X (or Remove in the confirm dialog) the focused card is deleted and keyboard focus falls to `<body>` (checked in Chrome: `document.activeElement` is BODY). The next Tab starts at the top of the long admin page. Move focus on purpose after a removal: to the X of the next card (or the previous one when it was the last), and to the drop zone / `#wm-files` button when no card is left. Add a check to tests/task-23.spec.js.
- [nice-to-have] css/admin.css:210 - `font: 700 1.5rem/1 var(--font-body, inherit)` uses a raw size and a fallback that is never needed. `var(--fs-h3)` (max 1.5rem) or `--fs-h2` with `var(--font-body)` keeps it on the token scale.
- [nice-to-have] css/admin.css:398 - on desktop the Publish panel is shown above the Event form with `order: -1`, so Tab goes Event form then Publish while the eye reads Publish then form. This is the trade-off the plan accepted (DOM order follows the phone order); note it in the task notes so QA does not log it as a bug.
- [nice-to-have] tests/task-23.spec.js ("Comic Fiesta ... not broken in the middle of a word") - the test only checks the title is at most 3 lines high. The width check in `checkPhoneRow` covers the criterion, so this test adds little; consider checking that no line break falls inside a word (for example each client rect of the text starts after a space).

## Review TASK-23 - 2026-11-24 (round 2)
Result: CHANGES REQUESTED
Diff `0b4ca68..HEAD` (4edd9cc). tests/task-23.spec.js with system Chrome on a separate port (4391), desktop and phone: 52 passed, 6 skipped (project-only tests). Round-1 items already approved are not re-raised.
- **Round-1 must-fix (focus after X): fixed.** `removeNow` keeps the index from before the splice and focuses `items[i]` (the card that moved into its place), else `items[i - 1]`, else `#wm-files`. The confirm-dialog path works too: `dialog.close()` returns focus to the X first, then `removeNow` moves it. The two new tests are meaningful and would fail on the old code (focus was BODY). They cover the middle card -> next X, the last card -> previous X, the empty list -> `#wm-files`, and the same through "Remove" in the confirm dialog.
- **Nice-to-haves:** CSS token nit done (`var(--fs-h3)` with `var(--font-body)`). The desktop Tab-order comment was added at css/admin.css:398.
- [must-fix] docs/changelog.md:9-11 - the fix's note "Built again after review (focus after X moves to next card X, else previous, else #wm-files; css token nit; desktop Tab-order comment), waiting for re-review" was also pasted into the TASK-22, TASK-21 and TASK-20 entries. Those entries replaced their own "Built, waiting for review" text. The changelog now gives the wrong history for three other tasks, which is out of scope. Fix: put the TASK-20, TASK-21 and TASK-22 lines back exactly as they were in 0b4ca68 (`git show 0b4ca68:docs/changelog.md`), and keep the change only in the TASK-23 entry.

## Review TASK-23 - 2026-11-24 (round 3)
Result: APPROVED
`git diff 0b4ca68 -- docs/changelog.md` (7d3f230): only the TASK-23 entry differs; TASK-20/21/22 entries are back exactly as in 0b4ca68. Fix commit touches docs/changelog.md only. No open must-fix items.

## Review TASK-24 - 2026-11-26
Result: APPROVED
Diff `docs/TASK-24-plan...HEAD` (afc8d20). Re-ran task-24, task-10, task-12, task-13, task-6, task-7, task-21, task-23 with system Chrome on a separate port (4191), desktop + phone: **302 passed, 0 failed**. Matches storyboard/admin/index.html (fold headers, chips, `Per page` select, pager). Every (a)/(b) criterion checked in code: only Events open on load (static `hidden` + `aria-expanded`, not remembered), `aria-controls`/`aria-labelledby` = title + chip, chevron `aria-hidden`, 44px via `--tap-min`, focus moves to the fold button on collapse, auto-open via one `setFold()` (Edit, New event, Attach, Use for moment), C6 chip texts, C7/C8 size default + `localStorage` in try/catch (`js/admin/paging.js`), C9 pager hidden with 0 events, C10 page rules (add/edit -> `startEdit` page, delete clamps, move follows + focus fallback to Edit, size change keeps first event, Import/Discard page 1, attach/revert keep page), C11 Moments not paged, C12 Export text unchanged. Tokens only; no secrets.
Test edits checked one by one: task-6/10/11 row counts -> chip counts (same model count; desktop rows still visible), task-7 `exact: true` (fold button name now also contains "New event"), task-12 fixed SAMPLE_EVENTS in site + fake repo (same publish assertions; avoids the real data/events.json photo paths the fake repo lacks), task-13/16/23 `showEvent` before Edit, task-21 C6 chip texts, task-23 Tab order now passes the pager + form fold button, Shift press before the focus-ring check (keyboard modality). No assertion was removed or loosened beyond what paging requires. Changelog entry present.
- [nice-to-have] tests/task-24.spec.js:230 - the title says "invalid stored value", but only `"7"` is tested; add `"abc"` as the criterion names it. The throwing-storage test (:241) runs only at 1280 wide, so the phone default (5) under blocked storage is not checked.
- [nice-to-have] tests/task-24.spec.js - not covered: "Remove from publish" / X revert stays on the current page, focus after a move down across a page edge, and "folding does not move panels into another column".
- [nice-to-have] tests/task-6.spec.js:18 etc. - chip-only counts no longer check rendered rows; `expect(rows).toHaveCount(Math.min(n, pageSize))` next to the chip would keep that check.
- [nice-to-have] js/admin/manager.js:591 - `defaultPageSize(0)` / `defaultPageSize(768)` passes made-up widths; let the helper take the media-query result (or `innerWidth`) so the call reads plainly.
- [nice-to-have] css/admin.css:432 - `opacity: 0.5` stacks on the base `.btn:disabled` (line border, muted text, css/base.css:107), so disabled pager buttons are faded twice. It matches the storyboard, but the style guide's disabled rule alone is enough.

## Review TASK-25 - 2026-11-26
Result: APPROVED
Diff `92322c4..origin/task/TASK-25-activity-line` (a1e087a). Read only, Playwright not run (test server in use by another agent). `buildStation()` adds `span.polaroid-activity` right after `.polaroid-caption` with `activities[0].trim()` via `textContent` + `title`; no element for missing / `[]` / blank (an `aria-hidden` `.polaroid-activity-space` keeps the 2-line space, so same-depth heights match); back unchanged; SAMPLE stays on line 1; Hall ??? untouched. CSS: 2-line clamp (`-webkit-line-clamp` + `line-clamp`), `overflow-wrap: anywhere`, `min-height: 2.8em` = 2 x `line-height: 1.4`, `--color-text-2`, `--space-1`, `--fs-small`; tokens only, matches the storyboard `.act` line. tests/task-25.spec.js covers every planned case (first only, none x3, sample, escaping, 120-char and 60-char word, equal heights with and without reduced motion, flip, no horizontal scroll).
- [nice-to-have] css/components.css:141 - `.polaroid-activity` repeats `font-family` / `font-size` already set by the shared rule on line 140; drop them.
- [nice-to-have] tests/task-8.spec.js, tests/task-14.spec.js, tests/task-16.spec.js, tests/fixtures/site-null.json - the BUG-11 test fixes ride in the TASK-25 commit. They are test-only and listed in the changelog, but bugs/BUGS.md still shows BUG-11 as open. Update BUG-11 there (fixed in a1e087a, waiting for QA) so the bug log matches.

## Review TASK-26 - 2026-11-26
Result: CHANGES REQUESTED
Diff `TASK-25..TASK-26` (a6d5e17). Read only. `validateEvent` -> `photosErrors` covers every listed error on field `photos` (not array, 0, >3, non-object, no `photo`, bad `photo` / `photoFull` path, duplicate display path, mirror mismatch for `photo` and `photoFull`); `eventPhotos` (max 3, `photoFull` undefined when blank, old shape -> 1, none -> 0); `normalizeEvent` returns the same object when there is no usable `photos`, else a copy with the mirror; `loadEvents` validates then normalizes. Fixture and tests match the plan. Gallery / Events / admin / hall untouched.
- [must-fix] tests/task-26.spec.js:124 - `expect(real.events.some((e) => 'photos' in e)).toBe(false)` pins the real data/events.json forever. The first time Puzz publishes an event with 2-3 photos from /admin (the point of TASK-27), this test fails in both projects: the same stale-test trap as BUG-11. Fix: drop that line, or replace it with a check that holds for any valid real data (for example every event in data/events.json passes `validateEvent` and `loadEvents` keeps all of them).
- [nice-to-have] js/events-data.js (`photosErrors`) - only the first problem is reported (early `return`). Fine for the loader; if the admin ever shows these to Puzz, listing all of them would help.

## Review TASK-27 - 2026-11-26
Result: APPROVED
Diff `TASK-26..origin/task/TASK-27-admin-photo-slots` (2a24e8b). Read only. Slot rows D1-D3 (`#f-photo` / `#f-photo-full` ids kept, `#f-photo-2/-3`, `#f-photo-full-2/-3`), real `<button>`s with "Move photo Dn up/down" / "Remove photo Dn", 44px via `--tap-min`; up disabled on D1, down on the last filled row; move swaps both paths. Attach fills the next empty slot, is disabled with a hint at 3 (`slotsFull`). `addPendingPair` keys on the display path, so a second attach keeps the first pair. X on a pending slot asks first through the shared `askRemove` (the TASK-23 dialog, moved to js/admin/confirm-remove.js, no copy left behind) and drops the pair; `removePendingItem` does not call the revert hook, so the slot is removed only once. "Remove from publish" removes only that slot with the "Photo D<n> removed from <short> <year> (not published yet)." note; the TASK-16 put-back still runs for a 1-photo event. Save / Export write `photo` / `photoFull` = D1 and `photos` only for 2-3 (E2 / E3), gaps closed; `EXPORT_ORDER` has `photos` after `photoFull`. Publish paths, removal candidates and `brokenPhotoLinks` use every slot (`eventPathEntries`); wm-guard checks `photos`. All new text via `textContent`. Changed specs (task-7/13/16/23) only follow the new "next slot" rule; nothing was loosened beyond that.
Together with TASK-29 (bugfix/BUG-11, 7f6ad13): the two branches touch no common file except docs; the merge is clean. Admin output (`photos` + mirror) is exactly what `normalizeEvent` / `eventPhotos` and the hall read. Once multi-photo data is published, see the TASK-26 must-fix.
- [nice-to-have] js/admin/watermark.js:434 - card hint is "! This event already has 3 photos" (storyboard text). The plan text also has "Remove one first."; add it so the hint says what to do.
- [nice-to-have] js/admin/manager.js:20 / :265 (`showErrors`) - a bad D2 / D3 Display path is reported on `photos` (`#err-photos`), but focus goes to `#f-photo` (D1) and the D2 / D3 input gets no `aria-invalid`. Map "Photo n" errors to `f-photo-n`, and give the D2 / D3 display inputs `aria-describedby` to the error box.
- [nice-to-have] admin/index.html:147 - the D1 labels are "Display photo" / "Full-size photo", while D2 / D3 say "Photo D2 display copy". The visible "D1" is `aria-hidden`, so a screen reader cannot tell D1 apart; use "Photo D1 display copy" / "Photo D1 full-size master" (the id stays `f-photo`).
- [nice-to-have] js/admin/manager.js:250 (`readForm`) - a Full-size path typed into D1 with an empty D1 Display and a filled D2 is dropped without a message (D2 moves up). Treat it like D2 / D3 in `slotErrors()`.
- [nice-to-have] css/admin.css:458 - `.slot-th` text is 9px (`0.5625rem`), too small to read "No photo" / "Not found"; use at least the 0.6875rem used for the chip.
- [nice-to-have] js/admin/manager.js:124 - chip shows for 0 and 1 photo too (storyboard) while the plan criterion says 2 / 3 only. The programmer noted it in the status line; ask the user which one stays so plan and storyboard agree.

## Review TASK-28 - 2026-11-26
Result: APPROVED
Diff `TASK-26..origin/task/TASK-28-hall-pc-pile` (3e15b3c). Read only. Shared markup: `.pile` with one `.pl` flip card per photo in `eventPhotos` order, day label `D<n>` `aria-hidden`, alt `<name> <year>, day <n>`, back eyebrow "· Day n", same caption + TASK-25 line on each; 0-1 photo stations go through the old path unchanged. Pile toggle: `aria-expanded`, `aria-controls` = pile id, labels "... Show all photos" / "... Stack the photos"; photos `inert` while piled. IntersectionObserver hysteresis (`nextOpen`, `openThreshold` pure and exported), manual toggle pauses until ratio 0, focus moves to the toggle and flipped photos flip back on close. Transforms only, durations as new tokens in css/tokens.css (`--dur-spread`, `--dur-stagger`, `--dur-collapse`), reduced motion = spread, no transitions. Stage keeps one size (grid stack + transforms), so no layout shift. Only D1 of the first 2 stations is eager. Follows the storyboard CSS closely.
- [nice-to-have] css/home.css:306 - at 1100px and up the spread offset is `--w * .86` (275px at depth near) while the polaroid is 320px wide, so D1's frame covers about 20px of D2's photo. The plan says "not overlapping their photo area"; the approved storyboard has the same numbers. Either raise `--k` to about .95 (check 1280 still has no horizontal scroll) or note the storyboard wins. tests/task-28.spec.js:141 allows 80px of overlap, which is looser than the criterion.
- [nice-to-have] js/hall-pile.js:68 + :109 - with reduced motion, a pile the visitor stacked by hand spreads again after the station leaves the view (`manual` is reset, then `setOpen(true)`). The criterion says no scroll automation under reduced motion; keep `manual` when `reduce.matches`.
- [nice-to-have] css/home.css:278 - `.pile.open .pile-toggle { pointer-events: none; }` means a mouse user cannot click to stack again (only keyboard or scrolling away). Matches the storyboard, so not blocking.

## Review TASK-29 - 2026-11-26
Result: CHANGES REQUESTED
Diff `TASK-28..TASK-29` (2323ebb). Read only. `storyFrame(elapsed, n)` is a clean pure rule (round, day, fills, done; reset to D1 with all fills 0 in the same frame; done at 2 x n x 1.5 s). The controller has states idle / playing / paused / done / stopped kept in memory only (reload plays again), drives the fill from elapsed time through `--p` + `clip-path` (no free CSS animation, no transition back to 0), pauses under 60% / `visibilitychange` / while flipped and resumes from the same point, stops for good on click, Enter / Space, arrows, Home, End. Tabs: `role="tab"` buttons in the tablist, `aria-selected`, roving `tabIndex`, `aria-controls`; panels get `role="tabpanel"` + `aria-labelledby`, hidden ones `inert` + `aria-hidden`; fill layers `aria-hidden`; no `aria-live`, no pause button (accepted trade-off, not flagged). 200 ms opacity crossfade (`--dur-xfade`), reduced motion = no auto-flip, no fills. 768px switches to the pile live. Photos 2-3 stay lazy.
- [must-fix] css/home.css:243 + tests/task-29.spec.js:320 - the tab row is 44px plus `margin: 0 0 var(--space-2)`, so a 3-photo station is about 52px taller than a 1-photo station of the same depth. The criterion (and the planned test) is "grows by at most 44px"; the test was widened to `44 + 8 + 2`. Fix: take the 8px back (for example a negative bottom margin as in the storyboard's `.dtabs`, or remove the gap) and put the test bound back to 44 (+1px rounding). If the gap must stay, the planner / user has to change the criterion first; the test should not be loosened on its own.
- [nice-to-have] css/tokens.css:68 - `--dur-story` is not read anywhere (JS uses `STEP`). Either read it in JS (`getComputedStyle`) or drop the token and keep the comment on `STEP`.
- [nice-to-have] js/hall-pile.js - `data-story-ms` / `data-story-round` are test hooks on the live page; fine, but say so in a short comment next to `data-story-state`.

## Review TASK-26 - 2026-11-26 (round 2)
Result: APPROVED
Fix commit 5201028 (fix/review-qa-v1.2.0). Read only, earlier approved points not re-checked.
- Round-1 must-fix (tests/task-26.spec.js:124, test pinned the real data/events.json to "no `photos` key"): fixed. The assertion is gone. A new test checks that every real event passes `validateEvent` and that `loadEvents` keeps all real ids, so publishing 2-3 photo events from /admin keeps it green. The failure test (`loadEvents` -> [] on 500) still exists as its own test. Only the spec, plan status and changelog changed; no product code.
- Ran only tests/task-26.spec.js + tests/task-29.spec.js (both projects): 31 passed, 17 skipped (project-only tests), 0 failed. Note: this worktree's Playwright 1.56.1 expects chromium_headless_shell-1194 but /opt/pw-browsers has build 1243, so a plain `npx playwright test` fails at browser launch. The run used a scratchpad config with `executablePath` on the installed build and a private port; no repo file changed.

## Review TASK-29 - 2026-11-26 (round 2)
Result: APPROVED
Fix commit b3e11b2 (fix/review-qa-v1.2.0). Read only, earlier approved points not re-checked.
- Round-1 must-fix (css/home.css:243 + tests/task-29.spec.js:320, station grew 52px, test loosened): fixed. `.dtabs` margin is now `calc(var(--space-2) * -1) 0 var(--space-2)`. The -8px top takes back the bottom gap, so the box adds exactly the 44px tab row. The -8px falls inside the 40px `.station-inner` gap under the sign (32px left), so nothing overlaps, and the 8px gap between the tabs and the polaroid stays. Tabs keep `height: var(--tap-min)`. Uses tokens only. The test bound is back to `44 + 1` with the `>= 44` lower bound kept, and it passes on the phone project.
