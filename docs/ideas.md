# Ideas

## GLOBAL NOTES (apply to ALL ideas)
- Date: 2026-11-17
- Tone: the user is male, mostly cosplays female characters and likes Lolita dress. The design should be LESS feminine: about 3-4 on a scale where 1 = very feminine and 10 = very masculine.
- Colours: baby pink and purple are fine (as accents).
- Pronunciation (user: "highly need", 2026-11-17): every Japanese word on the site must show how to say it. Pattern: line 1 Japanese (furigana over any kanji), line 2 romaji, line 3 English meaning, plus a speaker button that plays the word.
- Tabs (2026-11-17, based on SleepyStella's menu: Home, Gallery, Events, Anniversary, Recap, Contact): HOME · GALLERY · REELS · EVENTS · ABOUT · CONTACT. PC: tabs in the top bar. Phone: a MENU button opens a full-screen list with a subtitle under each tab and social links.
- Current direction: IDEA-3 (convention walk-through) + IDEA-5 (さしすせそ reels). See "Concept 6B" on the design canvas "Puzz Kezz homepage concepts" (https://claude.ai/artifact/G21i2sRrvB3f2cVuDZaiYF).

## IDEA-1: Lolita wardrobe (ornate doors, swaying photo-card hangers)
- Date: 2026-11-16
- Status: new
- Summary: The landing screen is an ornate Lolita-style wardrobe. The doors open and each cosplay hangs inside as a photo card on a hanger; tapping one opens its reel.
- Details:
  - Opening animation leads straight into the reels (the open wardrobe IS the reel menu).
  - Desktop: doors open on click or auto-open after ~1s; hangers sway when the cursor brushes past (velocity-based, springy); hover lifts the card and shows the character name and series; click opens the reel in a lightbox or page.
  - Mobile: doors open on tap or swipe; the rail is horizontally swipeable, with 2 to 3 cards visible at a time; cards sway with drag speed (and optionally gyroscope tilt, opt-in only); a tap opens the reel full-screen.
  - Leading to reels: every card is a reel link; a "Watch latest reel" ribbon sits on the wardrobe; reel view has "next outfit" so the visitor keeps going through the rail.
  - Performance: CSS/SVG or lightweight canvas, WebP card images, lazy-load cards after the doors open; no heavy 3D library needed.
  - Accessibility: the rail is a real list of links, keyboard focus reveals the name and sways the card, a "Skip intro" button, reduced-motion fallback shows doors already open and cards static with a simple hover or focus highlight.
  - Touch vs hover: there is no hover on touch, so names are shown as captions under each card on mobile.
  - Risks: ornate art needs a custom illustrator or asset work; if doors are slow the visitor waits (so cap at ~1.5s and allow skip); sway can feel gimmicky with more than ~12 cards (use paging or multiple rails).
- References: none (concept suggested via another chat)
- Priority (user's view): nice-to-have (candidate). 2026-11-17: user prefers IDEA-3 instead.

### Layout sketches (IDEA-1)
Desktop (open state):
```
+--------------------------------------------------------------+
|  [Logo]                        Reels  About  Contact         |
|        .-------------------------------------------.         |
|        |  ~ ornate arch / lace trim ~              |         |
|        |----------------------+--------------------|         |
|        |  ===== hanger rail =====================  |         |
|        |   /\      /\      /\      /\      /\      |         |
|        |  [card]  [card]  [card]  [card]  [card]   |         |
|        |  name    name    name    name    name     |         |
|        |-------------------------------------------|         |
|        '-- door(L) ---------------------- door(R) -'         |
|              [ Watch latest reel ]    Skip intro             |
+--------------------------------------------------------------+
```
Mobile (portrait):
```
+------------------+
| [Logo]       [=] |
|  .------------.  |
|  | arch/lace  |  |
|  |==== rail ==|  |
|  |   /\   /\  |  |
|  | [card][card]> swipe
|  | name  name |  |
|  '------------'  |
| [ Watch latest ] |
|   Skip intro     |
+------------------+
```

## IDEA-2: 3D gacha machine (capsule pops out a cosplay and a reel)
- Date: 2026-11-16
- Status: new
- Summary: A glossy capsule machine with physics. Turn the handle, a capsule drops, cracks open, and a random cosplay appears with a "Watch reel" button.
- Details:
  - Replayable; each replay is another chance at a reel click.
  - Desktop: drag the handle in a circle (or click-and-hold); capsules tumble in the dome with physics; capsule rolls to the tray, click to crack it open; the reveal card shows the cosplay photo, name, series, and "Watch reel" plus "Spin again".
  - Mobile: large tap-and-hold or swipe-to-turn handle at thumb height; the machine fills the top 60% of the screen; the reveal appears as a bottom sheet with "Watch reel" and "Spin again"; haptic buzz on drop where supported.
  - Leading to reels: the reveal always has a primary "Watch reel" button; a "Collection" counter (e.g. 3/12 found) encourages replays; the shuffle avoids repeats until all are found; a "See all reels" link sits under the machine for people who do not want to play.
  - Performance: a lightweight 2D physics library (e.g. matter.js) with sprite-based glossy capsules is far lighter than full 3D; limit to ~15 capsules in the dome; pause the simulation when the tab is hidden; lazy-load the cosplay images.
  - Accessibility: a plain "Spin" button as a keyboard and screen-reader alternative, with the result announced via aria-live; reduced-motion fallback skips the tumbling and fades the reveal in; sound off by default with a mute toggle.
  - Touch vs hover: drag-to-turn on touch needs a big hit area; hover only adds a glow on the handle on desktop.
  - Risks: real 3D physics is heavy on older phones; the random result may frustrate people who want a specific cosplay (so provide the full list); a gimmick can hide the portfolio from recruiters or commission clients (so keep a clear nav).
- References: none (concept suggested via another chat)
- Priority (user's view): nice-to-have (candidate)

### Layout sketches (IDEA-2)
Desktop:
```
+--------------------------------------------------------------+
|  [Logo]                        Reels  About  Contact         |
|                                                              |
|     Collection 3/12            .-----------.                 |
|     [o][o][o][ ][ ]...         | o  O  o   |  capsules       |
|                                |  o  O  o  |  tumble         |
|     "Turn the handle!"         '-----------'                 |
|                                |   (HANDLE) |                |
|                                |  [ tray ]  |                |
|                                '------------'                |
|            [ Spin ]       See all reels                      |
+--------------------------------------------------------------+
```
Mobile:
```
+------------------+
| [Logo]       [=] |
| Collection 3/12  |
|  .------------.  |
|  | o  O  o  O |  |
|  | O  o  O    |  |
|  '------------'  |
|     ( HANDLE )   |
|     [  tray  ]   |
|  [ Spin ]        |
|  See all reels   |
|------------------|
| reveal sheet:    |
| [photo] Name     |
| [Watch reel]     |
| [Spin again]     |
+------------------+
```

## IDEA-3: Convention walk-through (scroll-driven pastel con hall)
- Date: 2026-11-16
- Status: ready-for-planning
- Summary: Scrolling moves the camera through a dreamy pastel con hall, past floating polaroids from Comic Fiesta, AMG and Omatsuri, ending at the user's name on a stage banner.
- Details:
  - Closest to SleepyStella's site, but in the user's style (pastel, Lolita touches).
  - Desktop: scroll (or arrow keys) drives the camera forward; polaroids drift in with slight parallax, hovering one tilts it and shows the event and character; click flips it to a "Watch reel" link; progress bar styled as a con floor map with stops labelled CF / AMG / Omatsuri; the stage banner at the end has the name and a "See all reels" CTA.
  - Mobile: vertical swipe-scroll drives the camera; polaroids are larger and fewer per screen, tap to flip and then "Watch reel"; a sticky mini map dots at the top; the final banner has a thumb-reachable CTA.
  - Leading to reels: each event section ends with a reel carousel of that event's cosplays; the banner finale has the full reel grid; a persistent "Skip to reels" button.
  - Performance: use layered 2D parallax (CSS transforms, scroll-timeline) instead of true 3D; lazy-load each section's photos as the camera approaches; keep the total payload budget low for mobile data.
  - Accessibility: the content exists as ordinary semantic sections (event headings, image alt text), so a plain linear-scroll fallback works with no camera effect; the reduced-motion fallback turns the walk-through into a normal stacked gallery; scroll-jacking is avoided (native scroll only).
  - Touch vs hover: tilt and hover reveals on desktop become tap-to-flip on mobile.
  - Risks: scroll-driven sites can feel long and slow; the effect resembles SleepyStella's site, so the visual identity must clearly differ; photos need permission/rights from events; a long page can bury the reels (so provide skip).
- User feedback (2026-11-17):
  - This is the user's preferred concept (Concept 6 on the design canvas).
  - The "NOW ON STAGE" stage-banner finale "is a bit weird" -> replace it. Concept 6B draft ends at a hall sign reading さしすせそ, which leads straight into IDEA-5's reel section. The stage-banner parts of the sketches below are superseded.
  - Combine with IDEA-5 and apply the GLOBAL NOTES tone (3-4). Concept 6B draft direction: bold gothic sans + mono labels (no script fonts), ink outlines, square-ish corners, steel truss and hall signs, intro as a con "guest pass" on a lanyard, Lolita kept as a hint (one lace edge).
- References: SleepyStella's site (user mentioned, link not provided); design canvas "Puzz Kezz homepage concepts", Concept 6 and 6B (https://claude.ai/artifact/G21i2sRrvB3f2cVuDZaiYF)
- Priority (user's view): must-have (preferred concept, 2026-11-17)

### Layout sketches (IDEA-3)
Desktop:
```
+--------------------------------------------------------------+
| [Logo]  CF --o-- AMG -----o----- Omatsuri ---- Stage   [Skip]|
|                                                              |
|        [polaroid]            [polaroid]                      |
|            (far, small)         (mid)                        |
|   [polaroid]                                 [polaroid]      |
|     (near, large)    ~ pastel hall, banners ~                |
|                 scroll v  moves camera forward               |
|                                                              |
|  END:   ===== [ YOUR NAME ] stage banner =====               |
|                     [ See all reels ]                        |
+--------------------------------------------------------------+
```
Mobile:
```
+------------------+
| CF o AMG o Oma o |
|                  |
|   [polaroid]     |
|        [polaroid]|
|   [polaroid]     |
|   tap = flip     |
|      scroll v    |
|------------------|
| == YOUR NAME ==  |
| [ See all reels ]|
|            [Skip]|
+------------------+
```

## IDEA-4: Petal storm, deluxe (petals swirl into the name)
- Date: 2026-11-16
- Status: new
- Summary: Petals swirl and gather to form the user's name, now with glow, a blurred background, and the user's photos appearing inside the petal swirl.
- Details:
  - Desktop: petals follow a gentle swirl and the cursor pushes them aside; photos are revealed inside the swirl (each petal acts as a mask or tiny window); after ~3s the petals settle into the name with a soft glow and the background blurs; the reel photos float in a ring around the name, hovering shows the title and click opens the reel.
  - Mobile: fewer petals (about a third), touch drag nudges them; the name forms in the upper half and 4 to 6 photo petals orbit below; tap a photo to open its reel; a "Watch reels" button sits under the name.
  - Leading to reels: the settled hero state shows the photos as the first reel entry points, with a clear "Watch reels" button and a scroll cue to the reel grid.
  - Performance: canvas or WebGL particles, cap petals (about 150 desktop, about 50 mobile), pause when off-screen, avoid animating full-screen backdrop-filter blur (pre-blur or use a static blurred image); glow via a cheap sprite.
  - Accessibility: the name is real text (H1) overlaid or revealed by the canvas, so screen readers read it; the reduced-motion fallback shows a static petal backdrop with the name and photos already in place; no flashing; text contrast checked against the glow.
  - Touch vs hover: the cursor-push effect becomes touch-drag; photo hover caption becomes always-visible captions on mobile.
  - Risks: the most generic of the four (many petal sites exist); photos inside moving petals can be hard to recognise; battery use on phones; the name must remain readable over busy photos.
- References: none (concept suggested via another chat)
- Priority (user's view): nice-to-have (candidate)

### Layout sketches (IDEA-4)
Desktop:
```
+--------------------------------------------------------------+
|  [Logo]                        Reels  About  Contact         |
|    *    ~     *        *  petals       ~                     |
|       [ph]      *   ~      [ph]    *                        |
|   ~        .........................        *                |
|   *       :  Y O U R   N A M E  (glow) :       [ph]          |
|     [ph]   :.........................:    ~                 |
|        *        ~     [ph]       *                           |
|                [ Watch reels ]                               |
|                    scroll v                                  |
+--------------------------------------------------------------+
```
Mobile:
```
+------------------+
| [Logo]       [=] |
|  *   ~    *      |
|   YOUR NAME      |
|   (glow, blur bg)|
|  ~  [ph]   *     |
|  [ph]    [ph]  ~ |
|     *   [ph]     |
| [ Watch reels ]  |
|     scroll v     |
+------------------+
```

## IDEA-5: さしすせそ reel section (from Concept 1)
- Date: 2026-11-17
- Status: ready-for-planning
- Summary: A reel section built on the さしすせそ reactions, wanted on both PC and phone web, combined with IDEA-3 as the end of the walk-through.
- Details:
  - Header "さしすせそ", subtitle "Five reels, five reactions. Tap one to watch on Instagram.", and a "Sound on" button.
  - Header shows romaji under it: "sa · shi · su · se · so".
  - Five reel cards, each with its kana + romaji as a corner label, then Japanese / romaji / English meaning / category, and a speaker button:
    - さすが！ sa-su-ga! "Impressive!" (Best cosplay)
    - 知(し)らなかった！ shi-ra-na-kat-ta! "I didn't know that!" (Behind the scenes)
    - すごい！ su-go-i! "Amazing!" (Transformation)
    - センスいいね！ sen-su ii ne! "Great taste!" (Outfit details)
    - そうなんだ！ sō nan da! "Oh, really? I see!" (Event vlogs)
  - PC: five cards in one row.
  - Phone: horizontal swipe carousel (about 1.5 cards visible) with page dots.
  - Follow the GLOBAL NOTES tone (3-4).
- References: design canvas "Puzz Kezz homepage concepts", Concept 1 (original) and Concept 6B (restyled)
- Priority (user's view): must-have

## IDEA-6: Event timeline in descending years (replaces "CF - AMG - OMA - REELS")
- Date: 2026-11-17
- Status: ready-for-planning
- Summary: The walk-through progress strip becomes a timeline in descending order (newest year first) that labels years only. Between two year markers sit many events (the user attends many cons per year).
- Details:
  - Labels on the strip are years only (e.g. 2026 ... 2025 ... 2024). Events between years are small ticks/dots, not text labels.
  - The walk-through hall itself follows the same order: newest events first, a year marker when the year changes.
  - Events come from data the user enters on the event manager page (IDEA-7), not hard-coded.
- References: user message 2026-11-17
- Priority (user's view): must-have

## IDEA-7: Event manager page + media uploader with auto watermark
- Date: 2026-11-17
- Status: ready-for-planning
- Summary: A page where the user enters each event's info, which then feeds the timeline, the hall and the events page.
- Details:
  - Fields: when (date), event short form (e.g. CF), event full name (e.g. Comic Fiesta), activities (names of what the user did there, e.g. cosplays, stage, booth), social media link (for an embedded video or a preview photo).
  - Media uploader: the user uploads photos and the page automatically adds a watermark.
  - User said: "skip db for now". So data must work without a database (developer's choice of approach).
- References: user message 2026-11-17
- Priority (user's view): must-have

## IDEA-8: Publish to GitHub directly from /admin/
- Date: 2026-11-18
- Status: ready-for-planning
- Summary: Add a "Publish to GitHub" action in /admin/ that commits data/events.json and the watermarked images straight to the repo on main, so GitHub Pages redeploys with no manual git steps.
- Details:
  - User's words: "make admin save directly to github".
  - Today (see docs/plan.md TASK-6, TASK-7 and the hosting/event-manager rows near line 90): /admin/ (admin/index.html, js/admin/manager.js, js/admin/watermark.js) keeps drafts in localStorage, exports events.json as a download, and watermarked photos are downloads; the user then commits by hand.
  - Wanted: commit data/events.json and the watermarked images (media/events/<event-id>/...webp) to repo jiayangwong/MyCosplayWebsite on main via the GitHub REST API.
  - Constraints: the site is static (GitHub Pages, public repo), no server.
  - Suggested approach: a fine-grained personal access token limited to ONLY this repo with Contents: read & write. The owner pastes it into /admin/ once; it is kept only in that browser (localStorage), with a "Forget token" button. The token must never be committed, put in the site code, or sent anywhere but api.github.com.
  - Visitors without the token can open /admin/ but cannot publish anything (the API rejects them).
  - Commit all changed files in ONE commit (Git Data API: blobs -> tree -> commit -> update ref). Show success or failure. If someone else pushed first (ref moved), refuse and ask the user to reload.
  - Keep Export/Import as a backup.
  - Alternative considered: Decap CMS / OAuth. Needs an external OAuth server and is more complex; not preferred.
  - Only watermarked images may ever be committed, never originals.
  - It must also publish the new image pair from IDEA-9 (full-resolution watermarked master + display copy, which is also watermarked since the user decision of 2026-11-18) per photo.
- Decision (user, 2026-11-18): KEEP THE REPO PUBLIC. (Consequence: anyone can see all committed files and history; see the trade-off in IDEA-9.)
- Decision (user, 2026-11-18, answer to plan question 14): DELETE OLD PHOTOS ON PUBLISH. In the same atomic commit, remove image files under media/events/ that no event's photo or photoFull references after the change. Safety rules: only delete paths under media/events/ ending in .webp; never delete a file still referenced by any event; show a confirmation listing the files first ("These N old files will be removed") so the user can cancel; deletions go in the same tree as the new files (sha: null entries), so it is one commit or nothing. Git history still keeps the old versions. No open questions remain.
- References: none (user message 2026-11-18)
- Priority (user's view): must-have

## IDEA-9: Full-resolution media + display copy, new watermark style
- Date: 2026-11-18
- Status: ready-for-planning
- Summary: Change the uploader so it keeps the original pixel resolution and produces two files per photo: a full-resolution watermarked master and a smaller unwatermarked display copy. Watermark becomes a diagonal tiled white text pattern.
- Details:
  - Changes the current TASK-7 (js/admin/watermark.js resizes to max 2000px, WebP q0.85, one file per photo).
  - No downscale of the original: the uploader keeps the ORIGINAL pixel resolution for the master.
  - File a) Full-resolution master WITH watermark, high quality (~0.95). Opened when a visitor taps/clicks a photo (lightbox/viewer).
  - File b) Display copy for page layouts, smaller (planner chooses the size, e.g. longest side ~1600-2000px), with NO watermark (the user's explicit choice).
  - Watermark style: diagonal, tiled repeating lines of WHITE text across the whole image, transparency 40%, text = the Instagram name (@notpuzzkezz, per the repo; confirm the exact text with the user).
  - To confirm with the user (planner): does "transparency 40%" mean opacity 40% or opacity 60%? Keep it adjustable in the uploader, with this as the default.
  - Notes: canvas re-encoding strips EXIF/GPS (good). iOS Safari has a ~16.7MP canvas limit, so full-res processing should be done on desktop, or the uploader should warn and fail gracefully.
  - Repo size: full-res files are ~3-8 MB each, so ~150-300 photos fit in GitHub's 1 GB Pages limit. A future move to external storage (e.g. Cloudflare R2) may be needed.
  - Unwatermarked originals are never committed.
  - Known trade-off (the user has been told): the display copy has no watermark and the repo is public, so anyone can download the unwatermarked display-size photos.
  - Related: IDEA-8 must publish both files of each pair.
- Decisions (user, 2026-11-18, after planning started):
  - Watermark text is exactly "@notpuzzkezz".
  - "40%" means OPACITY 40% (the text is 40% visible). Default 40%, still adjustable.
  - CHANGE: the display copy is NOW WATERMARKED TOO. Both the full-resolution master and the display copy get the same diagonal tiled white @notpuzzkezz watermark at 40% opacity, with tile size and spacing scaled to each image's dimensions so it looks the same on both. This replaces "File b) ... with NO watermark" and the "Known trade-off" note above.
  - Display copy size: longest side 1200px (user answer to plan question 13, 2026-11-18; replaces the proposed 1600px).
  - No open questions remain.
- Design change (user, 2026-11-18, later): NEW WATERMARK STYLE. Replaces "diagonal, tiled repeating lines of WHITE text" above.
  - A white dashed diagonal lattice in both directions (+45 and -45 degrees), with a small upright heart at every crossing.
  - "@notpuzzkezz" is written along the up-right lines, centred between crossings, with the line broken around the text.
  - The whole layer is at 40% opacity (still the default, still adjustable).
  - Sizes: f = 2.5% of the shorter side (min 12px); cell (crossing to crossing) = 14f; line width = max(1, 0.1f); dashes 0.5f on / 0.35f off; gap around the text 0.5f at each end; heart scale 0.3f.
  - `watermarkLayout(w,h)` returns {f, cell, lineWidth, dash, gap, heart}. Same spec in docs/style-guide.md; reference drawing: storyboard/wm.js. Plan TASK-7 updated.
- Tweak (user, 2026-11-18, later still): keep the lattice, the hearts and the up-right text direction, but make the diamonds repeat about 3 times as densely. Only the size rule changes: f = round(shorter side / 120), min 8px (replaces "2.5% of the shorter side (min 12px)" above). Everything else stays relative to f (cell 14f, line max(1, 0.1f), dashes 0.5f / 0.35f, gap 0.5f, heart 0.3f). Examples: 1200x800 -> f 8 (floor), cell 112; 2400x1600 -> f 13, cell 182; 6000x4000 -> f 33, cell 462. The user has been told that on the 1200px display copy the name is only about 8px tall (a texture); it is clearly readable on the full-size master. Plan TASK-7 and the style guide updated.
- Final density (user, 2026-11-18, plan question 15): **2x**. f = round(shorter side / 80), min 8px (replaces the /120 tweak above). Everything else stays relative to f. Examples: 1200x800 -> f 10, cell 140; 2400x1600 -> f 20, cell 280; 6000x4000 -> f 50, cell 700; small images floor at f 8. On a 1200x800 display copy the name is about 10px tall. Plan TASK-7 and the style guide updated.
- References: user message 2026-11-18; IDEA-7, IDEA-8
- Priority (user's view): must-have

## IDEA-10: Every photo of Puzz is watermarked, everywhere
- Date: 2026-11-18
- Status: ready-for-planning
- Summary: Every photo image of the user that is committed to the public repo or shown on the site must already carry the lattice watermark, so nobody can steal an unwatermarked photo from the website or from the repo source folder.
- Details:
  - User (paraphrased): "The portrait also needs a watermark. I need to stop anyone from stealing my photos. Whether they download from the website or take the files from my source folder (the repo), every photo already has the watermark on it."
  - Scope: EVERY photo image file of the user committed to the public repo or shown on the site carries the lattice watermark (see the IDEA-9 design change):
    - event photos, both the display copy and the full-size master (already planned)
    - the portrait on Home (guest pass) and About (today a placeholder in about.html and index.html)
    - the reel cover thumbnails (data/reels.json `thumb`, empty today)
    - the social share picture og-image.png, if it ever shows a photo of him
  - The admin uploader must be able to produce these too: a "Site photos" target (Portrait, Reel cover 1-5, Share image) as well as "Attach to event". These use the same two-file or single-file watermark pipeline, and Publish commits them.
  - Enforcement ideas for the planner:
    - Publish only accepts image files the uploader generated. The uploader embeds a marker, e.g. a custom WebP RIFF chunk or a name pattern.
    - A repo test fails if any .jpg/.png/.webp under media/ or referenced by data/*.json or the HTML lacks the marker. Decorative non-photo images (favicon.svg) are excluded.
    - Never commit an unwatermarked original.
  - Honest limit (the user should know): a watermark deters theft and proves ownership. It cannot stop screenshots or someone editing the watermark out.
  - DECIDED (user, 2026-11-18, plan question 15): watermark density **2x**. f = round(shorter side / 80), min 8px, for every photo (events, portrait, reel covers, share image). Examples: 1200x800 -> f 10, cell 140; 6000x4000 -> f 50, cell 700. Compared on the 6B canvas board "Watermark density: 2x vs 3x + portrait".
  - Other decisions (user, 2026-11-18, plan questions 16-18): keep the current site screenshot og-image.png until a share photo is uploaded; one 1200px file each for the portrait and reel covers (no full-size copy); a GitHub Action that checks the watermark on every push is a later idea (out of scope for now).
  - Plan approved by the user on 2026-11-18 (TASK-14, TASK-15).
- References: IDEA-7, IDEA-8, IDEA-9; canvas board "Watermark density: 2x vs 3x + portrait"
- Priority (user's view): must-have

## IDEA-11: "Remove from publish" can break an event's photo and delete its old photo (data loss)
- Date: 2026-11-19
- Status: ready-for-planning
- Summary: In /admin/, removing a pending photo pair from the publish while the draft event still points at those photo paths makes Publish commit a broken image link and also delete the event's previous photo. It must be decided before release.
- Details:
  - Found by the reviewer during TASK-13.
  - Each pending photo pair in /admin/ has a "Remove from publish" button.
  - If the user removes a pair but the draft event still points at those paths (photo / photoFull):
    - Publish commits events.json with paths to files that are not in the repo, so the event goes live with a broken image.
    - Worse (data-loss angle): the event's previous photo is now unused, so Publish's remove step (IDEA-8, delete old photos on publish) deletes it. Git history still has it, but the live site loses it.
  - Options for the planner and the user to decide:
    - (a) "Remove from publish" also clears the event's photo fields, or puts back the previous paths from the published events.json.
    - (b) Publish refuses, with a clear message, when any event points at a media/events/ path that is neither in the repo tree nor in this publish.
    - (c) Both (a) and (b).
  - Related: IDEA-8 (publish and delete old photos), IDEA-9 (photo pairs).
- References: TASK-13 review (reviewer finding, 2026-11-19)
- Priority (user's view): high (must be decided before release)

## Comparison and recommendation (for the user to decide)
- UPDATE 2026-11-17: the user chose IDEA-3 + IDEA-5 (see GLOBAL NOTES). The earlier recommendation below (2026-11-16) is superseded.

| Idea | Reel-click strength | Effort | Performance risk | Best for |
|---|---|---|---|---|
| 1 Wardrobe | Very high (the menu is the reels) | Medium (art-heavy) | Low | Strongest personal brand (Lolita style) |
| 2 Gacha | High, replayable | Medium-High | Medium | Fun, shareable, returning visitors |
| 3 Walk-through | Medium (long path) | High | Medium | Storytelling, event credibility |
| 4 Petal storm | Low-Medium | Medium | Medium | Atmosphere, best as a hero |

- Recommendation: IDEA-1 (wardrobe) as the main concept, since it maps most directly onto reels and fits the Lolita style. Borrow the petals from IDEA-4 as light ambient decoration (cheap), and consider IDEA-2 as a fun secondary feature ("Surprise me" gacha button on the reels page). IDEA-3 is the most distinctive but also the heaviest and most like SleepyStella's site, so park it unless the user wants a storytelling site.
