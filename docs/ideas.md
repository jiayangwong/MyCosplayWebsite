# Ideas

## GLOBAL NOTES (apply to ALL ideas)
- Date: 2026-11-17
- Tone: the user is male, mostly cosplays female characters and likes Lolita dress. The design should be LESS feminine: about 3-4 on a scale where 1 = very feminine and 10 = very masculine.
- Colours: baby pink and purple are fine (as accents).
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
- Status: new
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
- Status: new
- Summary: A reel section built on the さしすせそ reactions, wanted on both PC and phone web, combined with IDEA-3 as the end of the walk-through.
- Details:
  - Header "さしすせそ", subtitle "Five reels, five reactions. Tap one to watch on Instagram.", and a "Sound on" button.
  - Five reel cards, each with its kana as a big corner label:
    - さすが！ (Best cosplay)
    - 知らなかった！ (Behind the scenes)
    - すごい！ (Transformation)
    - センスいいね！ (Outfit details)
    - そうなんだ！ (Event vlogs)
  - PC: five cards in one row.
  - Phone: horizontal swipe carousel (about 1.5 cards visible) with page dots.
  - Follow the GLOBAL NOTES tone (3-4).
- References: design canvas "Puzz Kezz homepage concepts", Concept 1 (original) and Concept 6B (restyled)
- Priority (user's view): must-have

## Comparison and recommendation (for the user to decide)
- UPDATE 2026-11-17: the user chose IDEA-3 + IDEA-5 (see GLOBAL NOTES). The earlier recommendation below (2026-11-16) is superseded.

| Idea | Reel-click strength | Effort | Performance risk | Best for |
|---|---|---|---|---|
| 1 Wardrobe | Very high (the menu is the reels) | Medium (art-heavy) | Low | Strongest personal brand (Lolita style) |
| 2 Gacha | High, replayable | Medium-High | Medium | Fun, shareable, returning visitors |
| 3 Walk-through | Medium (long path) | High | Medium | Storytelling, event credibility |
| 4 Petal storm | Low-Medium | Medium | Medium | Atmosphere, best as a hero |

- Recommendation: IDEA-1 (wardrobe) as the main concept, since it maps most directly onto reels and fits the Lolita style. Borrow the petals from IDEA-4 as light ambient decoration (cheap), and consider IDEA-2 as a fun secondary feature ("Surprise me" gacha button on the reels page). IDEA-3 is the most distinctive but also the heaviest and most like SleepyStella's site, so park it unless the user wants a storytelling site.
