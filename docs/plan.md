PLAN APPROVED: 2026-11-18

# Plan - Puzz Kezz website, version 1

- Written: 2026-11-17 by the planner
- Source: docs/ideas.md (GLOBAL NOTES + IDEA-3, IDEA-5, IDEA-6, IDEA-7, all `ready-for-planning`)
- Revised: 2026-11-18 by the planner for IDEA-8 (Publish to GitHub from /admin/) and IDEA-9 (full-resolution master + display copy, tiled watermark). Changed: goal, sitemap admin row, footer note, F8/F9 (+ new F11), the Event manager / Media rows and a new Publishing row in Tech choices, the `photo` / `photoFull` data fields, TASK-7 (reopened, rewritten). New: TASK-10 to TASK-13. New open questions: 13-14.
- Revised again: 2026-11-18 by the planner after the user answered questions 13 and 14. Display copy is now **1200px** on the longest side (was 1600px): TASK-7, the data notes, the Media row and the size estimates were updated. Publish now **deletes old, unused photo files** under `media/events/` in the same commit, after a confirmation step: F8/F9, the Publishing row, the security rules, the limits and TASK-13 were updated (TASK-12's call list gets one extra read call, see TASK-13). Both questions moved to "Already decided".
- Revised: 2026-11-18 by the planner (user-requested design change): new watermark style, a white dashed ±45 degree lattice with hearts at the crossings and `@notpuzzkezz` along the up-right lines (replaces the -30 degree tiled text rows). Changed: goal, F9, the Media row, TASK-7 criteria and tests. Spec matches docs/style-guide.md; reference drawing is storyboard/wm.js. Plan stays approved.
- Revised: 2026-11-18 by the planner (user-requested tweak): the lattice watermark is kept (hearts, up-right text direction confirmed) but made about 3 times as dense. Only the size rule changed: `f` = round(shorter side / 120), min 8px (was 2.5% of the shorter side, min 12px); everything else stays relative to `f`. Changed: F9, the Media row, TASK-7 criteria, note and test numbers. On the 1200px display copy the name is about 8px tall (a texture); it is readable on the full-size master (user informed). Spec matches docs/style-guide.md and storyboard/wm.js. Plan stays approved.
- Revised: 2026-11-18 by the planner for IDEA-10 (every photo of Puzz is watermarked, everywhere). New: section "IDEA-10 addition" (sitemap/flow additions, `data/site.json`, the watermark marker, the honest limit), TASK-14 (Site photos: portrait, reel covers, share image), TASK-15 (watermark marker + Publish check + repo guard test), open questions 15-18, and a new build-order line. Changed: the Media row and F9 now say the density is OPEN (2x or 3x); TASK-7 gets a density note and one-constant rule. The IDEA-10 part was approved by the user on 2026-11-18 (see the next line).
- Revised: 2026-11-18 by the planner after the user answered questions 15-18 and wrote "Plan approved and storyboard approved". Density is **2x**: `WM_DIVISOR` = 80, so `f` = round(shorter side / 80), min 8px. Changed: F9, the Media row, TASK-7 criteria, note and test numbers, the build-order lines. Share image: the site screenshot stays until a photo is uploaded. Portrait and reel covers: one 1200px file each. GitHub Action check on every push: out of scope (future idea). Questions 15-18 moved to "Already decided". TASK-14 and TASK-15 are approved. Review/QA lines no longer wait for STORYBOARD APPROVED (docs/approval.md now contains it).
- Revised: 2026-11-19 by the planner for IDEA-11 ("Remove from publish" can break an event photo and delete its old photo). New: TASK-16 (both protections, option (c)), open questions 19-20, and a new build-order line (TASK-16 before TASK-15). TASK-16 is **proposed, waiting for user approval**; the rest of the plan stays approved.
- Revised: 2026-11-19 by the planner after the user wrote "TASK-16 approved, yes" (answers to questions 19, 20 and 22: yes to all). TASK-16 is **approved** and now also covers site photos (BUG-4: a portrait or reel cover link to a file that is not on GitHub). New: TASK-17 (repo guard accepts a marked file whose allowlist hash is stale, question 22 (b)). Build order: TASK-16 -> TASK-17. Questions 19, 20 and 22 moved to answered.
- Revised: 2026-11-23 by the planner for IDEA-12 (Hall ??? 番外 bangai). New: section 7 "IDEA-12 addition" (planner assumptions A1-A9, `data/moments.json` format, TASK-19 to TASK-22, questions 23-26). Task numbers start at 19 because TASK-18 (admin layout) is already used in docs/changelog.md. TASK-19 (Home part) is **already built on branch `feature/hall-bangai` (commit 7988c22) but not reviewed, not QA-tested and its tests have never been run**. The IDEA-12 tasks are **PROPOSED and wait for the user's approval**. The rest of the plan stays approved.
- Out of scope for v1: IDEA-1 (wardrobe), IDEA-2 (gacha), IDEA-4 (petal storm)
- Out of scope / future idea: an automatic GitHub Action that runs the watermark repo guard on every push (user answer to question 18, 2026-11-18). Goes to the idea-collector later.
- Visual concept: "Concept 6B" on the design canvas "Puzz Kezz homepage concepts"
- Status: **APPROVED by the user on 2026-11-18** - the whole plan, including the IDEA-8 / IDEA-9 revision (TASK-7 rewritten, TASK-10 to TASK-13) and the IDEA-10 addition (TASK-14, TASK-15, 2x density). **TASK-16 (IDEA-11 + BUG-4) and TASK-17 (question 22) were approved by the user on 2026-11-19.**

### Branch note (this job only)
The integration branch is **`site-v1`**. It takes the place of `main`, because the real `main` is checked out somewhere else. Each task branch (for example `task-3-home-hall`) is created from `site-v1` and merged back into `site-v1`. Wherever CLAUDE.md says "main", read `site-v1`.

---

## 1. Goal

Build a fast static portfolio site for Puzz Kezz, a Malaysian cosplayer who crossplays female characters and likes Lolita. It should feel like his own space, not like SleepyStella's. The visual tone is about 3-4 on the 1 (feminine) to 10 (masculine) scale: bold gothic sans, mono labels, ink outlines, square-ish corners, and baby pink and purple only as accents. The home page is a convention-hall walk-through (Concept 6B). Visitors scroll past hanging hall signs and polaroids of his cosplays. A "YOU ARE HERE" strip runs along the bottom of the hall as a newest-first timeline that shows years only. The hall ends at the さしすせそ reel section, which is there to get people watching his reels. Every Japanese word on the site shows how to say it: furigana over kanji, then romaji, then English, plus a speaker button. Events are not hard-coded. Puzz enters them on a private, browser-only event manager page, along with photos. Each photo is turned into two watermarked files (a full-resolution master for the photo viewer and a display copy of 1200px on the longest side for page layouts), both with a white dashed diagonal lattice watermark (hearts at the crossings, `@notpuzzkezz` along the lines). Because there is no database, the content lives in JSON files committed to the repo. Puzz publishes his changes from the event manager with one button ("Publish to GitHub"), which makes a single commit through the GitHub API using a token that only lives in his own browser. The same commit removes old photo files that no event uses any more, after he confirms the list. Export/Import of `events.json` stays as a backup.

---

## 2. Sitemap / screens

Public tabs, in this order: HOME · GALLERY · REELS · EVENTS · ABOUT · CONTACT

| Path | Screen | Contents |
|---|---|---|
| `/index.html` | HOME | Header. Hero hall walk-through: a steel truss across the top, a hanging hall sign for each event (`HALL A · COMIC FIESTA`), and event polaroids at different depths (near = big, far = small). Polaroids flip to a dark "Watch reel" card. Year marker signs appear wherever the year changes. Intro: a con **GUEST PASS** on a lanyard reading `PUZZ KEZZ` / `COSPLAYER · LOLITA · MALAYSIA` / "Not a beatboxer. Just here to cosplay.", a "Watch my reels" button, and one subtle lace edge. A sticky **YOU ARE HERE** strip at the bottom of the hall works as a descending year timeline (year labels only, small ticks for events). A persistent "Skip to reels" button. The hall ends at the `END OF HALL · 5 REELS` sign, followed by the さしすせそ reel section. Footer. |
| `/gallery.html` | GALLERY | Grid of the event display photos (`photo`) from `data/events.json`, newest first. Each caption shows the event short form, the full name, and the year. Clicking a photo opens a viewer that shows the display copy at once and then swaps in the full-resolution master (`photoFull`) when it has loaded. If there are no photos yet, an empty-state message shows. |
| `/reels.html` | REELS | The full さしすせそ section: header with pronunciation, the "Sound on" button, and 5 reel cards. Five in a row on PC, a swipe carousel on phone. |
| `/events.html` | EVENTS | Events grouped by year (newest year first), with a jump row for the years. Each event card shows the date, short form, full name, venue (if set), the activities list, and media (click-to-load embed, preview photo, or placeholder). Each card can be linked to as `events.html#<event-id>`. |
| `/about.html` | ABOUT | Simple v1 page: heading, a portrait placeholder, and bio text marked `[placeholder]`. No invented facts. |
| `/contact.html` | CONTACT | Simple v1 page: "Collabs & bookings" text `[placeholder]`, a mailto link `[email placeholder]`, and social links. No form (there is no backend). |
| `/admin/index.html` | Event manager (not public) | Not in the nav. Has `noindex`. Event list (edit / delete / move up / move down), event form (incl. display photo + full-size photo paths), validation, localStorage draft, Import / Export `events.json` (backup), embed preview, the media uploader (two watermarked files per photo: full-res master + display copy), a **GitHub** panel (paste token / Test connection / Forget token), and a **Publish to GitHub** button with a list of pending changes, progress, and the result (commit link or a clear error). |

Shared on every public page:
- **Header (PC, width 900px or more):** the PUZZ KEZZ wordmark linking to Home, the 6 tabs with an underline under the active tab (`aria-current="page"`), and an Instagram button.
- **Header (phone, under 900px):** the wordmark and a **MENU** button. MENU opens a full-screen menu that lists each tab with a subtitle under it:
  - HOME - "Walk the hall"
  - GALLERY - "Cosplay photos"
  - REELS - "さしすせそ · sa shi su se so"
  - EVENTS - "Meet me at the con"
  - ABOUT - "Who is Puzz"
  - CONTACT - "Collabs & bookings"

  Social links sit at the bottom of the menu, with a CLOSE button.
- **Footer:** social links, `© <year> Puzz Kezz`, and a note: "Photos watermarked. Please ask before reposting."

---

## 3. User flows

**F1 - First visit, walking the hall (main flow)**
Home -> read the guest pass -> scroll down: the camera moves forward through the hall and the newest events come first -> the YOU ARE HERE strip shows the current year and position -> pass year markers (2026 -> 2025 -> 2024) -> reach `END OF HALL · 5 REELS` -> tap a reel card -> Instagram opens in a new tab.

**F2 - In a hurry**
Home -> "Watch my reels" (on the guest pass) or "Skip to reels" -> jump straight to the さしすせそ section -> tap a reel.

**F3 - Polaroid to video**
Home -> tap or click a polaroid -> it flips to the dark "Watch reel" card -> tap "Watch reel" -> the event's social link opens in a new tab. If the event has no link, the flip side says "See event" and goes to `events.html#<id>`.

**F4 - Timeline jump**
Home -> click a year label or an event tick on the YOU ARE HERE strip -> the page scrolls to that year marker or event in the hall.

**F5 - Learning the Japanese**
Reels (or Home) -> read the furigana, romaji, and English -> press the speaker button -> the browser says the word in Japanese.

**F6 - Checking his con history**
EVENTS tab -> pick a year in the jump row -> read an event card -> click the video facade -> the embed loads and plays.

**F7 - Phone navigation**
Any page -> MENU -> the full-screen list appears -> tap EVENTS -> the Events page opens with the menu closed.

**F8 - Puzz adds a new event (admin)**
Go to `/admin/` (typed URL or bookmark) -> the published events load (from the draft if one exists, otherwise from `data/events.json`) -> "New event" -> fill in the date, short form, full name, venue, activities, and social link -> the embed preview appears -> Save (the draft goes to localStorage) -> the Publish panel lists "data/events.json changed" -> "Publish to GitHub" -> if the change leaves old photo files unused (for example he deleted an event that had photos), a confirmation lists them ("These N old files will be removed") -> he confirms (or cancels, and nothing is changed) -> progress shows -> success message with a link to the commit and "The site updates in about 1-2 minutes" -> GitHub Pages redeploys -> the new event appears in the hall, the timeline, the Events page, and the Gallery.
- Backup path (no token, or GitHub is down): "Export events.json" -> the file downloads -> he replaces `data/events.json` in the repo and commits/pushes by hand.
- Stale path: if the repo changed since the draft was started (another device, a hand commit), Publish refuses with "The site changed since you started editing. Export a backup, then reload." -> he exports, reloads, and redoes or imports his changes.

**F9 - Puzz adds watermarked photos (admin)**
Admin (best on a desktop browser) -> select an event -> Media uploader -> pick one or many images -> for each photo two WebP files are made, both with the white dashed diagonal lattice watermark (±45 degree lines, a small heart at every crossing, `@notpuzzkezz` along the up-right lines; size unit `f` = round(shorter side / 80), min 8px (2x density, user decision 2026-11-18): on a 1200 x 800 display copy the name is about 10px tall, on the master it is clearly readable) at 40% opacity (text and opacity can be changed): a full-resolution master and a display copy (longest side 1200px) -> previews show both sizes and file sizes -> "Attach to selected event" -> the event's `photo` becomes `media/events/<event-id>/<name>.webp` and `photoFull` becomes `media/events/<event-id>/<name>-full.webp` -> the pair is listed as pending in the Publish panel -> "Publish to GitHub" -> if the event had an older photo pair that nothing uses any more, a confirmation shows "These 2 old files will be removed" with the paths -> Confirm (or Cancel: nothing is sent, the pending pair stays) -> one commit adds the JSON and both new image files and removes the old files.
- Backup path: "Download" / "Download all" saves both files of each pair -> he commits them by hand at the shown paths together with the exported events.json.
- Too-large path: if a photo is too big for the browser (for example on iPhone), that photo shows "Too large for this browser. Please use a desktop browser (Chrome, Edge or Firefox)." and the other photos still work.

**F11 - First-time GitHub setup (admin, once per browser)**
Admin -> GitHub panel -> "How to get a token" help (create a fine-grained personal access token on github.com: only the repo `jiayangwong/MyCosplayWebsite`, permission Contents: Read and write, with an expiry date) -> paste the token -> "Save token" -> "Test connection" -> "Connected to jiayangwong/MyCosplayWebsite (site-v1). Write access is checked when you publish." -> later, "Forget token" removes it from this browser.

**F10 - Reduced motion**
A visitor has `prefers-reduced-motion: reduce` -> Home shows the hall as a normal stacked list (signs and polaroids in date order, no camera movement or parallax). Everything else works the same.

---

## 4. Tech choices

The user said "u decide languages, skip db for now". The main session decided the following, and the planner agrees.

| Choice | What | Why |
|---|---|---|
| Site type | Static site: HTML5 + CSS (custom properties) + vanilla JavaScript ES modules. No framework, no build step. | Small site. Nothing to compile, fast on phones, and easy for any agent (or Puzz) to edit. |
| Hosting | GitHub Pages, with a custom domain from the existing `CNAME` (`puzzkezz-testing.loc.cc`). | Free, HTTPS, and it deploys on push. |
| Data | No database. `data/events.json`, `data/reels.json`, and `js/site-config.js` (name, handle, social URLs) are committed to the repo. | Fits "skip db". Version-controlled, and it can move to a real CMS or database later without changing the page code much. |
| Event manager | `/admin/` runs 100% in the browser. Drafts are kept in `localStorage`. Changes go live through "Publish to GitHub" (see Publishing). Export/Import `events.json` stays as a backup. | No server needed. The page is public but harmless without a token: anyone can open it, but only a browser that holds Puzz's token can publish, because GitHub rejects everyone else. |
| Publishing (IDEA-8) | GitHub REST API, Git Data endpoints, called with `fetch` from `/admin/` to `https://api.github.com` only. Target: repo `jiayangwong/MyCosplayWebsite`, branch `site-v1`, the branch GitHub Pages serves (set in `js/admin/github-config.js`, not in the token). One publish = one commit: create blobs -> create tree (`base_tree` = current tree; old unused photo files are removed in this same tree with `sha: null` entries, see TASK-13) -> create commit (parent = current head) -> update `refs/heads/site-v1` with `force: false`. Auth: a **fine-grained personal access token** limited to this one repo with **Contents: Read and write** only, pasted once by Puzz and stored only in that browser's `localStorage` (key `puzzkezz.github.token`), with a "Forget token" button. | No server, no OAuth app (Decap CMS needs an external OAuth server, rejected in IDEA-8). One atomic commit means the site never shows half an update, and `force: false` plus a stale check means a publish can never overwrite someone else's push. See the security notes below. |
| Media (IDEA-9) | Canvas in the browser. Per photo, two WebP files, **both watermarked** (user decision 2026-11-18): **master** at the original pixel size (quality 0.95) and **display copy** with a longest side of 1200px (quality 0.85, never enlarged; user decision 2026-11-18). Watermark: a white dashed diagonal lattice (lines at +45 and -45 degrees) over the whole image, a small upright heart at every crossing, and `@notpuzzkezz` written along the up-right lines between crossings (the line is broken around the text); the whole layer at 40% opacity. All sizes come from `f` = round(shorter side / 80), min 8px (**2x density**, user decision 2026-11-18, question 15; the divisor is the one constant `WM_DIVISOR` = 80), so the pattern has the same proportions on both files. On a 1200 x 800 display copy `f` = 10, so the name is about 10px tall (small, but more readable than a texture); on a 6000 x 4000 master `f` = 50 and it is clearly readable. Spec in docs/style-guide.md; reference drawing storyboard/wm.js. | No upload service. Redrawing on a canvas removes EXIF data, including GPS location. Unwatermarked originals never leave the browser. 1200px keeps pages fast (about 100-300 KB per photo). Layout slots are at most about 800 CSS px wide, so 1200px is sharp on normal screens and phones and only slightly soft on the biggest slots of high-resolution screens; the full-size master in the viewer covers close-up looks. |
| Embeds | The platform is detected from the URL. YouTube -> `youtube-nocookie.com/embed/<id>`. Instagram post/reel -> `instagram.com/(p\|reel)/<id>/embed`. TikTok -> `tiktok.com/embed/v2/<id>`. Anything else (Facebook and others) -> preview photo + external link (`target="_blank" rel="noopener"`). Every iframe sits behind a click-to-load facade. | No third-party scripts or cookies until the visitor asks, and a fast first load. Facebook embeds need their SDK, so they are skipped in v1. |
| Pronunciation audio | Web Speech API (`speechSynthesis`, `lang="ja-JP"`). The speaker button is hidden if the browser does not support it. | No audio files to record or host. |
| Fonts | Zen Kaku Gothic New (headings and body, covers Japanese) + Space Mono (labels), from Google Fonts with `display=swap`. | Matches 6B. Free, and one font covers both Latin and Japanese. |
| Motion | Native scroll only (no scroll-jacking). A sticky hall stage whose layers are moved with CSS transforms from a `requestAnimationFrame` scroll handler. `prefers-reduced-motion` turns it into a stacked list. | Lighter than 3D, and accessible. |
| Tests | Playwright (already installed). `playwright.config.js` serves the repo root at `http://127.0.0.1:4173` with `desktop` (1280x800) and `phone` (Pixel 7) projects. Each task gets `tests/task-<n>.spec.js`. | Already set up. Covers both PC and phone. |

Suggested file layout:
```
index.html  gallery.html  reels.html  events.html  about.html  contact.html
admin/index.html
css/tokens.css  css/base.css  css/<page>.css
js/site-config.js  js/nav.js  js/events-data.js  js/embed.js
js/pronounce.js  js/hall.js  js/reels.js  js/events-page.js  js/gallery.js
js/admin/manager.js  js/admin/watermark.js
js/admin/github-config.js  js/admin/github-token.js  js/admin/publish.js
data/events.json  data/reels.json
media/events/<event-id>/<name>.webp        (display copy, watermarked)
media/events/<event-id>/<name>-full.webp   (full-res master, watermarked)
media/placeholder/*.svg
robots.txt   tests/task-<n>.spec.js   tests/github-mock.js
```

### Security rules for publishing (IDEA-8) - apply to TASK-11, 12, 13
- The token is a **fine-grained** personal access token: only the repo `jiayangwong/MyCosplayWebsite`, only **Contents: Read and write**, with an expiry date. Classic tokens (`ghp_...`) are refused.
- The token is stored only in `localStorage` key `puzzkezz.github.token` on Puzz's browser. It is never written to the draft, to `events.json`, to any committed file, to the URL, or to the console. The token input is `type="password"` with `autocomplete="off"`, and after saving it is cleared from the input (the page only shows "Token saved, ends in ...xxxx").
- The token is sent only as an `Authorization: Bearer` header to `https://api.github.com`. The admin page sets a Content-Security-Policy meta tag with `connect-src 'self' https://api.github.com`, so the browser blocks any other destination, and `<meta name="referrer" content="no-referrer">`.
- XSS would expose the token, because `/admin/` shares an origin with the public site. So: no third-party `<script>` on any page of the site, and all event text in the admin is rendered with `textContent`, never `innerHTML`.
- Only these paths may be in a publish commit: `data/events.json` and files under `media/events/<event-id>/`. The original uploaded file bytes are never committed, only the two generated, watermarked WebP files. (IDEA-10, approved 2026-11-18: TASK-14 adds exactly `data/site.json`, `data/reels.json`, `media/site/portrait.webp`, `media/reels/<reel-id>.webp` and `og-image.png`, and TASK-15 makes Publish refuse any image file without the watermark marker.)
- Deletions (`sha: null` tree entries) are only allowed for paths that start with `media/events/`, end in `.webp`, and are not referenced by any event's `photo` or `photoFull` in the `events.json` being committed. They are shown to Puzz for confirmation first and go in the same tree as the new files, so the whole publish is one commit or nothing. Deleted files disappear from the live site, but **git history still keeps the old versions** (the repo is public, so they can still be found in its history, and they still count towards the repo's total size).
- Tests mock `api.github.com` with Playwright `page.route` (shared helper `tests/github-mock.js`, an in-memory fake repo). Tests use an obviously fake token such as `github_pat_TESTONLY_not_a_real_token`, never a real one, and never read a token from environment variables. Any request to `api.github.com` that the mock does not handle fails the test, so no test can reach the real GitHub.

