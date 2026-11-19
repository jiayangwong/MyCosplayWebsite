# Release report - proposed v1.0.0 (2026-11-19)

Status: READY FOR THE USER'S DECISION. Nothing was deployed, pushed, tagged or merged into `main`. Checked on `site-v1` at d9f03da.

## Results
| Check | Result |
|---|---|
| All tasks Done (TASK-1 to TASK-17) | PASS with a note: TASK-7, 10-17 are `Review: approved` + `QA: passed`. TASK-1 to TASK-6, 8, 9 are `done` but their Review/QA lines still say "pending" in docs/plan.md (built before the storyboard approval; the plan's own bookkeeping was never updated). They are covered by passing automated tests. |
| No open critical/major bugs | PASS. BUG-1 to BUG-6 and the task-9 flake are all minor and all `verified`. None open. |
| Full test suite (`--workers=2`) | PASS. 359 passed, 3 skipped, 0 failed (6.1 min, desktop + phone). |
| Secret scan, `git grep -nE "github_pat_\|ghp_"` | PASS. Hits only in docs, the token-refusal code (js/admin/github-token.js), and tests that use `github_pat_TESTONLY_not_a_real_token` / `ghp_TESTONLY`. No real token. The repo-scan test (tests/task-11.spec.js) passes. |
| No unwatermarked photo of the user | PASS. There is no `media/` folder yet. No photo files exist in the repo at all. Image files: 9 docs screenshots, og-image.png, extra_asset sashisuseso-reference.png (text only), 3 tests/fixtures flat colour PNGs. All are in the allowlist or are test fixtures, none show the user. Guard tests pass. |
| CNAME vs share image | PASS with a note. CNAME = `puzzkezz-testing.loc.cc` (same on `main`). `og:image` is a relative `og-image.png` (76 KB, a site screenshot, not a photo). Some scrapers want an absolute URL; a relative one may not show in a link preview. Low risk, not a blocker. |
| Links / meta / 404 / 375px | PASS (covered by tests/task-9 and per-page tests: titles, descriptions, favicon, og tags, 404.html, no sideways scroll at 375px). No image is over 500 KB. No WebP needed yet (no photos). |

## What a visitor to the public repo can see
The repo https://github.com/jiayangwong/MyCosplayWebsite is PUBLIC. Anyone can read: all site code, the admin page code, `data/events.json` (8 sample events), docs, the plan and ideas, the agent definitions, bugs log, tests, `cosplay-agent-team.zip`, the extra_asset design files, and the full git history (74 commits). No token, no unwatermarked photo. The contact email in `js/site-config.js` is the placeholder `hello@example.com`. `/admin/` is on the live site without a password; it is hidden from search (robots.txt, noindex) and can only publish in a browser that holds the user's token. Photos published later will be public in the repo and in git history, which is why the uploader only creates watermarked files.

## How deploy works (read-only findings)
- GitHub Pages is on, legacy "deploy from branch" build. `gh api` shows the source branch is **`site-v1`**, folder `/`, custom domain `puzzkezz-testing.loc.cc`, custom 404 on, status "built". `site-v1` is also the repo's default branch. No workflow files exist.
- So deploying means **pushing `site-v1`** to origin. Local `site-v1` is 87 commits ahead of `origin/site-v1` (which is at 873a230, the old "coming soon" state). No merge into `main` is needed for the live site. `main` (test page + CNAME) is not what Pages serves. If the user wants `main` to be the real branch, that is a separate decision (merge + change the Pages source).
- Live URL after deploy: http://puzzkezz-testing.loc.cc/ (and the same with https once the certificate works). Pages normally updates in 1-2 minutes.
- Problem found: Pages reports HTTPS certificate state `bad_authz` ("ACME authorization is in a bad state") and "Enforce HTTPS" is off. The admin publishes to the GitHub API so it is not affected, but visitors on http only get no padlock. I could not reach the site from this machine to confirm. The user may need to remove and re-add the custom domain in the repo's Pages settings, then tick Enforce HTTPS, and check the DNS record for the domain.
- Rollback: there is no previous release tag. Rollback point = `origin/site-v1` 873a230 (old coming-soon page); or the `main` branch (535ca02). Redeploy by force-pushing is not recommended; use `git revert` instead.

## Proposed release notes (v1.0.0 - first public release)
Puzz Kezz cosplay website, first version.
- Home: a walk through a convention hall with a guest pass, polaroids and a year-by-year timeline (newest first).
- Events: every con grouped by year, with Instagram / YouTube / TikTok posts that load only when clicked.
- Reels: the five さしすせそ reels with pronunciation (furigana, romaji, meaning).
- Gallery, About and Contact pages, a 404 page, share image and favicon. Works on phone and PC.
- Admin page (`/admin/`): add and edit events, upload photos with an automatic watermark (full-size master plus a 1200px copy, location data removed), choose the portrait, reel covers and share image, and Publish everything to GitHub in one step. Publish refuses broken photo links and unwatermarked files.
- Photo viewer: shows the light copy first, then swaps in the full-size one.
- The 8 events shown are samples and are marked "Sample".

## Before deploying, the user must / may decide
1. Say yes or no to the deploy (push `site-v1`).
2. Decide whether `main` stays as it is (yes is fine; Pages serves `site-v1`).
3. Decide if the public repo may keep `cosplay-agent-team.zip`, docs, ideas and design files visible, or if the repo should go private (Pages on a private repo needs a paid plan).
4. Supply the real contact email (now `hello@example.com`, shown on Contact).
5. Fix the HTTPS certificate as described above (user does this in GitHub settings).

## After deploy (the user)
1. Create a fine-grained GitHub token: GitHub > Settings > Developer settings > Fine-grained tokens; only the repo `jiayangwong/MyCosplayWebsite`; only Contents: Read and write; set an expiry. Never a classic `ghp_` token (the admin refuses it). Paste it into `/admin/` > GitHub panel > Save token > Test connection.
2. Upload the first photos in `/admin/` (uploader), attach them to events, set the portrait, reel covers and share image, then Publish. First real photo of the user will replace the placeholder og-image only when the share image is published.
3. Replace the 8 sample events with real ones (edit or delete in admin, then Publish). Until then they show "Sample". Deleting an event with photos asks for confirmation before removing files.
4. Wait 1-2 minutes after each Publish (up to about 10 minutes for browser cache when a photo keeps its file name).
5. Add the real reel links.

## Unclear or open
- Admin is public (no password). Plan question 8 asked whether to keep it out of the deployed site; the user's answer is not recorded in this check.
- Review/QA lines for TASK-1 to 6, 8, 9 still read "pending" in docs/plan.md. Tests pass, but a formal reviewer/QA sign-off was not recorded for them. The user may accept this or ask for it.
- HTTPS certificate state (above). Could not test the live site from here.
- Version number and tag: not created. After a yes, tag `v1.0.0` on the deployed commit.
