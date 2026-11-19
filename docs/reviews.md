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