### GitHub and Pages limits (planning numbers)
- The Git blob API accepts blobs up to 100 MB. Blobs are sent as base64 (about 33% larger), so the admin refuses any single generated file over **25 MB** and asks for a smaller original. Typical masters are 3-8 MB.
- GitHub has a secondary rate limit of about 80 content-creating requests per minute. One publish allows at most **20 photos** (40 image blobs + events.json blob + tree + commit + ref update, well under 80). More photos are published in batches.
- Blobs are uploaded one at a time, with a progress bar. A `403` or `429` with rate-limit headers stops the publish and shows "GitHub is busy. Wait N minutes and try again." The ref is not touched, so nothing half-published goes live.
- Base64 encoding of big files uses `FileReader.readAsDataURL` (or chunked encoding), not `btoa` on one huge string, to avoid freezing or crashing the tab.
- GitHub Pages sites should stay under 1 GB. With masters at 3-8 MB (plus display copies of about 100-300 KB) that is roughly 150-300 photos. The Publish panel shows the size of the files being added. Because Publish deletes unused photos, replaced photos no longer count towards the published site's size; they do stay in git history, so the repo itself still grows (GitHub recommends repos under about 1 GB too).
- Deleting files needs no blob uploads (only extra entries in the one tree), so it does not count towards the 20-photo / rate-limit budget. A later move to external storage (for example Cloudflare R2) is a future idea, not in this plan.
- iOS Safari limits a canvas to about 16.7 million pixels, and some browsers cannot encode WebP. Full-res processing is meant for desktop; on failure the uploader shows a clear message per photo (TASK-7).

### Data formats (contract for all tasks)

`data/events.json`
```json
{
  "version": 1,
  "events": [
    {
      "id": "2025-12-06-cf",
      "date": "2025-12-06",
      "short": "CF",
      "name": "Comic Fiesta",
      "venue": "[venue placeholder]",
      "activities": ["[cosplay character placeholder]", "Stage"],
      "link": "https://www.instagram.com/reel/XXXX/",
      "photo": "media/events/2025-12-06-cf/cover.webp",
      "photoFull": "media/events/2025-12-06-cf/cover-full.webp",
      "sample": true
    }
  ]
}
```
- Required fields: `id`, `date` (a real calendar date in `YYYY-MM-DD`), `short` (1-12 characters), `name`. Optional: `venue`, `activities` (array of strings, may be empty), `link` (http/https URL), `photo` (relative path), `photoFull` (relative path), `sample` (boolean).
- `photo` = the **display copy** (watermarked, longest side 1200px). Used everywhere a photo sits in a layout: hall polaroids, Events cards and facades, Gallery tiles. The meaning is unchanged from v1, so older data keeps working.
- `photoFull` = the **full-resolution master** (watermarked). Used only when a visitor opens a photo in the viewer (Gallery). If it is missing, the viewer uses `photo`. `photoFull` is only allowed when `photo` is also set.
- Both paths must be relative (no leading `/`, no `://`, no `..`).
- `id` is generated as `<date>-<slug(short)>`. If that id is already taken, `-2`, `-3`, and so on is added.
- **Display order:** date descending. Events on the same date keep their order in the array, so the admin "move up/down" decides ties. Export writes the events already sorted this way.

`data/reels.json`
```json
{
  "header": { "jp": "さしすせそ", "romaji": "sa · shi · su · se · so", "en": "Five reels, five reactions" },
  "reels": [
    { "id": "sasuga", "kana": "さ", "kanaRomaji": "sa", "jp": "さすが！", "romaji": "sa-su-ga!", "en": "Impressive!", "category": "Best cosplay", "url": "", "thumb": "" }
  ]
}
```
- `jp` uses `{kanji|reading}` for furigana. For example, `{知|し}らなかった！` renders as `<ruby>知<rt>し</rt></ruby>らなかった！`.
- If `url` is empty, the card shows "Coming soon" and is not a link.
- `thumb` (IDEA-10, approved 2026-11-18) = the reel cover, always `media/reels/<reel-id>.webp` made by the uploader, or `""` for none.

### IDEA-10 addition: every photo of Puzz is watermarked, everywhere - APPROVED 2026-11-18

Rule: every photo image of Puzz that is committed to the public repo or shown on the site already carries the lattice watermark (the IDEA-9 design) **and** a hidden "made by the uploader" marker. This covers event photos (display copy + master, already planned), the portrait (Home guest pass + About), the 5 reel covers, and the social share image. Unwatermarked originals never leave Puzz's browser.

Sitemap additions:
- `/index.html` HOME: the guest-pass photo slot (`.pass-photo`) shows the portrait from `data/site.json` when set; otherwise the current `[Portrait]` placeholder.
- `/about.html` ABOUT: the portrait slot (`.portrait`) shows the same portrait; otherwise the current placeholder.
- REELS section (Home `#reels` and `reels.html`): each card shows its cover (`thumb`) when set.
- Every page's share preview (`og:image`) stays `og-image.png`. Today it is a site screenshot with no photo of Puzz, and it stays as the share image until Puzz uploads a photo (user answer to question 16). If Puzz uploads a Share image, the uploader writes a watermarked photo to that same path, so no HTML changes are needed.
- `/admin/`: a new **Site photos** panel next to "Attach to selected event", with the targets Portrait, Reel cover (さ / し / す / せ / そ), and Share image.

**F12 - Puzz adds a site photo (admin)**
Admin -> Site photos -> pick a target (for example "Reel cover: す su") -> pick one image -> the uploader makes one watermarked file (same lattice, same `watermarkLayout`, plus the hidden marker) and shows a preview with size -> "Use for Reel cover す" -> the site draft is updated and the file is listed as pending in the Publish panel -> "Publish to GitHub" -> one commit with the changed JSON (`data/reels.json` or `data/site.json`) and the image -> the cover shows on Home and the Reels page after GitHub Pages redeploys (about 1-2 minutes, plus up to about 10 minutes of browser cache because the file name stays the same).

Site photo files (fixed names, one file each, a new upload replaces the old file in place, so nothing is left unused):

| Target | File | Size | Format | Referenced by |
|---|---|---|---|---|
| Portrait | `media/site/portrait.webp` | longest side 1200px, not cropped, never enlarged | WebP q0.85 | `data/site.json` `portrait` |
| Reel cover (x5) | `media/reels/<reel-id>.webp` | longest side 1200px (a 9:16 video still gives 675 x 1200), not cropped | WebP q0.85 | `data/reels.json` `thumb` |
| Share image | `og-image.png` (repo root) | exactly 1200 x 630, centre-cropped to fill | PNG (best support in chat apps and social sites) | `og:image` on every page |

No full-size master is made for site photos, because no page opens them in a viewer. One 1200px file is enough (user answer to question 17).

`data/site.json` (new)
```json
{ "version": 1, "portrait": "media/site/portrait.webp" }
```
- `portrait` is `"media/site/portrait.webp"` or `null` (placeholder shows). If the file fails to load, pages show the placeholder and do not crash.

**Watermark marker (for TASK-15).** The uploader adds a small hidden label to every file it makes, after the watermark is drawn. Text (ASCII JSON): `{"wm":"puzzkezz-lattice","v":1,"f":<f>,"div":<divisor>}`.
- WebP: an extra RIFF chunk named `PZWM`. The file is written as a spec-valid extended WebP (with a `VP8X` header) so browsers accept the unknown chunk, and the RIFF size is updated.
- PNG (share image only): a `tEXt` chunk with the keyword `puzzkezz-wm`, placed before the first `IDAT`, with a correct CRC.
- One pure module, `js/admin/wm-marker.js`, exports `addWatermarkMarker(bytes, info)` and `readWatermarkMarker(bytes)` (returns the parsed object or `null`). It uses no DOM, so both the admin page and the Node-side repo test can import it.
- What the marker is for: it catches mistakes (an original committed by hand, a wrong file attached). It is not a lock. Anyone who knows the format could copy it onto another file.

