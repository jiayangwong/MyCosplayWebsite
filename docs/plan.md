# Plan - Puzz Kezz website, version 1

- Written: 2026-11-17 by the planner
- Source: docs/ideas.md (GLOBAL NOTES + IDEA-3, IDEA-5, IDEA-6, IDEA-7, all `ready-for-planning`)
- Out of scope for v1: IDEA-1 (wardrobe), IDEA-2 (gacha), IDEA-4 (petal storm)
- Visual concept: "Concept 6B" on the design canvas "Puzz Kezz homepage concepts"
- Status: draft. Waiting for the user to review. The user was asleep when this was written, so the planner made the decisions itself. Every assumption is listed under "Open questions".

### Branch note (this job only)
The integration branch is **`site-v1`**. It takes the place of `main`, because the real `main` is checked out somewhere else. Each task branch (for example `task-3-home-hall`) is created from `site-v1` and merged back into `site-v1`. Wherever CLAUDE.md says "main", read `site-v1`.

---

## 1. Goal

Build a fast static portfolio site for Puzz Kezz, a Malaysian cosplayer who crossplays female characters and likes Lolita. It should feel like his own space, not like SleepyStella's. The visual tone is about 3-4 on the 1 (feminine) to 10 (masculine) scale: bold gothic sans, mono labels, ink outlines, square-ish corners, and baby pink and purple only as accents. The home page is a convention-hall walk-through (Concept 6B). Visitors scroll past hanging hall signs and polaroids of his cosplays. A "YOU ARE HERE" strip runs along the bottom of the hall as a newest-first timeline that shows years only. The hall ends at the さしすせそ reel section, which is there to get people watching his reels. Every Japanese word on the site shows how to say it: furigana over kanji, then romaji, then English, plus a speaker button. Events are not hard-coded. Puzz enters them on a private, browser-only event manager page, along with photos that get a watermark automatically. Because there is no database, the content lives in JSON files committed to the repo.

---

## 2. Sitemap / screens

Public tabs, in this order: HOME · GALLERY · REELS · EVENTS · ABOUT · CONTACT

| Path | Screen | Contents |
|---|---|---|
| `/index.html` | HOME | Header. Hero hall walk-through: a steel truss across the top, a hanging hall sign for each event (`HALL A · COMIC FIESTA`), and event polaroids at different depths (near = big, far = small). Polaroids flip to a dark "Watch reel" card. Year marker signs appear wherever the year changes. Intro: a con **GUEST PASS** on a lanyard reading `PUZZ KEZZ` / `COSPLAYER · LOLITA · MALAYSIA` / "Not a beatboxer. Just here to cosplay.", a "Watch my reels" button, and one subtle lace edge. A sticky **YOU ARE HERE** strip at the bottom of the hall works as a descending year timeline (year labels only, small ticks for events). A persistent "Skip to reels" button. The hall ends at the `END OF HALL · 5 REELS` sign, followed by the さしすせそ reel section. Footer. |
| `/gallery.html` | GALLERY | Grid of the event preview photos from `data/events.json`, newest first. Each caption shows the event short form, the full name, and the year. Clicking a photo opens a larger view. If there are no photos yet, an empty-state message shows. |
| `/reels.html` | REELS | The full さしすせそ section: header with pronunciation, the "Sound on" button, and 5 reel cards. Five in a row on PC, a swipe carousel on phone. |
| `/events.html` | EVENTS | Events grouped by year (newest year first), with a jump row for the years. Each event card shows the date, short form, full name, venue (if set), the activities list, and media (click-to-load embed, preview photo, or placeholder). Each card can be linked to as `events.html#<event-id>`. |
| `/about.html` | ABOUT | Simple v1 page: heading, a portrait placeholder, and bio text marked `[placeholder]`. No invented facts. |
| `/contact.html` | CONTACT | Simple v1 page: "Collabs & bookings" text `[placeholder]`, a mailto link `[email placeholder]`, and social links. No form (there is no backend). |
| `/admin/index.html` | Event manager (not public) | Not in the nav. Has `noindex`. Event list (edit / delete / move up / move down), event form, validation, localStorage draft, Import / Export `events.json`, embed preview, and the media uploader with automatic watermark. |

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
Go to `/admin/` (typed URL or bookmark) -> the published events load (from the draft if one exists, otherwise from `data/events.json`) -> "New event" -> fill in the date, short form, full name, venue, activities, and social link -> the embed preview appears -> Save (the draft goes to localStorage) -> "Export events.json" -> the file downloads -> he replaces `data/events.json` in the repo and commits/pushes -> GitHub Pages updates -> the new event appears in the hall, the timeline, the Events page, and the Gallery.

