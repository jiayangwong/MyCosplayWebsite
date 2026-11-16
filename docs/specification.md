# Puzz Kezz website: specification (v0.1.0, 2026-11-17)

Status: built and tested on branch `site-v1`. The plan, style guide and storyboard are still **drafts that need Puzz's approval** (see "Not done yet" at the end).

## 1. What it is
A fast static portfolio site for Puzz Kezz (Malaysian cosplayer, Lolita fan). The look is "Concept 6B": a convention-hall zine, about 3-4 on the 1 (feminine) to 10 (masculine) scale. Baby pink and purple appear only as accents on a cool grey-lilac base, with ink outlines and mono labels.

## 2. Languages, stack and hosting
| Part | Choice | Why |
|---|---|---|
| Pages | HTML5 | Works anywhere, no build step |
| Styling | CSS with custom properties (`css/tokens.css` holds every colour, font and spacing) | One place to change the look |
| Behaviour | Vanilla JavaScript ES modules (no framework) | Small and fast on phones, easy to edit |
| Data | JSON files in `data/` (no database, as requested) | Version-controlled; can move to a CMS later |
| Fonts | Zen Kaku Gothic New (Latin + Japanese) and Space Mono (labels), from Google Fonts | Matches 6B |
| Hosting | GitHub Pages; `CNAME` = `puzzkezz-testing.loc.cc` | Free HTTPS, deploys on push |
| Tests | Playwright (`tests/task-1..9.spec.js`), PC 1280x800 and phone (Pixel 7) | 80 automated checks |

## 3. Pages
| Path | What's on it |
|---|---|
| `index.html` HOME | Steel truss and a **GUEST PASS** on a lanyard (PUZZ KEZZ / COSPLAYER · LOLITA · MALAYSIA / tagline / Watch my reels). Then the **convention hall**, built from `data/events.json` and newest first. Each event has a hanging sign `HALL A · COMIC FIESTA` and a polaroid, and a **year sign** appears where the year changes. Polaroids sit at near/mid/far depths, and scrolling moves the "camera" so stations grow as you walk past. Click a polaroid and it flips to a dark card with **Watch reel** (when the event has a link) or **See event**. The sticky **YOU ARE HERE** strip is a **descending timeline with years only** (2026 · 2025 · 2024). Each event is an unlabelled tick between the years. It highlights where you are, and clicking a year or tick jumps there. A "Skip to reels" button sits beside it. The hall ends at `END OF HALL · 5 REELS`, then the さしすせそ section. |
| `reels.html` REELS | The さしすせそ section on its own page. |
| `events.html` EVENTS | Years newest first with a jump row. Each card shows the date, short form, full name, venue, activities and media. Videos (YouTube / Instagram / TikTok) load only when clicked. Other links show the photo and an "Open on …" link. Sample events carry a **Sample** tag. Cards can be linked to with `events.html#<event-id>`. |
| `gallery.html` GALLERY | Every event photo, newest first, with a bigger view in a dialog. Shows "Photos coming soon" until photos are added. |
| `about.html`, `contact.html` | Simple v1 pages with `[placeholder]` text. Contact has a mailto link and social links but no form. |
| `admin/index.html` | **Event manager** plus the **media uploader** (see §5). It is not linked from the site and is blocked in `robots.txt` with `noindex`. |
| `404.html` | "Lost in the hall" page, which GitHub Pages serves for unknown URLs. |

Navigation:
- **PC (≥900px):** tabs HOME · GALLERY · REELS · EVENTS · ABOUT · CONTACT, with a pink underline on the current tab and an Instagram button.
- **Phone:** a **MENU** button opens a full-screen dark menu (lace edge, subtitles under each tab, social links). Escape and Close both work, and focus stays inside the menu while it is open.

## 4. Pronunciation (every Japanese word)
`js/pronounce.js` builds the same block wherever Japanese appears:
1. Japanese, with furigana over any kanji (`{知|し}らなかった！` renders as <ruby>知<rt>し</rt></ruby>らなかった！)
2. romaji (mono, deep purple)
3. English meaning
4. a **speaker button** that reads the word aloud with the browser's Japanese voice (Web Speech API, `ja-JP`). The button is hidden if the browser can't speak.

| Japanese | Romaji | Meaning | Reel |
|---|---|---|---|
| さすが！ | sa-su-ga! | "Impressive!" | Best cosplay |
| 知らなかった！ | shi-ra-na-kat-ta! | "I didn't know that!" | Behind the scenes |
| すごい！ | su-go-i! | "Amazing!" | Transformation |
| センスいいね！ | sen-su ii ne! | "Great taste!" | Outfit details |
| そうなんだ！ | sō nan da! | "Oh, really? I see!" | Event vlogs |

The section header is さしすせそ with "sa · shi · su · se · so" below it, plus a "Sound on" button. On PC the 5 cards sit in one row. On phone and tablet they form a swipe carousel with dots. Edit the words and reel URLs in `data/reels.json`. A card with no URL shows "Coming soon".

## 5. Event manager and watermark uploader (`/admin/`)
There is no database. Everything runs in your browser, and the live site only changes when you commit the exported file.