**Honest limit (the user has been told, IDEA-10).** A watermark deters casual reposting and helps prove that a photo is Puzz's. It **cannot** stop screenshots, and a determined person can crop, paint over, or AI-edit the watermark out. The goal of IDEA-10 is that no clean, unwatermarked photo is ever downloadable from the site or the repo, not that copying becomes impossible. Old file versions also stay in git history (see TASK-13), so photos must be watermarked **before** their first commit; a later fix cannot remove an unwatermarked file from history without rewriting it.

---

## 5. Task list

Status values: `todo | in-progress | done`. Each task also gets `Review:` and `QA:` lines, which the reviewer and qa agents fill in. All visual styling follows `docs/style-guide.md` and the approved storyboard. Each task's automated tests go in `tests/task-<n>.spec.js` and must pass in both the `desktop` and `phone` projects.

### TASK-1: Site shell - tokens, fonts, header/tabs, phone MENU, footer, skeleton pages
- Linked idea(s): GLOBAL NOTES (tabs, tone), IDEA-3
- Acceptance criteria:
  - `css/tokens.css` defines CSS custom properties for at least these colours: base `#F3F1F6`, ink `#1D1A24`, pink `#F4A7C0`, purple `#B9A3E3`, deep purple `#5B4A8B` (names come from the style guide). No page uses one of these hex values outside tokens.css.
  - Zen Kaku Gothic New and Space Mono load on every page, with `font-display: swap`.
  - These pages exist, each with a unique `<title>` and one `<h1>`: `index.html`, `gallery.html`, `reels.html`, `events.html`, `about.html`, `contact.html`. The old "Coming soon" page is replaced.
  - At 1280px wide, the header shows the 6 tabs in order HOME · GALLERY · REELS · EVENTS · ABOUT · CONTACT plus an Instagram button. The current page's tab has `aria-current="page"` and a visible underline.
  - At phone width (Pixel 7), the tabs are hidden and a MENU button shows. The button has `aria-expanded="false"` before it is pressed and `"true"` after.
  - The open menu covers the whole viewport and lists the 6 tabs, each with its exact subtitle (see section 2), plus social links at the bottom.
  - The menu closes on the CLOSE button, on Escape, and when a link is followed. Focus stays inside the menu while it is open and returns to MENU when it closes.
  - The Instagram button and social links come from `js/site-config.js` and open in a new tab with `rel="noopener"`.
  - The footer shows on every page with the social links and `© <current year> Puzz Kezz`.
  - No horizontal scrollbar at 360px, 412px, or 1280px wide.
  - All interactive elements can be reached with Tab and have a visible focus style.
  - `robots.txt` exists and disallows `/admin/`.
- Status: done (built 2026-11-17 by the main session on site-v1)
- Review: pending (STORYBOARD APPROVED 2026-11-18, ready for the reviewer agent)
- QA: pending formal QA agent; automated tests in tests/ pass (80 checks, PC + phone)

### TASK-2: Data layer - events.json schema, sample events, loader (sort + group by year)
- Linked idea(s): IDEA-6, IDEA-7
- Acceptance criteria:
  - `data/events.json` follows the format in section 4 and has at least 8 sample events across 2024, 2025, and 2026. Use the con names Comic Fiesta (CF), AMG (full name `[AMG full name placeholder]`), and Omatsuri, with at least 2 events in one year. Every sample has `"sample": true`, and every activity or venue that would be a personal fact is a `[placeholder]`.
  - `js/events-data.js` exports `loadEvents()`. It fetches `data/events.json` and returns the events sorted by date descending. Same-date events keep their array order.
  - It exports `groupByYear(events)`, which returns `[{ year: 2026, events: [...] }, ...]` with years in descending order.
  - It exports `validateEvent(e)`, which returns a list of error messages. It rejects: a missing or invalid date (for example `2025-02-30`), a missing `short`, a `short` longer than 12 characters, a missing `name`, a `link` that is not http/https, and an `activities` value that is not an array of strings.
  - It exports `makeEventId(event, existingIds)`, which returns `<date>-<slug(short)>` and adds `-2`, `-3`, and so on when the id is already taken.
  - It exports `detectEmbed(url)` (in `js/embed.js`), which returns `{ platform, embedUrl }` for:
    - YouTube (`youtube.com/watch?v=`, `youtu.be/`, `/shorts/`) -> `https://www.youtube-nocookie.com/embed/<id>`
    - Instagram `/p/<id>` or `/reel/<id>` -> `https://www.instagram.com/(p|reel)/<id>/embed`
    - TikTok `/video/<id>` -> `https://www.tiktok.com/embed/v2/<id>`
    - Anything else -> `{ platform: "link", embedUrl: null }`
  - If the JSON fails to load, the loader returns an empty list and logs one console warning. Pages show an "Events coming soon" message instead of crashing.
  - A Playwright test runs these functions in the page with `page.evaluate` and import, covering all the cases above.
- Status: done (built 2026-11-17 by the main session on site-v1)
- Review: pending (STORYBOARD APPROVED 2026-11-18, ready for the reviewer agent)
- QA: pending formal QA agent; automated tests in tests/ pass (80 checks, PC + phone)

### TASK-3: Home - guest pass intro + hall walk-through + descending year timeline strip
- Linked idea(s): IDEA-3, IDEA-6
- Acceptance criteria:
  - The intro shows a guest-pass card with `PUZZ KEZZ`, `COSPLAYER · LOLITA · MALAYSIA`, "Not a beatboxer. Just here to cosplay.", one lace edge, and a "Watch my reels" button that scrolls to `#reels`.
  - The hall is built from `data/events.json`, not hard-coded. Adding an event to the JSON and reloading shows it in the hall.
  - The hall order is date descending (newest first). A year marker sign (for example `2026`) appears before the first event of each year.
  - Each event has a hall sign `HALL <letter> · <FULL NAME IN CAPS>` (letters A, B, C... in hall order, continuing AA, AB... after Z) and a polaroid. The polaroid shows the event `photo` if set, otherwise a placeholder that shows the short form. The polaroid has alt text: `<full name> <year>`.
  - Polaroids are placed at different depths (near ones visibly larger than far ones). Scrolling moves the camera forward with native scroll only (no `wheel` preventDefault).
  - Clicking or tapping a polaroid, or pressing Enter or Space on it (it is a button), flips it to a dark card. If the event has a `link`, the card shows "Watch reel", which opens the link in a new tab with `rel="noopener"`. If not, it shows "See event", which links to `events.html#<id>`. On desktop, hovering tilts the polaroid slightly.
  - The YOU ARE HERE strip stays visible while the hall is on screen. Its only text labels are years, in descending order left to right (for example `2026 … 2025 … 2024`). Each event is a small tick with no visible text. The tick has an `aria-label` of `<short> <date>`.
  - The strip highlights the current position, and that changes as the user scrolls. Clicking a year label or a tick scrolls to that year marker or event.
  - A "Skip to reels" button stays visible during the hall and jumps to `#reels`.
  - With `prefers-reduced-motion: reduce` (tested with `page.emulateMedia`), the hall shows as a normal stacked list with no transforms on scroll. All events, signs, and polaroids are still present and in the same order.
  - The hall ends with the sign `END OF HALL · 5 REELS`, followed by an element with `id="reels"` (filled in by TASK-4).
  - Only the first 2 polaroid images load eagerly. The rest use `loading="lazy"`.
  - Works at 360px wide on phone. On phone, polaroids are larger and fewer appear per screen.
- Status: done (built 2026-11-17 by the main session on site-v1)
- Review: pending (STORYBOARD APPROVED 2026-11-18, ready for the reviewer agent)
- QA: pending formal QA agent; automated tests in tests/ pass (80 checks, PC + phone)

### TASK-4: Pronunciation component + さしすせそ reels (Home section + Reels page)
- Linked idea(s): IDEA-5, GLOBAL NOTES (pronunciation)
- Acceptance criteria:
  - `js/pronounce.js` renders any `{kanji|reading}` text as `<ruby>` with `<rt>`, using the pattern: line 1 Japanese (`lang="ja"`), line 2 romaji, line 3 English, plus a speaker button. The speaker button has `aria-label="Play pronunciation: <romaji>"`.
  - Pressing the speaker calls `speechSynthesis.speak` with an utterance whose `lang` is `ja-JP` and whose text is the Japanese (tested by stubbing `speechSynthesis` in `addInitScript`). If `speechSynthesis` is missing, no speaker buttons are rendered.
  - `data/reels.json` holds the header and the 5 reels exactly as in IDEA-5:
    - さすが！ / sa-su-ga! / "Impressive!" / Best cosplay
    - {知|し}らなかった！ / shi-ra-na-kat-ta! / "I didn't know that!" / Behind the scenes
    - すごい！ / su-go-i! / "Amazing!" / Transformation
    - センスいいね！ / sen-su ii ne! / "Great taste!" / Outfit details
    - そうなんだ！ / sō nan da! / "Oh, really? I see!" / Event vlogs
  - The section header shows "さしすせそ" with "sa · shi · su · se · so" under it, the subtitle "Five reels, five reactions. Tap one to watch on Instagram.", and a "Sound on" button that reads "さしすせそ" aloud.
  - Each card has a corner label with its kana and romaji (for example `さ sa`), the Japanese with furigana, the romaji, the English, the category, and a speaker button.
  - The "知" on the し card is rendered with furigana `し` in a `<rt>`.
  - A card with a `url` is a link that opens in a new tab with `rel="noopener"`. A card with an empty `url` shows "Coming soon" and is not a link. Pressing the speaker button does not follow the card link.
  - At 1280px, all 5 cards sit in one row.
  - At phone width, the cards are a horizontal swipe carousel (scroll-snap) with about 1.5 cards visible and 5 page dots. The active dot updates on swipe, and tapping a dot scrolls to that card.
  - The same component is used on Home (`#reels`, under the `END OF HALL · 5 REELS` sign) and on `reels.html`.
  - Every other Japanese text on the site follows the full pattern too. Exception: the MENU subtitle "さしすせそ · sa shi su se so" shows Japanese + romaji only (see Open questions).
- Status: done (built 2026-11-17 by the main session on site-v1)
- Review: pending (STORYBOARD APPROVED 2026-11-18, ready for the reviewer agent)
- QA: pending formal QA agent; automated tests in tests/ pass (80 checks, PC + phone)

### TASK-5: Events page - grouped by year, event cards, click-to-load embeds
- Linked idea(s): IDEA-6, IDEA-7
- Acceptance criteria:
  - `events.html` is built from `data/events.json`. Years are `<h2>` headings in descending order, and events within a year are sorted by date descending.
  - A year jump row at the top lists every year. Clicking one scrolls to that year.
  - Each card shows:
    - the date in the format `6 Dec 2025` inside a `<time datetime="2025-12-06">`
    - the short form, as a badge
    - the full name
    - the venue (only if set)
    - the activities as a list (hidden if empty)
  - Each card has `id="<event-id>"`, so `events.html#2025-12-06-cf` scrolls to it.
  - Media: if `link` is YouTube, Instagram, or TikTok, a facade shows (the preview photo or a placeholder, a play icon, and the label "Load video from <Platform>"). No iframe is in the DOM until the facade is clicked. After the click, one iframe with the URL from `detectEmbed` is added, with a `title`.
  - If `link` is another kind of URL, the preview photo (or placeholder) and an external link show (new tab, `rel="noopener"`).
  - If there is no link and no photo, a neutral placeholder shows.
  - Sample events (`"sample": true`) show a small "Sample" tag, so nobody mistakes them for real history.
  - Works at 360px wide with no horizontal scrolling.
- Status: done (built 2026-11-17 by the main session on site-v1)
- Review: pending (STORYBOARD APPROVED 2026-11-18, ready for the reviewer agent)
- QA: pending formal QA agent; automated tests in tests/ pass (80 checks, PC + phone)

### TASK-6: Admin event manager (`/admin/`)
- Linked idea(s): IDEA-7, IDEA-6
- Acceptance criteria:
  - `admin/index.html` has `<meta name="robots" content="noindex, nofollow">`. No public page links to it.
  - On load, the manager uses the draft from `localStorage` key `puzzkezz.events.draft` if one exists. Otherwise it loads `data/events.json`. A banner says which source is in use.
  - The list shows every event in display order (date descending): date, short form, and full name, with Edit, Delete (asks for confirmation), Move up, and Move down. Move up and down only swap events that have the same date. For events on different dates, the buttons are disabled.
  - The form has these fields: date (`type="date"`), short form, full name, venue/city (optional), activities (add/remove rows, one name per row), social link (URL), and preview photo path (filled in by TASK-7, or typed).
  - Each field has a `<label>`.
  - On Save, the form runs `validateEvent`. Errors show next to the right field and nothing is saved. A valid save updates the list and writes the draft to localStorage, so it survives a page reload. New events get an id from `makeEventId`.
  - When the link field changes, the embed preview updates to the embed iframe, or the photo + link fallback, using `detectEmbed`.
  - "Export events.json" downloads a file named `events.json`. The file is valid JSON in the section 4 format, sorted by date descending, indented with 2 spaces. Tested with Playwright's download event.
  - Saving or editing an event removes `"sample": true` from that event.
  - "Import" accepts a `.json` file. An invalid file (bad JSON, or events that fail validation) shows an error, and the current draft stays unchanged.
  - "Discard draft" (asks for confirmation) clears localStorage and reloads from `data/events.json`.
  - A short help box on the page says: "Changes are only on this browser until you export events.json, replace data/events.json in the repo, and push." (Text replaced by TASK-12.)
  - The page uses the site tokens and is usable at phone width.
- Note 2026-11-18: the photo fields are extended by TASK-10 (Display photo + Full-size photo), and the help box text is changed by TASK-12. Export / Import / Discard draft stay as they are and their tests must keep passing.
- Status: done (built 2026-11-17 by the main session on site-v1)
- Review: pending (STORYBOARD APPROVED 2026-11-18, ready for the reviewer agent)
- QA: pending formal QA agent; automated tests in tests/ pass (80 checks, PC + phone)