**F9 - Puzz adds watermarked photos (admin)**
Admin -> Media uploader -> pick one or many images -> watermarked WebP previews appear (he can change the text, position, and opacity) -> download each file, or download all -> choose "Attach to event" for one of them -> the event's `photo` becomes `media/events/<event-id>/<file>.webp` -> Export events.json -> he commits the JSON and the image files at that path.

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
| Event manager | `/admin/` runs 100% in the browser. Drafts are kept in `localStorage`. Export/Import `events.json`. | No server or login needed. The page cannot change the live site by itself: changes only go live when Puzz commits the exported file, so a public `/admin/` URL is harmless. |
| Media | Canvas watermark, resize to a longest side of at most 2000px, WebP output, in the browser. | No server and no upload service. Redrawing on a canvas also removes EXIF data, including GPS location, which helps privacy. |
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
data/events.json  data/reels.json
media/events/<event-id>/*.webp   media/placeholder/*.svg
robots.txt   tests/task-<n>.spec.js
```

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
      "sample": true
    }
  ]
}
```
- Required fields: `id`, `date` (a real calendar date in `YYYY-MM-DD`), `short` (1-12 characters), `name`. Optional: `venue`, `activities` (array of strings, may be empty), `link` (http/https URL), `photo` (relative path), `sample` (boolean).
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
- Status: todo
- Review: -
- QA: -

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
- Status: todo
- Review: -
- QA: -

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
- Status: todo
- Review: -
- QA: -

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
- Status: todo
- Review: -
- QA: -

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
- Status: todo
- Review: -
- QA: -

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
  - A short help box on the page says: "Changes are only on this browser until you export events.json, replace data/events.json in the repo, and push."
  - The page uses the site tokens and is usable at phone width.
- Status: todo
- Review: -
- QA: -

### TASK-7: Media uploader with automatic watermark (on `/admin/`)
- Linked idea(s): IDEA-7
- Acceptance criteria:
  - A file input accepts multiple images (`accept="image/*"`, `multiple`). Choosing files shows one preview per file.
  - Each output image:
    - has a longest side of at most 2000px, keeping the aspect ratio (images that are already smaller are not enlarged)
    - is WebP (`image/webp`, quality about 0.85)
    - is named `<original-name-slug>-wm.webp`
  - The watermark text defaults to `PUZZ KEZZ · @puzzkezz` and can be edited. The default position is bottom-right, and the choices are bottom-right, bottom-left, top-right, top-left, and center. The default opacity is 60%, adjustable from 10 to 100%.
  - The font size scales with the image (about 3.5% of the shorter side, never below 14px). There is a thin dark outline or shadow, so the text can be read on both light and dark photos.
  - Changing the text, position, or opacity re-renders all previews.
  - Test: upload a test image from `tests/fixtures/`, then read pixels from the output canvas. The bottom-right area differs from the source, the top-left area matches it (within tolerance), and the output size is at most 2000px.
  - Each preview has a "Download" button and there is a "Download all" button. Downloads are tested with the Playwright download event and the `.webp` filename.
  - Each preview shows its suggested repo path `media/events/<event-id>/<file>.webp` for the selected event.
  - "Attach to selected event" puts that path in the event's photo field (TASK-6 form) and saves the draft.
  - Processing happens only in the browser. No network requests are made with the image (checked in the test by watching `page.on('request')`).
  - A note on the page says the output removes the photo's location and camera data.
- Status: todo
- Review: -
- QA: -

### TASK-8: Gallery, About, Contact (simple v1 pages)
- Linked idea(s): GLOBAL NOTES (tabs), IDEA-7 (photos feed the gallery)
- Acceptance criteria:
  - **Gallery** is built from the events in `data/events.json` that have a `photo`, newest first. Each tile shows the photo (`loading="lazy"`, alt `<full name> <year>`) and a caption with the short form, full name, and year.
  - Clicking a tile opens a larger view in a `<dialog>` that closes with Escape or the close button. If no event has a photo, the text "Photos coming soon" shows.
  - **About** has an `<h1>`, a portrait placeholder image with alt text, and bio paragraphs written as `[placeholder]`. No invented facts about Puzz.
  - **Contact** has the heading "Collabs & bookings", a `[placeholder]` text, a `mailto:` link using the email from `js/site-config.js` (a placeholder until the user provides one), and social links (new tab, `rel="noopener"`).
  - Contact has no form.
  - On all three pages the correct tab is active (`aria-current="page"`). No horizontal scrolling at 360px.
- Status: todo
- Review: -
- QA: -

### TASK-9: Polish pass - meta tags, 404, accessibility and performance check
- Linked idea(s): GLOBAL NOTES, IDEA-3
- Acceptance criteria:
  - Every public page has a `<meta name="description">`, Open Graph title, description, and image, `lang="en"`, and a favicon.
  - A `404.html` page in the site style links back to Home (GitHub Pages serves it for unknown paths).
  - An automated axe-style check, or manual checks recorded in the QA notes, finds no images without alt text, no buttons without names, and no skipped heading levels on any page.
  - Before any interaction, the Home page makes no requests to youtube, instagram, or tiktok domains (checked in Playwright).
  - Text colour contrast against its background is at least 4.5:1 for body text, using the token pairs in the style guide.
  - All earlier `tests/task-*.spec.js` pass in both projects.
- Status: todo
- Review: -
- QA: -

Suggested build order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9. TASK-6 and TASK-7 only depend on 1 and 2.

---

## 6. Open questions (for Puzz to review - the planner's assumptions)

1. **Social handle and links.** The plan assumes the handle `@puzzkezz` for the Instagram button and the default watermark. The real Instagram, TikTok, YouTube, and Facebook URLs and the contact email are unknown, so they are placeholders in `js/site-config.js`. Please send the real ones.
2. **Reel links.** The 5 さしすせそ reels have no URLs yet, so the cards show "Coming soon" until `data/reels.json` gets the Instagram reel URLs.
3. **Sample events.** The sample events use the con names CF, AMG, and Omatsuri for 2024-2026, with made-up dates. They are marked "Sample" and their activities are `[placeholder]`. Replace them through `/admin/` with your real history.
4. **Long hall.** You go to many cons a year. In v1, Home shows **every** event in the hall. If the list grows long (for example more than 15), should Home show only the most recent N, with "See all events" linking to the Events page?
5. **"Sound on" button.** In v1 it reads "さしすせそ" aloud once. Sound never plays automatically. Did you mean something else, like background music?
6. **Pronunciation in the MENU.** The phone menu subtitle "さしすせそ · sa shi su se so" shows Japanese + romaji only (no English line or speaker), to keep the menu clean. Is that OK?
7. **Speech voice.** The browser's built-in Japanese voice is used. It differs by device, and some phones or browsers have none, in which case the speaker button is hidden. Would you prefer recorded audio files (your own voice?) later?
8. **Admin is public but harmless.** `/admin/` has no password. It can't change the live site, because only the exported file you commit does that. It is hidden from search engines and the nav. OK, or do you want it kept out of the deployed site completely?
9. **Facebook links.** Facebook links show the preview photo + "Open on Facebook" instead of an embedded player. That avoids loading Facebook's script.
10. **Gallery source.** In v1 the gallery shows only the event preview photos. A separate, bigger photo collection per event (several photos per event) would be a later idea.
11. **About / Contact text.** It is all `[placeholder]`. Please send a short bio, the things you are open to (collabs, bookings, photoshoots?), and your preferred contact method.
12. **Photo rights.** Before publishing con photos taken by photographers, please make sure you have their permission. The watermark can also include a credit, for example "PUZZ KEZZ · @puzzkezz · ph: @name".