| Field | Example | Rules |
|---|---|---|
| When (date) | 2025-12-13 | required, real date |
| Event short form | CF | required, 1-12 characters |
| Event full name | Comic Fiesta | required |
| Venue / city | Kuala Lumpur | optional |
| Activities | Frieren, Stage, Booth | optional, one per row |
| Social media link | Instagram / TikTok / YouTube URL | optional; becomes an embedded video. Other links (e.g. Facebook) show the photo and a link |
| Preview photo path | media/events/2025-12-13-cf/cover-wm.webp | optional; filled in by the uploader |

What the manager can do:
- Add, edit and delete events. Move up/down reorders events on the same date.
- Each event gets an id like `2025-12-13-cf`; repeats become `-2`, `-3`.
- Your work is saved as a **draft in this browser** (localStorage), so it survives a reload.
- **Export events.json** downloads the file. Replace `data/events.json` in the repo with it, then commit and push. The hall, timeline, events page and gallery all update.
- **Import events.json** loads a file and rejects broken ones. **Discard draft** goes back to the published file.

What the **media uploader** does:
- You pick or drop one or many photos.
- Each photo is resized to at most 2000px on its longest side and saved as **WebP** (quality 0.85).
- The **watermark** is drawn automatically: default text `PUZZ KEZZ · @puzzkezz`, bottom-right, 60% opacity, white text with a dark outline sized to the photo. You can change the text, position (5 choices) and opacity, and every preview re-renders.
- Location and camera (EXIF) data are stripped. Nothing is uploaded anywhere.
- Each file shows its repo path: `media/events/<event-id>/<name>-wm.webp`.
- Use **Download** or **Download all**, then **Attach to selected event** to put the path in the event.

### How to publish a new event (step by step)
1. Open `https://<your-site>/admin/` (or `http://127.0.0.1:4173/admin/` locally).
2. Click **New event** and fill in the fields. Paste the reel link.
3. In the uploader, choose your photos, then click **Download all** and **Attach to selected event**. Click **Save event**.
4. Click **Export events.json**.
5. In the repo:
   - replace `data/events.json` with the exported file
   - put the downloaded photos in `media/events/<event-id>/`
   - commit and push
6. GitHub Pages updates in about a minute.

## 6. Files
```
index.html gallery.html reels.html events.html about.html contact.html 404.html
admin/index.html                  event manager + uploader
css/tokens.css                    all design tokens (colours, fonts, spacing)
css/base.css components.css home.css reels.css pages.css admin.css
js/site-config.js                 name, handle, social links, email, watermark text  <- edit me
js/nav.js                         header tabs, phone menu, footer
js/events-data.js                 load / sort newest first / group by year / validate / ids
js/embed.js                       social link -> click-to-load embed
js/pronounce.js                   furigana + romaji + meaning + speaker
js/hall.js                        home hall + YOU ARE HERE timeline
js/reels.js js/events-page.js js/gallery.js
js/admin/manager.js               event manager
js/admin/watermark.js             resize + watermark + WebP
data/events.json                  events (8 SAMPLE events now: replace with yours)
data/reels.json                   さしすせそ words + reel URLs
media/events/<event-id>/          watermarked photos (create when you add them)
tests/                            Playwright tests + fixture
storyboard/                       clickable prototype (draft)
docs/                             ideas, plan, style guide, spec, changelog, screenshots
```

## 7. Run and test locally
```
python3 -m http.server 4173 --bind 127.0.0.1   # then open http://127.0.0.1:4173/
npm install
npx playwright install chromium
npx playwright test                             # 80 checks, PC + phone
```
This machine runs Ubuntu 26.04, which Playwright doesn't support yet. To run the tests here, add the downloaded libraries and the platform override:
`LD_LIBRARY_PATH=$HOME/.local/share/pw-libs/usr/lib/x86_64-linux-gnu PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright test`

## 8. Accessibility and performance
- Keyboard: every control can be reached by keyboard and has a visible focus ring (3px deep purple). Polaroids are buttons. The phone menu is a modal `<dialog>` that keeps focus inside it.
- Motion: with `prefers-reduced-motion`, the hall becomes a still stacked list with no camera movement, swing or flip animation.
- Contrast: every text pair is ≥4.5:1 (checked in the style guide). Pink and light purple are never used as text on light backgrounds.
- Load: Home makes no requests to YouTube, Instagram or TikTok until a video is clicked. Only the first 2 hall photos load straight away; the rest load lazily.

## 9. Not done yet / decisions for Puzz
- **Approvals:** the plan, style guide and storyboard need your OK. Under CLAUDE.md's rules, the reviewer and QA agents can't run until `docs/approval.md` says `STORYBOARD APPROVED`, so the code has not had the formal agent review yet. It was tested with the automated suite.
- **Placeholders:**
  - Your real Instagram URL/handle, other socials and email go in `js/site-config.js`.
  - The reel URLs go in `data/reels.json`.
  - The bio and contact text are still `[placeholder]`.
  - The AMG full name is unknown.
- **Sample events:** the 8 events in `data/events.json` are made up and marked SAMPLE. Replace them with your real history through `/admin/`.
- **Breakpoint:** the phone menu switches at 900px wide (the plan's value). The storyboard used 768px.
- **Admin password:** `/admin/` is public but harmless, because it can't change the live site. It has no password.
- The planner's open questions are in `docs/plan.md` §6.