### TASK-7: Media uploader - full-res master + display copy, diagonal lattice watermark (on `/admin/`) - REVISED 2026-11-18
- Linked idea(s): IDEA-7, IDEA-9
- Depends on: TASK-10 (the `photoFull` field)
- History: first built 2026-11-17 (one file per photo, max 2000px, corner watermark). Reopened for IDEA-9. The old corner-watermark / 2000px criteria are replaced by the ones below, and `tests/task-7.spec.js` is rewritten to match.
- Acceptance criteria:
  - A file input accepts multiple images (`accept="image/*"`, `multiple`). Files are processed one at a time (not all in parallel), and each file gets one preview card.
  - For each photo, two files are made, **both watermarked**:
    - **Master:** the original pixel width and height (not resized; the only exception is a side over 16383px, the WebP limit, which is scaled down to 16383), WebP at quality 0.95, named `<original-name-slug>-full.webp`.
    - **Display copy:** longest side 1200px keeping the aspect ratio (smaller images are not enlarged), WebP at quality 0.85, named `<original-name-slug>.webp`.
  - The watermark matches docs/style-guide.md and the reference drawing `storyboard/wm.js`. It is all white (`#FFFFFF`) and covers the **whole** image:
    - a dashed diagonal lattice: one set of lines at +45 degrees (rising left to right) and one at -45 degrees;
    - a small upright heart at every crossing;
    - the text `@notpuzzkezz` written along the up-right (+45 degree) lines, centred between two crossings, with the line broken around the text (a gap at each end of the text);
    - the whole layer is drawn at 40% opacity by default (one layer opacity, so overlapping parts are not brighter).
  - The watermark layout comes from one exported pure function, `watermarkLayout(width, height)` in `js/admin/watermark.js`, which returns `{ f, cell, lineWidth, dash, gap, heart }`:
    - `f` = round(shorter side / `WM_DIVISOR`), never below 8px (`Math.max(8, Math.round(Math.min(width, height) / WM_DIVISOR))`), with `WM_DIVISOR` = 80 (2x density);
    - `cell` = 14 x `f` (distance from one crossing to the next along a line);
    - `lineWidth` = max(1, 0.1 x `f`);
    - `dash` = `[0.5 x f, 0.35 x f]` (on, off);
    - `gap` = 0.5 x `f` (space between the text and the broken line, at each end);
    - `heart` = 0.3 x `f` (heart scale).
    So the pattern has the same proportions on the master and the display copy (`cell / f` = 14 on both). Because of rounding and the 8px floor, the cell count across the image is close to, but not exactly, the same on both files.
  - **Density (user decision 2026-11-18, question 15): 2x.** The divisor is one exported constant, `WM_DIVISOR` = 80, in `js/admin/watermark.js`; nothing else in the code or the storyboard repeats the number. The 8px minimum and all ratios to `f` stay as above.
  - Note: on a 1200 x 800 display copy `f` = 10, so `@notpuzzkezz` is about 10px tall (small but more readable than a texture). Very wide or small images (for example a 1200 x 630 share image or a 675 x 1200 reel cover) hit the 8px floor. The name is clearly readable on the full-size master (for example `f` = 50 on a 6000 x 4000 photo).
  - The text (default `@notpuzzkezz`) and the opacity (default 40%, slider from 10 to 100%) can be changed. Changing either re-renders all previews. There are no position choices any more.
  - Each preview card shows both images' pixel sizes and file sizes (for example "Master 6000 x 4000 · 5.4 MB" and "Display 1200 x 800 · 180 KB").
  - Each card shows both suggested repo paths for the selected event: `media/events/<event-id>/<slug>.webp` and `media/events/<event-id>/<slug>-full.webp`. If a pair with that name is already attached or pending for the event, `-2`, `-3`, and so on is added to both names.
  - "Attach to selected event" fills the form's **Display photo** field (`photo`) and **Full-size photo** field (`photoFull`), saves the draft, and adds the pair to the in-memory list of pending files used by Publish (TASK-13). The page warns before closing or reloading (`beforeunload`) while there are pending files that are not published or downloaded.
  - Each card has "Download display" and "Download full size" buttons, and a "Download all" button saves both files of every card (backup path).
  - **Limits and errors (per photo, the other photos still work):**
    - If the image has more than 16,777,216 pixels and the browser is iOS/iPadOS Safari, or the canvas cannot be created, or `toBlob` returns nothing: the card shows "Too large for this browser. Please use a desktop browser (Chrome, Edge or Firefox)."
    - If the browser returns a type other than `image/webp`: the card shows "This browser can't make WebP files. Please use Chrome, Edge or Firefox."
    - If a generated file is over 25 MB: the card shows "This photo is too big to publish (over 25 MB). Please use a smaller original." and "Attach" is disabled for it.
  - Processing happens only in the browser. No network request carries image data.
  - A note on the page says the output removes the photo's location and camera data, and that full-size photos are best processed on a computer.
  - **Automated tests (`tests/task-7.spec.js`, desktop + phone):**
    - Upload `tests/fixtures/flat-2400x1600.png` (a flat single-colour image). Read the output pixels:
      - master is exactly 2400 x 1600, display is exactly 1200 x 800
      - a second fixture smaller than the limit (for example `tests/fixtures/flat-800x600.png`) gives a display copy of exactly 800 x 600 (not enlarged)
      - split each output into a 3 x 3 grid: every cell has some pixels brighter than the source colour (lattice coverage across the whole image), on both files
      - the brightest watermark pixels match `src + 0.40 * (255 - src)` per channel within a tolerance of 12 (40% white, and overlaps of line, heart and text are not brighter than that)
      - both files are `image/webp` (the first bytes are `RIFF....WEBP`)
    - `WM_DIVISOR` is exported and equals 80.
    - `watermarkLayout(1200, 800)` gives `f` = 10 and `cell` = 140 (800 / 80 = 10; also `lineWidth` = 1, `dash` = [5, 3.5], `gap` = 5, `heart` = 3, each within 0.01).
    - `watermarkLayout(2400, 1600)` gives `f` = 20 and `cell` = 280 (`cell / f` = 14, same proportions as the display copy).
    - `watermarkLayout(6000, 4000)` gives `f` = 50 and `cell` = 700.
    - Minimum size: a small image, for example `watermarkLayout(400, 300)`, gives `f` = 8 (300 / 80 = 3.75 rounds to 4, so the 8px floor applies) and `lineWidth` = 1 (never below 1).
    - Changing the opacity slider to 80% re-renders, and the brightest pixels move to about `src + 0.80 * (255 - src)`.
    - Stub `HTMLCanvasElement.prototype.toBlob` (in `addInitScript`) to return `null` for one file: that card shows the "Too large for this browser" message, and a second file in the same batch still succeeds.
    - Stub `toBlob` to return an `image/png` blob: the "can't make WebP files" message shows.
    - Download buttons: the Playwright download event gives `flat-2400x1600.webp` and `flat-2400x1600-full.webp`.
    - Attach: `#f-photo` = `media/events/<id>/flat-2400x1600.webp`, `#f-photo-full` = `media/events/<id>/flat-2400x1600-full.webp`, and both are in the localStorage draft.
    - `page.on('request')` records no request other than same-origin page assets during processing.
- Status: done (merged into site-v1 on 2026-11-19; review approved round 2, QA passed)
- Review: approved 2026-11-19
- QA: passed 2026-11-19

### TASK-8: Gallery, About, Contact (simple v1 pages)
- Linked idea(s): GLOBAL NOTES (tabs), IDEA-7 (photos feed the gallery)
- Acceptance criteria:
  - **Gallery** is built from the events in `data/events.json` that have a `photo`, newest first. Each tile shows the photo (`loading="lazy"`, alt `<full name> <year>`) and a caption with the short form, full name, and year.
  - Clicking a tile opens a larger view in a `<dialog>` that closes with Escape or the close button. If no event has a photo, the text "Photos coming soon" shows.
  - **About** has an `<h1>`, a portrait placeholder image with alt text, and bio paragraphs written as `[placeholder]`. No invented facts about Puzz.
  - **Contact** has the heading "Collabs & bookings", a `[placeholder]` text, a `mailto:` link using the email from `js/site-config.js` (a placeholder until the user provides one), and social links (new tab, `rel="noopener"`).
  - Contact has no form.
  - On all three pages the correct tab is active (`aria-current="page"`). No horizontal scrolling at 360px.
- Note 2026-11-18: the Gallery viewer is changed by TASK-10 to load the full-resolution master (`photoFull`).
- Status: done (built 2026-11-17 by the main session on site-v1)
- Review: pending (STORYBOARD APPROVED 2026-11-18, ready for the reviewer agent)
- QA: pending formal QA agent; automated tests in tests/ pass (80 checks, PC + phone)

### TASK-9: Polish pass - meta tags, 404, accessibility and performance check
- Linked idea(s): GLOBAL NOTES, IDEA-3
- Acceptance criteria:
  - Every public page has a `<meta name="description">`, Open Graph title, description, and image, `lang="en"`, and a favicon.
  - A `404.html` page in the site style links back to Home (GitHub Pages serves it for unknown paths).
  - An automated axe-style check, or manual checks recorded in the QA notes, finds no images without alt text, no buttons without names, and no skipped heading levels on any page.
  - Before any interaction, the Home page makes no requests to youtube, instagram, or tiktok domains (checked in Playwright).
  - Text colour contrast against its background is at least 4.5:1 for body text, using the token pairs in the style guide.
  - All earlier `tests/task-*.spec.js` pass in both projects.
- Status: done (built 2026-11-17 by the main session on site-v1)
- Review: pending (STORYBOARD APPROVED 2026-11-18, ready for the reviewer agent)
- QA: pending formal QA agent; automated tests in tests/ pass (80 checks, PC + phone)

### TASK-10: Data model for photo pairs (`photo` + `photoFull`) and the full-size Gallery viewer
- Linked idea(s): IDEA-9
- Acceptance criteria:
  - `validateEvent(e)` in `js/events-data.js` accepts an optional `photoFull` string and rejects:
    - a `photo` or `photoFull` that is not a string, starts with `/`, contains `://`, or contains `..`
    - a `photoFull` without a `photo`
  - Existing events with only `photo` still validate and render exactly as before (TASK-2/3/5/8 tests still pass).
  - The admin form (TASK-6) has two labelled fields: **Display photo** (`#f-photo`, saved as `photo`) and **Full-size photo** (`#f-photo-full`, saved as `photoFull`). Both can be typed or filled by TASK-7. Empty fields are left out of the saved event (no empty strings in the JSON).
  - Export writes `photoFull` right after `photo` for each event. Import accepts files with or without `photoFull`.
  - Hall polaroids, Events cards / facades, and Gallery tiles keep using `photo` (the display copy) only. They never request `photoFull`.
  - Gallery viewer (`<dialog>`): on open, it shows `photo` at once, then loads `photoFull` (if set) and swaps it in when loaded, with a visible "Loading full size..." label while waiting. If `photoFull` fails to load, the display copy stays and no error is shown to the visitor. Alt text stays `<full name> <year>`.
  - The footer note "Photos watermarked. Please ask before reposting." stays (both files are now watermarked).
  - **Automated tests (`tests/task-10.spec.js`):**
    - `validateEvent` cases: valid with both paths; valid with only `photo`; error for `photoFull` without `photo`; errors for `/abs.webp`, `https://x/y.webp`, `../x.webp`.
    - With mocked `data/events.json` (both fields set), a `page.on('request')` log shows no request for the `photoFull` path on Home, Events, or Gallery before the viewer is opened.
    - Opening a Gallery tile requests the `photoFull` path, and after load the dialog image `src` ends with it.
    - With `photoFull` routed to a 404, the dialog image keeps the `photo` source.
    - Admin: fill both fields, Save, reload: both values are in the draft and in the exported file.
- Status: done (merged into site-v1 on 2026-11-19 as 5442abf; review approved round 2, QA passed)
- Review: approved 2026-11-18 (round 2, commit eff0502; see docs/reviews.md)
- QA: passed 2026-11-18 (94 passed + 2 skips full suite PC + phone; exploratory: loading/failed/full states, swipe, Esc + focus return, rapid navigation, admin + import validation, no console errors besides expected 404)

### TASK-11: GitHub connection panel in `/admin/` (token save / test / forget)
- Linked idea(s): IDEA-8
- Acceptance criteria:
  - `js/admin/github-config.js` holds `owner: "jiayangwong"`, `repo: "MyCosplayWebsite"`, `branch: "main"`, `apiBase: "https://api.github.com"`. No token or secret is in any file in the repo.
  - A **GitHub** panel has: a short "How to get a token" help (fine-grained token, only this repo, Contents: Read and write, set an expiry date), a labelled token input (`type="password"`, `autocomplete="off"`), "Save token", "Test connection", and "Forget token".
  - "Save token" stores the token in `localStorage` key `puzzkezz.github.token`, clears the input, and shows "Token saved, ends in ...<last 4 characters>". The full token is never shown again.
  - A token that starts with `ghp_` (classic) is refused with "This is a classic token that can reach all your repos. Please make a fine-grained token for this repo only." and is not saved. Empty input is refused.
  - "Test connection" calls `GET https://api.github.com/repos/jiayangwong/MyCosplayWebsite` with `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, and `X-GitHub-Api-Version` headers. Results:
    - 200: "Connected to jiayangwong/MyCosplayWebsite (site-v1). Write access is checked when you publish."
    - 401: "This token is wrong or has expired."
    - 403 or 404: "This token can't see the repo. Check that it is for jiayangwong/MyCosplayWebsite."
    - network error: "Can't reach GitHub. Check your internet connection."
  - "Forget token" (asks for confirmation) removes the localStorage key, and the panel returns to the "no token" state. Without a token, the Publish button (TASK-12) is disabled with the hint "Add a GitHub token to publish".
  - `admin/index.html` has `<meta http-equiv="Content-Security-Policy" content="connect-src 'self' https://api.github.com">` (other directives may be added for embeds and fonts, but `connect-src` stays this strict) and `<meta name="referrer" content="no-referrer">`.
  - The token is never put in a URL, the draft, an exported file, or a console message.
  - **Automated tests (`tests/task-11.spec.js`, mock via `tests/github-mock.js`, fake token only):**
    - Save stores the fake token, clears the input, and shows the last 4 characters. Reload: the token is still there.
    - Classic `ghp_TESTONLY` is refused and not stored.
    - Test connection with the mock returning 200 / 401 / 404 / network abort shows each message. The mocked request has the Bearer header and goes to `api.github.com`.
    - Forget token removes the key, and the Publish button becomes disabled.
    - Across the whole test, every request is logged: the token string appears only in the `Authorization` header of requests to `https://api.github.com`, never in any URL, never in a request to another host, and never in any console message (`page.on('console')`).
    - The draft in localStorage and an exported `events.json` do not contain the token string.
    - The CSP meta tag is present with the `connect-src` value above. A `fetch` from the admin page to another origin (for example `https://example.com`) is blocked.
    - A scan of every non-test file in the repo (`*.html`, `*.js`, `*.json`) finds no string matching `ghp_[A-Za-z0-9]{20,}` or `github_pat_[A-Za-z0-9_]{20,}`.
- Status: done (merged into site-v1 on 2026-11-19; review approved round 2, QA passed)
- Review: approved 2026-11-19
- QA: passed 2026-11-19 (BUG-1 minor header overflow at 375px is a TASK-6 issue, BUG-2 flaky tests under load; neither blocks)

### TASK-12: Publish events.json to GitHub in one atomic commit (with stale check)
- Linked idea(s): IDEA-8
- Depends on: TASK-11
- Acceptance criteria:
  - A **Publish** panel lists pending changes ("data/events.json changed", plus photo pairs from TASK-13). If the draft equals the published file and nothing is pending, the button reads "Nothing to publish" and is disabled.
  - The draft remembers the git blob SHA of the `data/events.json` it started from (`baseEventsSha`, computed in the browser from the loaded file as git does: SHA-1 of `blob <length>\0<content>`, or taken from the API after a publish).
  - "Publish to GitHub" does, in order, all with the token and `api.github.com` only:
    1. `GET /repos/{owner}/{repo}/git/ref/heads/site-v1` -> head commit SHA
    2. `GET /repos/{owner}/{repo}/git/commits/{head}` -> base tree SHA
    3. `GET /repos/{owner}/{repo}/contents/data/events.json?ref={head}` -> current blob SHA. If it is not `baseEventsSha`, stop (stale, see below).
    4. `POST .../git/blobs` for `data/events.json` (the same text Export makes: sorted, 2-space indent, trailing newline)
    5. `POST .../git/trees` with `base_tree` = base tree SHA and only the changed paths (mode `100644`, type `blob`)
    6. `POST .../git/commits` with the new tree, `parents: [head]`, and the message `Update events from /admin/ (<n> events, <m> photos)`
    7. `PATCH .../git/refs/heads/site-v1` with `{ "sha": <new commit>, "force": false }`
  - **Stale check:** if step 3 finds a different SHA, or step 7 returns 409 or 422 (the branch moved), nothing goes live and the page says: "The site changed since you started editing (maybe from another device). Export a backup, then reload this page." with "Export backup" and "Reload" buttons.
  - On success: "Published. The site updates in about 1-2 minutes." with a link to `https://github.com/jiayangwong/MyCosplayWebsite/commit/<sha>`. `baseEventsSha` is updated to the new blob SHA, so the next publish works without a reload.
  - On any failure before step 7 the ref is never updated. The draft is kept, and a clear message shows:
    - 401: token expired
    - 403/404 on a write: "This token can't write to the repo. It needs Contents: Read and write."
    - rate limit: "GitHub is busy. Wait N minutes and try again."
    - network error
    - A "Try again" button repeats the whole publish from step 1.
  - While publishing, the Publish, Import, Discard and Forget token buttons are disabled, so a double click cannot make two commits.
  - The TASK-6 help box now says: "Changes stay on this browser until you press Publish to GitHub. Export events.json is a backup you can commit by hand."
  - Export / Import still work exactly as in TASK-6.
  - Note: TASK-13 adds one read call (list the repo tree) between steps 3 and 4, plus the removal of unused old photos with a confirmation step. When TASK-13 is built, the happy-path test below is updated to expect that extra call (8 calls). With no unused photos, no confirmation shows and the tree is unchanged (only `data/events.json`).
  - **Automated tests (`tests/task-12.spec.js`, using the in-memory fake repo in `tests/github-mock.js`, fake token only):**
    - Happy path: edit an event, Publish. The mock gets exactly the 7 calls in order. The tree contains only `data/events.json`. The decoded blob equals the Export output. The commit has `parents: [head]`. The PATCH body has `force: false`. The success message and the commit link show.
    - With no changes the button is disabled ("Nothing to publish").
    - Stale (blob): the mock's `events.json` SHA differs from the draft's base -> stale message, and no POST/PATCH calls are made.
    - Stale (ref): the PATCH returns 422 -> stale message, and the fake repo's head is unchanged.
    - 401, 403-on-blob, 429 with `retry-after`, and a network abort each show their message, and the fake repo's head is unchanged.
    - A second Publish right after a success works without a reload (uses the updated `baseEventsSha`).
    - Double-clicking Publish makes only one commit.
    - Every request with the token goes to `https://api.github.com`. Unhandled `api.github.com` routes fail the test.
- Status: done (merged into site-v1 on 2026-11-19; review approved round 3, QA passed)
- Review: approved 2026-11-19
- QA: passed 2026-11-19 (exploratory checks all fine; only test-only flakes, see BUG-3)

### TASK-13: Publish photo pairs (master + display copy) and remove unused old photos, in the same commit
- Linked idea(s): IDEA-8, IDEA-9
- Depends on: TASK-7, TASK-12
- Acceptance criteria:
  - Each pending pair from TASK-7 shows in the Publish panel with both paths and sizes, plus a total ("Adds 2 photos, 4 files, 11.2 MB").
  - The publish from TASK-12 adds one blob per file (base64, built with `FileReader.readAsDataURL` or chunked, not one huge `btoa` string), and puts every image path and `data/events.json` in the **same** tree and commit. One publish = one commit.
  - Blobs are uploaded one at a time, with a progress bar ("Uploading file 3 of 9").
  - Only pairs whose paths are still used by an event in the draft are published. Pairs from a deleted event, or replaced by another attach, are dropped from the list.
  - Allowed paths only: `data/events.json` and `media/events/<event-id>/<name>.webp` / `<name>-full.webp`, where `<event-id>` is an event in the draft. Anything else is refused before any request. (Removals follow their own stricter rules below.)
  - The original uploaded file is never sent. Only the two generated WebP files are.
  - Limits: more than 20 pending photos -> "Publish at most 20 photos at a time" and the button is disabled until some are removed (each pending pair has a "Remove from publish" button). Any file over 25 MB is refused (see TASK-7).
  - After success, the published pairs are cleared from the pending list, and the `beforeunload` warning stops.
  - On failure, the pending pairs stay in memory so "Try again" works without re-processing.
  - **Removing old, unused photos (user decision 2026-11-18):**
    - After step 3 of TASK-12 (and before any write), Publish reads the current tree with `GET /repos/{owner}/{repo}/git/trees/{baseTree}?recursive=1`.
    - The files to remove are every path in that tree that (a) starts with `media/events/`, (b) ends in `.webp` (exact, lowercase), and (c) is **not** used as `photo` or `photoFull` by any event in the `events.json` about to be committed. Exact string match; a file used by any event (even a different event) is never removed. New files in this publish are never removed.
    - Nothing else is ever removed: no path outside `media/events/`, no file with another extension (for example `.jpg`, `.png`, `.txt`), and never `data/events.json`. The code checks every removal path against these rules again right before building the tree, and refuses the whole publish (no writes) if one fails.
    - If the list is not empty, a confirmation dialog shows **before any write**: the heading "These N old files will be removed" (N = the count; "This 1 old file will be removed" for one), the full list of paths, the note "Old versions stay in the GitHub history.", and the buttons "Remove and publish" and "Cancel". Cancel stops the publish: no blob, tree, commit or ref call is made, the draft and pending pairs stay, and the page says "Publish cancelled. Nothing was changed."
    - If the list is empty, no dialog shows and the publish goes on as in TASK-12.
    - The removals are `{ "path": ..., "mode": "100644", "type": "blob", "sha": null }` entries in the **same** `POST .../git/trees` request as `data/events.json` and the new images. One publish = one commit; if any step fails, nothing is added and nothing is removed.
    - If GitHub returns `truncated: true` for the tree, no files are removed this time, and the result says "Could not list all old photos, so none were removed this time." The rest of the publish still works.
    - The commit message becomes `Update events from /admin/ (<n> events, <m> photos, <k> old files removed)` when k > 0 (unchanged from TASK-12 when k = 0). The success message adds "Removed N old files."
    - The Publish panel help text says: "Publish also removes photo files that no event uses any more. Old versions stay in the GitHub history."
  - **Automated tests (`tests/task-13.spec.js`, fake repo + fake token):**
    - `tests/github-mock.js` is extended: `GET .../git/trees/{sha}?recursive=1` lists the fake repo's files (with an option to return `truncated: true`), and `POST .../git/trees` applies `sha: null` entries as deletions.
    - Replace: the fake repo has event X with `photo`/`photoFull` = `media/events/X/old.webp` / `old-full.webp`. Attach a new pair to X, Publish. The dialog says "These 2 old files will be removed" and lists exactly those 2 paths. Confirm: one `POST .../git/trees` whose entries are `data/events.json`, the 2 new images, and exactly 2 `sha: null` entries for the old files. The ref is updated once, the fake repo has exactly one new commit, the old files are gone from its tree, and the new ones are present.
    - Cancel: same setup, press Cancel. No `POST`/`PATCH` request is made, the fake repo head and files are unchanged, the pending pair is still listed, and "Publish cancelled. Nothing was changed." shows.
    - Delete event: delete an event that has a photo pair (no new photos), Publish. The dialog lists its 2 files; after confirming, the tree has `data/events.json` + 2 `sha: null` entries and no image blobs are uploaded.
    - Shared file: events X and Y both use `media/events/X/shared.webp`. Change X's photo. `shared.webp` is not in the dialog and not in any `sha: null` entry.
    - Untouchable files: the fake repo also contains `media/events/X/notes.txt`, `media/events/X/photo.jpg`, `media/other/a.webp`, `img/logo.webp`, and an unreferenced `media/events/X/stray.webp`. Only `stray.webp` is listed and removed; the other four are never listed and never in a `sha: null` entry.
    - Nothing unused: the TASK-12 happy path shows no dialog and has no `sha: null` entry.
    - Truncated tree: the mock returns `truncated: true`. No dialog, no `sha: null` entries, the "Could not list all old photos" note shows, and the publish succeeds.
    - Failure after confirm: the blob POST for a new image fails (500). The ref is not updated, the old files are still in the fake repo, and "Try again" shows the dialog again and then succeeds with one commit.
    - Guard: a removal path that breaks the rules (injected into the list in the test, for example `data/events.json` or `media/events/X/a.jpg`) makes the publish stop with an error before any write request.
    - Every test: every `sha: null` path starts with `media/events/`, ends in `.webp`, and is not used by any event in the committed `events.json` blob.
    - Upload the fixture, attach to an event that has no photo yet, Publish. No removal dialog shows. The tree has exactly 3 entries: `data/events.json`, `media/events/<id>/flat-2400x1600.webp`, and `.../flat-2400x1600-full.webp`. The `ref` is updated once, and the fake repo has exactly one new commit.
    - The decoded image blobs start with `RIFF....WEBP` and are byte-for-byte equal to what the Download buttons give. Neither equals the fixture PNG bytes.
    - The progress text reaches "Uploading file 3 of 3".
    - The blob POST for the second image fails (500): the ref is not updated, the pending pair is still listed, and "Try again" then succeeds with one commit.
    - Removing an event after attaching its pair removes the pair from the publish list.
    - 21 pending pairs (made with a small fixture) -> the limit message, and the button is disabled.
    - A path outside the allowed patterns (injected into the draft) is refused with no network call.
- Status: done (merged into site-v1 on 2026-11-19; review approved round 3, QA passed)
- Review: approved 2026-11-19
- QA: passed 2026-11-19

### TASK-16: Publish never commits a broken photo link (events and site photos); "Remove from publish" puts back the published photo - APPROVED 2026-11-19
- Linked idea(s): IDEA-11 (with IDEA-8, IDEA-9, IDEA-10); fixes BUG-4
- Approved by the user on 2026-11-19 ("TASK-16 approved, yes": both protections, put back the published photo; site photos added for BUG-4).
- Depends on: TASK-13, TASK-14, TASK-15 (all done)
- Goal: an event can never go live pointing at a photo file that is not on GitHub, and so its old photo can never be removed by mistake. Two protections (option (c) of IDEA-11): (1) Publish checks every photo link against the repo before any write; (2) "Remove from publish" undoes the attach in the draft, so the usual case never reaches the check.
- Why both: (2) fixes the button the reviewer found, but the same broken state can also come from other paths that (2) does not see: a page reload (pending pairs live only in memory, while the draft stays in localStorage), an Import of an edited events.json, or a typed path. (1) catches all of them, at the last safe moment.
- Choice for (2), planner's recommendation: **put back the photo paths from the published events.json** (not "clear the fields"). Reason: clearing would make the event's old photo unused, so the TASK-13 removal step would then offer to delete it - the exact data loss IDEA-11 is about, just behind a dialog. Putting back the published paths returns the event to what is live now, so nothing is broken and nothing is removed. It is barely more code: one lookup by event id in the base events.json text that the draft already keeps (`baseEvents().text`). When there is no published photo to put back, the fields are cleared, which is then also safe.
- Acceptance criteria:
  - **(1) Photo link check in Publish**
    - It runs inside the publish, after the repo tree is read (`GET .../git/trees/{baseTree}?recursive=1`, which comes after the stale check) and **before** the removal dialog and before any write (blob, tree, commit, ref). It also runs on "Try again". The early "GitHub already has exactly this" exit of TASK-12/13 stays as it is (nothing would change on the live site).
    - For every event in the `events.json` text about to be committed, and for each of `photo` and `photoFull` that is a non-empty string:
      - **Not in plain form** (`isCanonicalPath` from TASK-13 returns false, for example `./media/...`, `...webp?v=2`, `media//events/...`, `%2F`, a backslash, spaces): the publish stops with "Event \"<short> <year>\" (<id>) has a photo path that is not in the usual form: <value>. Attach the photo again or fix the path, then publish. Nothing was changed."
      - **Starts with `media/events/`** and is neither a `type: "blob"` entry with exactly that path in the tree, nor one of the files in this publish: the publish stops with "Event \"<short> <year>\" (<id>) points at a photo that is not on GitHub and not in this publish: <path>. Attach the photo again, or remove it from the event, then publish. Nothing was changed."
      - Plain paths outside `media/events/` are not checked here (the TASK-15 repo guard checks that every referenced file exists).
    - Events with no `photo` / `photoFull` (missing or `""`) pass. Deleted events are not in the committed text, so they are never checked; their files are still removal candidates as in TASK-13.
    - The message names the **first** problem in display order (date descending) and, when there are more, adds "(and N more)".
    - **Truncated tree** (`truncated: true`): Publish cannot prove the files exist. If the committed text has at least one `media/events/` path that is not a file in this publish, the publish stops with "Could not list all files on GitHub, so the photo links can't be checked. Nothing was changed." If every such path is a new file of this publish (or there are none), it goes on as in TASK-13 (no removals, the "Could not list all old photos" note). Note: GitHub only truncates at about 100,000 files, far beyond this site.
    - The check is a pure exported function in `js/admin/publish.js`, for example `brokenPhotoLinks(text, treeEntries, truncated, newPaths)` returning `[]` or the list of problems, so it can be tested without the network.
    - Since every non-plain path now stops the publish, the TASK-13 "not in the usual form, so no old files were removed" note can no longer happen and is removed with its message.
    - On a stop: no `POST` or `PATCH` request is made, the draft and the pending pairs are kept, the Publish / Import / Discard / Forget token buttons are enabled again, and "Try again" is shown.
  - **(2) "Remove from publish" undoes the attach**
    - Pressing it on a pair of event E removes the pair (as today) and then, only if E is still in the draft **and** E's draft `photo` still equals the pair's `photo` and E's `photoFull` still equals the pair's `photoFull` (or is empty):
      - If the published events.json (`baseEvents().text`) has an event with id E and a `photo`, E's `photo` and `photoFull` are set to the published values (both together, `photoFull` cleared if the published one has none). Note: "Photo for <short> <year> set back to the published photo."
      - Otherwise (new event, or no published photo): both fields are cleared. Note: "Photo for <short> <year> removed from the event (it has no published photo)."
    - If E's paths were changed in the meantime (another attach, a typed path), the draft is not touched and no note shows.
    - The draft is saved (localStorage) like any other edit, the Publish panel re-renders, and if E is open in the edit form its Display photo / Full-size photo fields and preview show the new values.
    - The note is a short visible line under the pending list (`role="status"`), replaced by the next note and cleared on the next publish.
    - The draft change goes through one new function in `js/admin/manager.js` (for example `revertPhoto(eventId, photo, photoFull)`), so `publish.js` does not edit the draft state directly.
  - **(3) Site photo link check in Publish (BUG-4, same gap for site photos)**
    - It runs at the same moment as (1): after the repo tree is read, before the removal dialog and before any write; also on "Try again".
    - It checks the `data/site.json` and `data/reels.json` texts that are part of this commit (from `siteText()` / `reelsText()` in `js/admin/site-draft.js`). A JSON file that is not in this commit is already live and is not checked.
    - Checked values: `portrait` in `data/site.json` and every reel's `thumb` in `data/reels.json`, when it is a non-empty string (`null`, missing and `""` pass).
    - **Not in plain form** (`isCanonicalPath` false): stop with "Portrait has a photo path that is not in the usual form: <value>. Make the photo again or press \"Clear portrait\", then publish. Nothing was changed." (for a reel: "Reel cover <kana> (<reel-id>) has ..." and "Clear cover").
    - **Not a `type: "blob"` entry with exactly that path in the tree and not one of the files in this publish:** stop with "Portrait points at a photo that is not on GitHub and not in this publish: <path>. Make the photo again or press \"Clear portrait\", then publish. Nothing was changed." (reel: "Reel cover <kana> (<reel-id>) points at ...", "Clear cover").
    - The message names the file. Order: portrait first, then reels in `data/reels.json` order; the event problems of (1) come first; one message for all, with "(and N more)" counting both kinds.
    - Truncated tree: same rule as (1) (stop with the "can't be checked" message if a checked site path is not a file of this publish).
    - Built on the existing code: one pure exported function in `js/admin/publish.js`, for example `brokenSitePhotoLinks(siteText, reelsText, treeEntries, truncated, newPaths)`, returning `[]` or the list of problems; it never throws on bad JSON. `sitePathProblem` and the allowed-path rules of TASK-14 stay as they are (they check pending files; this checks the JSON links).
    - On a stop: the same as (1) (no `POST` / `PATCH`, the draft, the site draft and the pending files kept, buttons enabled again, "Try again" shown).
  - **BUG-4 closed:** the BUG-4 steps (Use for Portrait, reload, Publish) now stop with the message naming `media/site/portrait.webp` and no write. When the task is merged, `bugs/BUGS.md` BUG-4 gets `Status: fixed (TASK-16)`.
  - Nothing else changes: the allowed-path rules, the removal rules, the dialog, the stale check and the commit layout of TASK-12/13/14 stay the same.
- Files: `js/admin/publish.js` (both checks, messages, note line, the Remove button handler), `js/admin/manager.js` (`revertPhoto`), `js/admin/site-draft.js` (only if a small read helper is needed), `admin/index.html` (the note element, if not reused), `tests/task-16.spec.js`, `tests/task-13.spec.js` (expectations updated, see below), `tests/github-mock.js` only if needed, `bugs/BUGS.md` (BUG-4 status).
- **Automated tests (`tests/task-16.spec.js`, fake repo + fake token, desktop + phone):**
  - IDEA-11 case, end to end: the fake repo has event X with `media/events/X/old.webp` / `old-full.webp`. Attach a new pair to X, press "Remove from publish". X's fields are back to the old paths, the "set back to the published photo" note shows, and the button reads "Nothing to publish" (the draft equals the published file again). Then rename another event Y and Publish: no removal dialog shows, the tree has only `data/events.json`, X's committed paths are the old ones, and `old.webp` / `old-full.webp` are still in the fake repo.
  - New event: attach a pair to an event that is not published yet, Remove from publish. Both fields are empty and the "no published photo" note shows.
  - Changed meanwhile: attach a pair, then type another path into X's Display photo field and save, then Remove from publish. The draft keeps the typed path and no note shows.
  - Form open: with X open in the edit form, Remove from publish updates the form's photo fields and preview.
  - Broken link stop (the reload case): set the draft so X points at `media/events/X/new.webp` / `new-full.webp` with no pending pair and those files not in the fake repo. Publish shows the "not on GitHub and not in this publish" message naming X and the path; the mock records no `POST` or `PATCH`; the fake repo head and files are unchanged; no removal dialog shows.
  - Two broken events: the message names the first one by display order and says "(and 1 more)".
  - Non-plain path: X's `photo` = `./media/events/X/old.webp` (file exists). Publish stops with the "not in the usual form" message and no write.
  - Truncated tree with an existing photo reference: stops with the "can't be checked" message and no write. Truncated tree where the only `media/events/` paths are new files of this publish: publish succeeds with the "Could not list all old photos" note.
  - Events with no photo, plus a photo outside `media/events/` (for example `img/placeholder.webp`): publish succeeds (not stopped by this check).
  - Deleted event: delete event X that has a published pair, Publish. No link error; the removal dialog lists X's 2 files as in TASK-13.
  - Try again: after a broken-link stop, fix the draft (Remove the photo from the event), press "Try again": it publishes with one commit.
  - Pure function: `brokenPhotoLinks` returns `[]` for a tree that has every path, the right problem for a missing path, a non-plain path, and a truncated tree; it never throws on bad JSON (returns `[]`; the publish of bad JSON is already impossible).
  - **Site photos (BUG-4):**
    - BUG-4 repro: Use for Portrait, reload the page, Publish (fake repo has no `media/site/portrait.webp`). The "not on GitHub and not in this publish" message names `media/site/portrait.webp`; the mock records no `POST` or `PATCH`; the fake repo head is unchanged.
    - Same for a reel cover: Use for "Reel cover: す su", reload, Publish -> the message names "Reel cover す (sugoi)" and `media/reels/sugoi.webp`; no write.
    - Without the reload (the file is pending), the same publish succeeds with one commit (the TASK-14 publish test still passes).
    - Portrait set to a file already in the fake repo, with no pending file: publish succeeds.
    - "Clear portrait" after the reload, then "Try again": it publishes with one commit and `portrait: null`.
    - A non-plain `portrait` (for example `./media/site/portrait.webp`) stops with the "not in the usual form" message and no write.
    - An event problem and a site problem together: the message names the event and says "(and 1 more)".
    - Pure function: `brokenSitePhotoLinks` returns `[]` when every path is in the tree or in `newPaths`, the right problem for a missing portrait and a missing reel cover, and `[]` for bad JSON.
  - **`tests/task-13.spec.js` updates:** the "unusual path" tests now expect the publish to stop with the "not in the usual form" message and no write (instead of success with the note). The "truncated tree" test now expects the "can't be checked" stop when the events reference existing photos. Every other TASK-13 test still passes unchanged. The full suite passes (TASK-14 and TASK-15 tests included).
- Status: done (merged into site-v1 on 2026-11-19; review approved round 1, QA passed; BUG-4 verified; BUG-5, BUG-6 minor open)
- Review: approved 2026-11-19
- QA: passed 2026-11-19 (BUG-4 re-checked by hand: verified; minor nice-to-haves logged as BUG-5, BUG-6)

### TASK-17: Repo guard accepts a marked file whose allowlist hash is stale (reports it) - APPROVED 2026-11-19
- Linked idea(s): IDEA-10 (question 22, option (b), user answer 2026-11-19)
- Depends on: TASK-15 (done), TASK-16 (build after it)
- Goal: after Puzz publishes a Share image over `og-image.png`, the test run does not fail on the old allowlist entry, while an unwatermarked file can still never slip through.
- Acceptance criteria:
  - In `tests/wm-guard.js`, exact-hash allowlisting stays: an allowlisted file whose SHA-256 matches passes, marked or not (as today).
  - New narrow rule: an allowlisted file whose hash **no longer matches** but which carries a valid marker (`readWatermarkMarker` returns `wm: "puzzkezz-lattice"`, `v: 1`) passes, and the guard reports the allowlist entry as **stale**, naming the file (for example "Allowlist entry is stale (file changed, now carries the watermark marker): og-image.png. Remove it from tests/wm-allowlist.json."). A stale report is a note, not a failure.
  - An allowlisted file whose hash no longer matches and which has **no** valid marker still fails exactly as today (same message naming the file).
  - Nothing else in the guard changes (scanned extensions, skipped folders, fixtures rule, reference checks, SVG rule).
  - In `tests/task-15.spec.js`, the assertion that expects `og-image.png` on the allowlist becomes "`og-image.png` is allowlisted **or** carries the marker". The stale notes are shown in the test output (for example as a test annotation or console line), so they are seen in QA.
  - `tests/wm-allowlist.json` is not changed by this task.
- Files: `tests/wm-guard.js`, `tests/task-15.spec.js`.
- **Automated tests (in `tests/task-15.spec.js`, guard self-test on a temporary folder, not the repo):**
  - An allowlisted file with a wrong hash and **no** marker -> fails, the message names the file (proves an unmarked changed file still fails).
  - An allowlisted file with a wrong hash that **carries** the marker -> passes, and is reported as stale with its path.
  - An allowlisted file with the right hash and no marker -> passes, not reported as stale.
  - A file with a broken or foreign marker (for example `wm: "other"`) and a wrong allowlist hash -> fails.
  - The existing TASK-15 self-test still reports exactly the same 3 bad files; the real repo scan still passes; the full suite passes.
- Status: done (merged into site-v1 on 2026-11-19; review approved round 1, QA passed)
- Review: approved 2026-11-19
- QA: passed 2026-11-19

### TASK-15: Watermark marker in every uploader file + Publish check + repo guard test - APPROVED 2026-11-18
- Linked idea(s): IDEA-10 (with IDEA-9, IDEA-8)
- Depends on: TASK-7 (the pipeline, `WM_DIVISOR` = 80), TASK-13 (publishing photo files).
- Acceptance criteria:
  - `js/admin/wm-marker.js` exports `addWatermarkMarker(bytes, info)` and `readWatermarkMarker(bytes)` as described in "Watermark marker" (section 4). It has no DOM code and can be imported in the browser and in Node.
  - `readWatermarkMarker` returns `{ wm: "puzzkezz-lattice", v: 1, f, div }` for a marked WebP or PNG, and `null` for an unmarked WebP, PNG, JPEG, a truncated file, or random bytes (it never throws).
  - Every file the uploader makes (TASK-7 master and display copy, and every TASK-14 site photo) is marked **after** the watermark is drawn and **before** it is previewed, downloaded, attached, or added to the pending list. So the Download buttons (backup path) also give marked files. The marker's `f` equals `watermarkLayout(width, height).f` of that file, and `div` equals `WM_DIVISOR`.
  - A marked WebP still opens normally: it decodes with `createImageBitmap` to the same width and height, and its pixels equal the unmarked encoder output (the marker changes only metadata).
  - **Publish check:** right before any write request, Publish runs `readWatermarkMarker` on every image file it is about to send (any path ending in `.webp`, `.png`, `.jpg`, `.jpeg`). If one returns `null`, the whole publish stops with no write and shows "This file is not a watermarked file from the uploader: <path>. Please process it again with the uploader." The check also runs on "Try again".
  - **Repo guard test** (`tests/task-15.spec.js`, part of the normal test run, so every later task's QA run also catches an unwatermarked photo):
    - It scans every file in the repo ending in `.webp`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.avif`, `.heic` (case-insensitive), skipping only `.git/`, `node_modules/`, `.claude/`, `test-results/`, and `playwright-report/`. `storyboard/` is scanned too (it is public).
    - Each file must carry the marker, **or** be listed in `tests/wm-allowlist.json` with its exact path, its SHA-256 hash, and a reason (for example `og-image.png`: "site screenshot, no photo of Puzz"). If an allowlisted file changes, its hash no longer matches and the test fails, so a photo cannot slip in under an old allowlist entry.
    - Files under `tests/fixtures/` must either carry the marker or be synthetic: decoded in the browser, they have at most 16 distinct colours (flat test images, not photos).
    - Every image path referenced by the site carries the marker (or is allowlisted) and exists: `photo` and `photoFull` in `data/events.json`, `thumb` in `data/reels.json`, `portrait` in `data/site.json`, and every `<img src>` and `og:image` in the public `*.html` pages. SVG files (for example `favicon.svg`, placeholders) are not photos and are not checked.
    - Each failure message names the file, so it is clear what to fix.
  - Hand commits (the Export / Download backup path) skip the Publish check. They are still caught by the repo guard test the next time the tests run. The admin help box adds: "Only commit photo files that came out of the uploader."
  - **Automated tests (`tests/task-15.spec.js`, desktop + phone; fake repo + fake token):**
    - Round trip: `readWatermarkMarker(addWatermarkMarker(x, info))` returns `info` for a WebP made by the uploader and for a PNG; `null` for `tests/fixtures/flat-2400x1600.png` and for 100 random bytes.
    - Upload the fixture: both Download files and both files in the pending list carry the marker, with `f` equal to `watermarkLayout(w, h).f` for that file's size and `div` equal to `WM_DIVISOR`. The test reads the expected numbers from `watermarkLayout` and `WM_DIVISOR` (80), not from hard-coded values.
    - The marked display copy decodes with `createImageBitmap` to the same size as before marking.
    - Publish check: inject an unmarked WebP into the pending list. Publish shows the "not a watermarked file" message naming that path, and the mock records no `POST` or `PATCH`.
    - Guard self-test: the guard logic, run on a temporary folder (not the repo) containing an unmarked `media/events/x/a.webp`, a marked one, an allowlisted file with a wrong hash, and a JSON reference to a missing file, reports exactly the 3 bad ones.
    - The real repo scan passes (with today's repo: only `og-image.png` is allowlisted).
- Status: done (merged into site-v1 on 2026-11-19; review approved round 1, QA passed)
- Review: approved 2026-11-19
- QA: passed 2026-11-19

### TASK-14: Site photos - portrait (Home + About), reel covers, share image, via the uploader and Publish - APPROVED 2026-11-18
- Linked idea(s): IDEA-10 (with IDEA-5, IDEA-8, IDEA-9)
- Depends on: TASK-7, TASK-13, TASK-15 (every site photo must carry the marker)
- Acceptance criteria:
  - **Data:** `data/site.json` exists as in section 4 with `"portrait": null`. `data/reels.json` keeps its format; `thumb` may now be `media/reels/<reel-id>.webp`.
  - **Admin Site photos panel:** a labelled target picker with exactly these 7 choices: "Portrait", "Reel cover: さ sa", "Reel cover: し shi", "Reel cover: す su", "Reel cover: せ se", "Reel cover: そ so", "Share image". It takes one image at a time and uses the same watermark pipeline as TASK-7: the same `watermarkLayout` (no second copy of the size rule), the same text and opacity controls, all white, the whole image covered, then the marker from TASK-15.
  - Output per target (see the table in section 4):
    - Portrait and Reel cover: one WebP (q0.85), longest side 1200px, aspect ratio kept, smaller images not enlarged.
    - Share image: one PNG, exactly 1200 x 630, centre-cropped to fill (no stretching), the watermark drawn **after** cropping so it covers the whole 1200 x 630 image. Larger than 5 MB -> "This share image is too big (over 5 MB). Try another photo." and it cannot be used.
  - The preview shows the picture, its pixel size, file size, and target path, plus a "Download" button (backup path) and a "Use for <target>" button.
  - "Use for Portrait" sets `portrait` in the site draft (localStorage key `puzzkezz.site.draft`); "Use for Reel cover X" sets that reel's `thumb`; "Use for Share image" only adds the file. Each adds the file to the pending list of the Publish panel (it counts towards the 20-photo limit), and the `beforeunload` warning covers it. A "Clear portrait" / "Clear cover" button sets the value back to `null` / `""`; the old file stays in the repo (it is watermarked, so that is harmless).
  - The admin never changes any other reel field (`url`, text) or any other part of `data/reels.json`.
  - **Publish (extends TASK-12/13):** the same single commit can also contain `data/site.json`, `data/reels.json`, `media/site/portrait.webp`, `media/reels/<reel-id>.webp` (only ids that exist in `data/reels.json`), and `og-image.png`. Any other new path is still refused before any request. The removal rules of TASK-13 are unchanged (only unused `.webp` under `media/events/`); site photos are replaced in place and never removed.
  - The stale check of TASK-12 also covers `data/site.json` and `data/reels.json`: each changed JSON keeps its own base SHA, and a different SHA on GitHub stops the publish with the stale message.
  - The pending list shows site photos as, for example, "Reel cover す -> media/reels/sugoi.webp (210 KB)". The commit message counts them as photos.
  - **Public pages:**
    - Home guest pass `.pass-photo` and About `.portrait` show `<img src="media/site/portrait.webp" alt="Portrait of Puzz Kezz">` when `portrait` is set. The About image loads eagerly; the guest-pass image is the first image on Home and loads eagerly too.
    - With `portrait: null`, a missing `data/site.json`, or a portrait file that fails to load, both slots show today's placeholder (same `aria-label`) and the page does not crash (TASK-3 and TASK-8 tests still pass).
    - Reel cards (Home `#reels` and `reels.html`) show the `thumb` image (`loading="lazy"`, alt "<English> reel cover", for example "Amazing! reel cover") when set, and the current placeholder when empty.
    - `og:image` stays `og-image.png` on every page (no HTML change).
  - **Automated tests (`tests/task-14.spec.js`, desktop + phone; fake repo + fake token):**
    - Portrait: upload `tests/fixtures/flat-2400x1600.png` to "Portrait". The output is `image/webp`, exactly 1200 x 800, carries the marker with `f` = `watermarkLayout(1200, 800).f`, and in a 3 x 3 grid every cell has pixels brighter than the source colour.
    - Reel cover: upload a 9:16 fixture (for example `tests/fixtures/flat-1080x1920.png`) to "Reel cover: す su". The output is 675 x 1200, the draft's `sugoi` reel has `thumb` = `media/reels/sugoi.webp`, and no other field of `data/reels.json` changed.
    - Share image: upload the 2400 x 1600 fixture. The output starts with the PNG signature, is exactly 1200 x 630, carries the `puzzkezz-wm` marker, and every cell of a 3 x 3 grid is watermarked.
    - Publish all three: one `POST .../git/trees` with exactly `data/site.json`, `data/reels.json`, `media/site/portrait.webp`, `media/reels/sugoi.webp`, `og-image.png`; no `sha: null` entries; the ref is updated once (one commit). Decoded blobs equal the Download files byte for byte and are not the fixture bytes.
    - Path guard: an injected `media/reels/not-a-reel.webp` or `media/site/other.webp` is refused with no network call.
    - Stale: the mock's `data/reels.json` SHA differs from the draft's base -> stale message, no `POST`/`PATCH`.
    - Public pages with mocked `data/site.json` and `data/reels.json`: the portrait `<img>` with the right alt shows on Home and About; a reel card shows its cover; routing the portrait to 404 shows the placeholder; `portrait: null` shows the placeholder.
    - After the publish test, the TASK-15 repo guard logic run on the fake repo's files reports no problems.
- Status: done (merged into site-v1 on 2026-11-19; review approved round 1, QA passed; BUG-4 minor open)
- Review: approved 2026-11-19
- QA: passed 2026-11-19 (tests/task-14.spec.js 20 passed; full suite 305 passed, 3 skipped, 0 failed at --workers=2; minor BUG-4 logged, not blocking)

Suggested build order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9. TASK-6 and TASK-7 only depend on 1 and 2.
Build order for the 2026-11-18 additions: TASK-10 -> TASK-7 (revised) -> TASK-11 -> TASK-12 -> TASK-13. TASK-11 can be built in parallel with TASK-10 and TASK-7. The shared mock `tests/github-mock.js` is created in TASK-11 and extended in TASK-12 and TASK-13.
Build order including IDEA-10 (approved 2026-11-18): TASK-10 -> TASK-7 (revised, `WM_DIVISOR` = 80) -> TASK-11 -> TASK-12 -> TASK-13 -> **TASK-15** -> **TASK-14**. TASK-15 comes before TASK-14 because every site photo needs the marker. If the user wants the marker earlier, the marker part of TASK-15 (`wm-marker.js` + marking in the uploader) can be built right after TASK-7; the Publish check still waits for TASK-13.
Build order including IDEA-11 (approved 2026-11-19): TASK-15 and TASK-14 are already done, so the remaining order is **TASK-16** (event + site photo link checks, Remove from publish, closes BUG-4) -> **TASK-17** (repo guard stale-hash rule). TASK-16 goes first because it guards live data.

---

## 6. Open questions (for Puzz to review - the planner's assumptions)

1. **Social handle and links.** (Partly answered: Instagram is `@notpuzzkezz` and Facebook is "Puzz Kezz".) Originally the plan assumed the handle `@puzzkezz` for the Instagram button and the default watermark. The real Instagram, TikTok, YouTube, and Facebook URLs and the contact email are unknown, so they are placeholders in `js/site-config.js`. Please send the real ones.
2. **Reel links.** The 5 さしすせそ reels have no URLs yet, so the cards show "Coming soon" until `data/reels.json` gets the Instagram reel URLs.
3. **Sample events.** The sample events use the con names CF, AMG, and Omatsuri for 2024-2026, with made-up dates. They are marked "Sample" and their activities are `[placeholder]`. Replace them through `/admin/` with your real history.
4. **Long hall.** You go to many cons a year. In v1, Home shows **every** event in the hall. If the list grows long (for example more than 15), should Home show only the most recent N, with "See all events" linking to the Events page?
5. **"Sound on" button.** In v1 it reads "さしすせそ" aloud once. Sound never plays automatically. Did you mean something else, like background music?
6. **Pronunciation in the MENU.** The phone menu subtitle "さしすせそ · sa shi su se so" shows Japanese + romaji only (no English line or speaker), to keep the menu clean. Is that OK?
7. **Speech voice.** The browser's built-in Japanese voice is used. It differs by device, and some phones or browsers have none, in which case the speaker button is hidden. Would you prefer recorded audio files (your own voice?) later?
8. **Admin is public but harmless.** `/admin/` has no password. It is hidden from search engines and the nav. Since IDEA-8 it can publish, but only in a browser that holds your GitHub token; for anyone else GitHub refuses. OK, or do you want it kept out of the deployed site completely?
9. **Facebook links.** Facebook links show the preview photo + "Open on Facebook" instead of an embedded player. That avoids loading Facebook's script.
10. **Gallery source.** In v1 the gallery shows only the event preview photos. A separate, bigger photo collection per event (several photos per event) would be a later idea.
11. **About / Contact text.** It is all `[placeholder]`. Please send a short bio, the things you are open to (collabs, bookings, photoshoots?), and your preferred contact method.
12. **Photo rights.** Before publishing con photos taken by photographers, please make sure you have their permission. The watermark text can be edited per batch, so a credit can be added when needed, for example "@notpuzzkezz · ph: @name".

### New questions for IDEA-8 / IDEA-9 (2026-11-18)

Already decided by you (2026-11-18), no need to answer:
- The watermark text is exactly `@notpuzzkezz`.
- "40%" means 40% opacity (the text is 40% visible), as the default and still adjustable.
- **Both** the full-size photo and the display copy get the same watermark (since the 2026-11-18 style change: the white dashed diagonal lattice with hearts and `@notpuzzkezz`, see TASK-7).
- The repo stays public.
- (Was question 13) **Display copy size: 1200px** on the longest side (about 100-300 KB per photo), instead of the proposed 1600px. See TASK-7.
- (Was question 14) **Old photos are deleted on Publish.** Any `.webp` file under `media/events/` that no event uses as `photo` or `photoFull` any more is removed in the same single commit, after a confirmation that lists the files ("These N old files will be removed", with Cancel). Files still used by any event are never removed, and nothing outside `media/events/` or with another extension is touched. Git history still keeps the old versions. See TASK-13.

No open questions remain for IDEA-8 / IDEA-9.

### Questions for IDEA-10 (2026-11-18)

Already decided by you (2026-11-18, with "Plan approved and storyboard approved"), no need to answer:
- (Was question 15) **Watermark density: 2x.** `WM_DIVISOR` = 80, so `f` = round(shorter side / 80), min 8px, for every photo (events, portrait, reel covers, share image). On a 1200 x 800 display copy the name is about 10px tall; on a 6000 x 4000 master `f` = 50. See TASK-7.
- (Was question 16) **Share image:** keep the current site screenshot `og-image.png` until you upload a Share image photo. See TASK-14.
- (Was question 17) **Portrait and reel covers:** one 1200px watermarked file each, no full-size copy. See TASK-14.
- (Was question 18) **Hand commits:** an automatic GitHub Action that runs the watermark guard on every push is a later idea, out of scope for this plan. Until then, hand-committed files are caught when the tests run (TASK-15).

No open questions remain for IDEA-10.

### Questions for IDEA-11 (2026-11-19) - ANSWERED 2026-11-19 ("TASK-16 approved, yes")

19. **Use both protections (option (c))?** The planner recommends yes: Publish checks every event photo link against GitHub before it writes anything and refuses with a message naming the event, **and** "Remove from publish" fixes the draft right away. The check also covers cases the button can't see (a page reload loses the pending photos but keeps the draft, an Import, a typed path). Side effect: an event photo path written in an unusual form (for example `./media/...` or `...webp?v=2`) now stops the publish with a message, instead of publishing with a note. Yes / only one of them?
20. **What "Remove from publish" does to the event:** the planner recommends **putting back the photo that is live now** (from the published events.json), or clearing the photo when there is none. The other choice, always clearing the photo, would make the old photo unused, so the next Publish would offer to delete it. Put back (recommended) / always clear?
    - **User answer to 19 (2026-11-19): yes, both protections (option (c)).** Extended the same day to site photos (portrait, reel covers) to close BUG-4. See TASK-16.
    - **User answer to 20 (2026-11-19): yes, put back the published photo** (clear only when there is none). See TASK-16 (2).

Detail decided by the planner (say if you disagree): if GitHub's file list is ever incomplete ("truncated", only at about 100,000 files), Publish refuses rather than guessing.

### Question found while building TASK-15 (2026-11-19, programmer)

21. **More files on the watermark allowlist than "only og-image.png".** The TASK-15 test says that with today's repo only `og-image.png` is allowlisted, but the repo also holds 10 other committed PNGs that are not photos and do not come from the uploader: the 9 site screenshots in `docs/screenshots/` (sample data, `[Portrait]` placeholders) and the text-only reference picture `extra_asset/puzz-extra-asset/sashisuseso-reference.png`. The scan must cover them (only `.git/`, `node_modules/`, `.claude/`, `test-results/`, `playwright-report/` are skipped), so the programmer put all 11 files on `tests/wm-allowlist.json`, each with its SHA-256 and a reason ("no photo of Puzz"). Is that OK, or should these files be deleted from the repo (or moved out of it) instead? Nothing else in TASK-15 changes.
    - **User answer (2026-11-19): "Stay until I upload my photo."** The 11 allowlisted non-photo images stay in the repo for now. Revisit when the user uploads their own photos (TASK-14 in use): at that point the screenshots / og-image screenshot can be replaced or removed.

### Question found while building TASK-14 (2026-11-19, programmer)

22. **og-image.png allowlist entry after a Share image is published.** The repo guard (TASK-15) fails when an allowlisted file's SHA-256 changes, even if the new file carries the uploader's marker. So the first time Puzz publishes a Share image (a marked PNG written over `og-image.png`), the next test run fails on the old `og-image.png` entry in `tests/wm-allowlist.json` until that entry is removed by hand (the marked file then passes on its own), and the TASK-15 test line that expects `og-image.png` on the allowlist must change too. The programmer did not change the guard (that would weaken a TASK-15 rule). Options: (a) remove the entry by hand when the share image is published (current behaviour), (b) let the guard accept a marked file even when its allowlist hash is stale. Which one?
    - **User answer (2026-11-19): yes, the narrow guard fix (b)** as the reviewer proposed: exact-hash allowlisting stays; a marked file with a stale hash passes and is reported as stale; an unmarked file with a stale hash still fails. See TASK-17.

No open questions remain for IDEA-11 or the TASK-14 / TASK-15 follow-ups. Questions 1-12 above are still open.

---

## 7. IDEA-12 addition: Hall ??? 番外 (bangai) - PROPOSED 2026-11-23, waiting for user approval

- Source: docs/ideas.md IDEA-12 and its "User decisions (2026-11-23)" block. The user approved the updated storyboard (storyboard/, HOME screen) on 2026-11-23.
- Note: IDEA-12 still has `Status: new` in docs/ideas.md (the idea-collector should set it to `ready-for-planning`).
- Branch: `feature/hall-bangai`, made from `site-v1`. Merge back into `site-v1` (read "main" as `site-v1`, see the branch note at the top).

### What it is
One special entry, **Hall ??? 番外** (ばんがい, ban-gai, "extra, outside the numbering"). It holds funny and special moments from every year. It is not a con. It always sits at the very end of the hall, after the oldest year and before `END OF HALL · 5 REELS`. On the YOU ARE HERE strip it is the last label, `???`, set apart from the years. Its polaroid shows a shy kaomoji `(*/ω＼*)`. It is the **only** polaroid that opens a pop-up instead of flipping. The pop-up is an album of photos, videos and social links.

### Planner assumptions (decided by the planner, the user can veto any of them, see questions 23-26)
- **A1 - "Always last" lives in the code, not in the data.** `js/hall.js` always adds Hall ??? after the last year group. It is **not** an event in `data/events.json`. So `validateEvent`, `makeEventId`, the date sort, the admin move up / move down and Publish do not change, and it cannot be moved by mistake. It has no hall letter (the letters A, B, C... count real events only) and is not counted in the hero summary ("21 events · 2026 → 2023").
- **A2 - One entry for all time.** There is exactly one Hall ???. It is not one per year.
- **A3 - Moments live in a separate file, `data/moments.json`** (format below). Each moment has a `year` label for its caption. There is no date, because moments are not sorted into the timeline.
- **A4 - Moment photos are one watermarked 1200px file each** (like the portrait and reel covers, TASK-14), at `media/moments/<moment-id>.webp`. They are made by the same uploader pipeline: the same lattice watermark, `WM_DIVISOR` = 80, and the TASK-15 marker. There is no full-size master, because the album shows photos at layout size only. The IDEA-10 rule applies: no unwatermarked photo is ever committed, and the repo guard checks `data/moments.json` too (TASK-22).
- **A5 - Where it shows:** Home (hall + strip + pop-up, TASK-19) and the Events page (a last section after the oldest year that opens the same album, TASK-20). **Not on the Gallery** for now. That keeps it a small easter egg and keeps the Gallery to con photos only.
- **A6 - Empty state, no sample moments.** Today `data/moments.json` is `{ "version": 1, "moments": [] }`. Hall ??? still shows on Home (it is always there). The album shows "Nothing here yet. (>///<) Come back later." No fake sample moments are added.
- **A7 - Adding moments through `/admin/` is separate work** (TASK-21 data, TASK-22 photos). Until then, moments can be added by hand in `data/moments.json` (links only, or photos that came out of the uploader's Download).
- **A8 - Album order:** newest `year` first. Moments without a year go last. Moments with the same year keep their array order.
- **A9 - Filter chips:** All / Photos / Videos & links. A moment with a `link` counts as "Videos & links" even if it also has a photo (the photo is its preview).

### `data/moments.json` (new, contract for TASK-19 to TASK-22)
```json
{
  "version": 1,
  "moments": [
    {
      "id": "2025-wig-fell-off",
      "year": 2025,
      "caption": "Wig fell off on the escalator",
      "alt": "Puzz holding a pink wig, laughing",
      "photo": "media/moments/2025-wig-fell-off.webp",
      "link": "https://www.instagram.com/reel/XXXX/"
    }
  ]
}
```
- Required: `id` (lowercase letters, digits and `-`, unique) and at least one of `photo` or `link`.
- Optional: `year` (a whole number from 2000 to 2100), `caption` (1-140 characters), `alt` (plain text; defaults to the caption, then to "Special moment"), `photo` (a relative path in plain form, rules as in TASK-10), `link` (http/https only).
- Embeds use `detectEmbed` / `renderMedia` from `js/embed.js`, behind the same click-to-load facade as the Events page. Facebook and other links show the photo (or a placeholder) and an external link.
- A moment that breaks the rules is skipped with one console warning. It does not break the album.

### Sitemap and flow additions
- `/index.html` HOME: after the oldest year group, a `???` year sign, then the Hall ??? station: a hall sign `HALL ???` with 番外 (furigana ばんがい) and "bangai · the extra one", the shy polaroid, and a pronunciation block. On the strip, `???` is the last label, with one tick.
- `/events.html` EVENTS: after the oldest year, a last section "Hall ??? 番外" with one card that opens the same album (TASK-20).
- `/admin/`: a **Moments** panel (TASK-21) and a "Moment photo" uploader target (TASK-22).

**F13 - Finding Hall ??? (visitor)**
Home -> scroll past the oldest year (or tap `???` on the YOU ARE HERE strip) -> the `???` sign and the shy polaroid -> tap the polaroid -> the album pop-up opens (focus on CLOSE) -> filter Photos / Videos & links -> tap a video facade -> the embed loads -> Esc, CLOSE or a tap on the backdrop -> the pop-up closes and focus goes back to the polaroid.

**F14 - Puzz adds a moment (admin, after TASK-21/22)**
Admin -> Moments -> "New moment" -> year, caption, alt, link and/or "Moment photo" upload (watermarked 1200px file) -> Save (draft) -> Publish to GitHub -> one commit with `data/moments.json` (and the photo) -> the moment shows in the album after GitHub Pages redeploys.

### TASK-19: Home - Hall ??? 番外 station, `???` on the timeline, album pop-up from `data/moments.json`
- Linked idea(s): IDEA-12 (with IDEA-3, IDEA-6, GLOBAL NOTES pronunciation)
- State: **already built** on `feature/hall-bangai` (commit 7988c22: `js/bangai.js`, `js/hall.js`, `css/home.css`, `data/moments.json`, `tests/task-3.spec.js`, storyboard). **Not reviewed, not QA-tested, tests never run** (no Playwright browsers in the cloud session). The reviewer checks it against the criteria below; gaps go back to the programmer as normal review items.
- Amends TASK-3: the strip's text labels are the years **plus the one `???` label at the end**. The hall ends with Hall ??? and then `END OF HALL · 5 REELS`.
- Acceptance criteria:
  - **Placement:** after the last (oldest) year group, the hall always has a year sign `???` (`id="year-bangai"`) and then one station `id="hall-bangai"`, right before `END OF HALL · 5 REELS`. This is true for any `data/events.json`, including after an event is added. If there are no events, the hall shows "Events coming soon." and no Hall ???.
  - Hall ??? takes no hall letter: with N events the labels are `HALL A` ... `HALL <Nth letter>` then `HALL ???`. The hero summary counts real events only.
  - **Sign:** `HALL ???`, 番外 with furigana ばんがい (`<ruby>`, `lang="ja"`), and "bangai · the extra one". The plate looks different from con signs (dashed purple border, dark card), as in the storyboard.
  - **Pronunciation rule:** the station has a full pronunciation block for 番外 (Japanese with furigana, romaji `ban-gai`, English "Extra, outside the numbering", speaker with `aria-label="Play pronunciation: ban-gai"`). The pop-up title 番外 also has romaji, English **and a speaker** (no Japanese without all parts; the current build has no speaker in the pop-up title).
  - **Polaroid:** a `<button>` with the kaomoji `(*/ω＼*)` (`aria-hidden="true"`), a caption, `aria-haspopup="dialog"`, `aria-controls="bangai"`, `aria-expanded` false/true, and a clear `aria-label` ("Hall ???, bangai. Open the special album..."). It does **not** flip. Every other polaroid still flips (TASK-3 tests pass). The kaomoji peek animation only runs without reduced motion.
  - **Timeline:** the last label is `???` (after the oldest year), with one tick after it (`aria-label="Hall ???, bangai"`). It is set apart from the year line as in the approved storyboard. Clicking `???` scrolls to `#year-bangai` and the tick to `#hall-bangai`. The current-position highlight reaches `???` when the user scrolls there. Targets are at least 44px on phone.
  - **Pop-up:** a native `<dialog id="bangai">` opened with `showModal()`, labelled by its heading. It has a lace edge, the eyebrow `HALL ??? · ALL YEARS`, the title, a short intro, the chips All / Photos / Videos & links (`aria-pressed`), and the album grid (1 column on a narrow phone under 600px, 2 columns from 600px, 3 on desktop; the user chose 1 column on phone on 2026-11-23, and keeps "Videos & links" as one chip for now). Focus goes to CLOSE when it opens. Esc, CLOSE and a click on the backdrop close it, and focus returns to the polaroid. The page behind does not scroll while it is open.
  - **Data:** `data/moments.json` is fetched only when the pop-up is first opened, not on page load, and only once. Moments are validated as in the format above (bad ones are skipped with one console warning) and shown in the A8 order. Each item shows its media (photo with `loading="lazy"` and alt, or a click-to-load facade for YouTube / Instagram / TikTok, or photo + external link with `rel="noopener"`) and a caption `<year> · <caption>`. No iframe is in the DOM before a facade is clicked. No request to youtube / instagram / tiktok happens before a click.
  - **Filters:** Photos shows only moments without a `link`. Videos & links shows only moments with a `link`. All shows everything. When a filter has nothing, the empty message shows.
  - **Empty state:** with today's empty `moments` list, or when the file fails to load, the album shows "Nothing here yet. (>///<) Come back later." and nothing crashes.
  - Opening twice quickly (double click) opens the pop-up once, with no console error.
  - Reduced motion: Hall ??? is in the stacked list like the other stations, with no transforms.
  - No horizontal scroll at 360px. The pop-up fits a 360px-wide screen.
  - Matches the approved storyboard (HOME screen and the album pop-up on desktop and phone) and uses only style-guide tokens.
  - **Automated tests:** `tests/task-3.spec.js` (as edited on the branch) and a new `tests/task-19.spec.js` (desktop + phone) covering: order and placement with mocked events; no letter for Hall ???; strip labels `2026 2025 2024 ???`; the click on `???` scrolls and highlights; polaroid opens the dialog, does not flip; focus on CLOSE, Esc / CLOSE / backdrop close, focus back; `moments.json` not requested before the first open and requested once; filters with a mocked list (photo only, link only, both); bad moment skipped (`javascript:` link, `/abs.webp` photo, no photo and no link); empty list and 404 show the empty message; facade loads an iframe only after a click; speaker buttons present for both 番外 blocks; reduced-motion stack. The full suite must still pass.
- Status: in-progress (built, waiting for review) - finished 2026-11-23 on branch `task/TASK-19-home-hall-bangai`: speaker in the pop-up title, moments validation (id, year, caption, http/https links, safe relative photo paths, duplicate ids), A8 order, one fetch per page, double-open guard, scroll lock on Home, album code shared via `bindAlbumTrigger()`. tests/task-19.spec.js + tests/task-3.spec.js pass (desktop + phone, run with system Chrome)
- Review: approved 2026-11-23
- QA: pending

### TASK-20: Events page - last section "Hall ??? 番外" that opens the same album
- Linked idea(s): IDEA-12 (with IDEA-6)
- Depends on: TASK-19 (reuses its pop-up and moments loader)
- Acceptance criteria:
  - After the oldest year section, `events.html` has one last section with the heading "Hall ??? 番外" (pronunciation block for 番外) and the anchor `id="hall-bangai"` (not `bangai`, which is the pop-up's id), so `events.html#hall-bangai` scrolls to it. The year jump row ends with a `???` link to it.
  - The section has one card: the shy kaomoji, the line "Funny and special moments, all years", and an "Open album" button that opens the same pop-up as Home (same code from `js/bangai.js`, not a copy). Focus goes back to the button when it closes.
  - It is not counted as an event, has no date or "Sample" tag, and does not change the order of the real events.
  - With no events, the page shows "Events coming soon." and no Hall ??? section (same rule as Home).
  - No horizontal scroll at 360px. TASK-5 tests still pass.
  - **Automated tests (`tests/task-20.spec.js`, desktop + phone):** the section is last, the jump row ends with `???`, `#hall-bangai` deep link works, "Open album" opens the dialog with the mocked moments, Esc closes it and focus returns.
- Status: in-progress (built, waiting for review) - built 2026-11-23 on branch `task/TASK-20-events-hall-bangai` (made from the TASK-19 branch). tests/task-20.spec.js + tests/task-5.spec.js pass (desktop + phone, run with system Chrome)
- Review: approved 2026-11-23
- QA: passed 2026-11-23

### TASK-21: Admin - Moments panel (list, add, edit, delete, reorder) and Publish `data/moments.json`
- Linked idea(s): IDEA-12 (with IDEA-7, IDEA-8)
- Depends on: TASK-19 (the format), TASK-12 / TASK-14 (Publish and the per-file stale check)
- Acceptance criteria:
  - A **Moments** panel in `/admin/` lists the moments in album order (A8) with Edit, Delete (asks for confirmation), Move up / Move down (only between moments of the same year).
  - The form has labelled fields: year (optional number), caption (max 140), alt text, link (URL), photo path (filled by TASK-22, or typed). Validation follows the moments format: errors show next to the field and nothing is saved. A new moment gets an id `<year or "x">-<slug(caption)>` with `-2`, `-3`... when taken.
  - The draft is kept in `localStorage` key `puzzkezz.moments.draft` with its own base SHA, like the site draft. "Discard draft" also restarts the moments draft.
  - Publish puts `data/moments.json` (sorted as A8, 2-space indent, trailing newline) in the **same single commit** as the other changes. The stale check covers it (a different SHA on GitHub stops the publish with the stale message). `data/moments.json` is added to the allowed paths. Nothing else in Publish changes.
  - All moment text is rendered with `textContent` (no `innerHTML`). The token rules of TASK-11 stay.
  - **Automated tests (`tests/task-21.spec.js`, fake repo + fake token):** add / edit / delete / reorder with reload; validation errors; Publish commits `data/moments.json` in one tree with the expected text; stale `moments.json` stops with no `POST` / `PATCH`; publishing events only does not touch `data/moments.json`; earlier admin tests pass.
- Status: todo (proposed)
- Review:
- QA:

### TASK-22: Moment photos - uploader target, Publish, unused-photo removal, link check and repo guard
- Linked idea(s): IDEA-12 (with IDEA-9, IDEA-10, IDEA-11)
- Depends on: TASK-21, TASK-14, TASK-15, TASK-16
- Acceptance criteria:
  - The uploader gets a target "Moment photo" (for the moment open in the Moments form). It makes **one** WebP q0.85, longest side 1200px, not enlarged, with the same lattice watermark (`watermarkLayout`, `WM_DIVISOR`) and the TASK-15 marker. Path `media/moments/<moment-id>.webp` (`-2`, `-3`... if taken). "Use for moment" fills the moment's `photo`, saves the draft and adds the file to the pending list (it counts towards the 20-photo limit). Download works as a backup.
  - Publish allows new files only at `media/moments/<id of a moment in the draft>.webp`. The marker check (TASK-15) runs on them.
  - **Unused-photo removal** (TASK-13 rules) is extended to `.webp` files under `media/moments/` that no moment uses, in the same confirmation dialog and the same single commit. Nothing else is removable.
  - **Broken-link check** (TASK-16) is extended: a moment `photo` under `media/moments/` that is neither in the repo tree nor in this publish stops the publish with a message naming the moment. "Remove from publish" on a moment photo puts back the published photo (or clears it), as in TASK-16.
  - **Repo guard** (`tests/wm-guard.js`): every `photo` in `data/moments.json` must exist and carry the marker (or be allowlisted). Self-test reports a missing and an unmarked moment photo.
  - **Automated tests (`tests/task-22.spec.js`):** upload the 2400 x 1600 fixture as a moment photo (1200 x 800, marker, every cell of a 3 x 3 grid watermarked); Publish commits it with `data/moments.json` in one commit; replace a moment photo -> removal dialog lists the old file; a broken moment link stops with no write; guard self-test. Full suite passes.
- Status: todo (proposed)
- Review:
- QA:

Build order for IDEA-12: **TASK-19** (review + QA of the existing build) -> **TASK-20** -> **TASK-21** -> **TASK-22**. TASK-19 and TASK-20 together give the visitor-facing feature. TASK-21 and TASK-22 can wait; until then moments are added to `data/moments.json` by hand (A7).

### Questions for IDEA-12 (2026-11-23) - the planner's defaults, say if you disagree
23. **Storage and order (A1, A3, A8):** Hall ??? is always last in code, not an event in events.json. Moments live in `data/moments.json`, newest year first. OK?
24. **Where it shows (A5):** Home and the Events page, **not** the Gallery. OK, or do you want the moment photos in the Gallery too (labelled "Hall ???")?
25. **Moment photos (A4):** one watermarked 1200px file per photo, no full-size version and no full-size viewer in the album. OK, or do you want tap-to-enlarge with a full-size master like the Gallery?
26. **Admin (A7):** Moments in `/admin/` (TASK-21, TASK-22) are separate tasks after the Home and Events parts. Until then moments are added to `data/moments.json` by hand. Build the admin part now, later, or never?
