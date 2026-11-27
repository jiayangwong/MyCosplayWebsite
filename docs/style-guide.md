# Style guide - Puzz Kezz website ("Concept 6B")

STYLE APPROVED: 2026-11-18 (by the user, including the v2 additions for IDEA-8 / IDEA-9).
STYLE APPROVED: 2026-11-27 (by the user: analytics tabs and charts for IDEA-17, admin layout polish for IDEA-18, 900px breakpoint).

## Mood
A convention-hall zine: cool grey-lilac paper, hard ink outlines, mono labels, steel trusses and hall signs. Tone 3-4 of 10 (less feminine). Baby pink and purple are accents only. Lolita appears as a hint (one lace edge on the guest pass and the phone menu). No script or italic display fonts, petals, gradient washes or emoji.

## Colours (contrast checked, WCAG ratios)
| Token | Hex | Use | Contrast |
|---|---|---|---|
| --color-bg | #F3F1F6 | page background | ink 15.3 |
| --color-surface | #FFFFFF | cards, polaroids, inputs, secondary buttons | ink 17.1 |
| --color-ink | #1D1A24 | text, 2px outlines, primary buttons, dark cards | - |
| --color-text-2 | #3B3546 | secondary body text | 10.5 on bg |
| --color-muted | #6A6378 | captions, helper text (ONLY on bg or white; 4.35 on hall floor, so never there) | 5.1 bg / 5.7 white |
| --color-line | #CFC8DA | track lines, dividers, disabled borders (not text) | - |
| --color-floor / --color-grid | #E4DEEC / #D2C8DF | hall floor and its grid lines (ink text 13.0) | - |
| --color-pink | #F4A7C0 | accent: active tab underline, accent button, pass header, "HALL A" label on ink | ink on pink 9.1; pink on ink 9.1 |
| --color-purple | #B9A3E3 | accent: lace edge, ticks, labels on ink | ink on it 7.7; on ink 7.7 |
| --color-purple-deep | #5B4A8B | romaji, links, focus ring on light | 6.7 bg / 7.5 white / 5.5 on #E3D8F6 / 5.5 on #F7D3DF |
| --color-dark-card | #2B2734 | flipped card, full-screen menu, footer | white 14, pink 7.7, purple 6.5 |
| --color-error | #B3264F | errors (with icon and text, never colour alone) | 5.7 bg / 6.4 white |
| --ph-pink / lilac / sky / grey | #F7D3DF / #E3D8F6 / #D6ECF7 / #DCD6E4 | photo placeholders | ink text >= 12 |

Rule: pink and light purple are never used as text on light backgrounds (they fail). Use ink or deep purple there.

## Typography
- Headings: **Zen Kaku Gothic New** 900 (also covers Japanese). Latin headings UPPERCASE, letter-spacing 1-2px. Body: Zen Kaku Gothic New 500, bold 700.
- Labels, metadata, romaji, years, captions: **Space Mono** 400/700.
- Sizes (phone / desktop): h1 32 / 56px, h2 24 / 36px, h3 18 / 24px, body 16 / 17px, small (mono) 12 / 13px. Phone menu tab names 30px/900.
- Line height: headings 1.15, body 1.6, Japanese 1.7. Romaji mono 14px, never below 12px.
- Load with `font-display: swap`, subset to used weights only.

## Spacing and layout
- Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px.
- Content max width 1280px, centred. Side gutter 16px phone, 32px tablet, 48px desktop.
- Breakpoints: phone 375-430 (base styles), tablet >= 768, desktop >= 1200.
- Radius: 4px small, 6px buttons, 10px cards. Outline 2px ink. Touch targets >= 44px on phone.

## Components (all states keyboard accessible; focus = 3px deep-purple outline, 2px offset)
- **Header (PC)**: bg surface, 2px ink bottom border. Tabs HOME · GALLERY · REELS · EVENTS · ABOUT · CONTACT in 700 uppercase 14px. Hover: pink 4px underline at 40%; active page: full 4px pink underline. Right: Instagram outline button (white, 2px ink).
- **Header (phone)**: logo left, "MENU" button with hamburger icon right (44px high). Opens a full-screen dark-card menu: lace scallop edge in purple at top, tab names 30px/900 white, mono subtitle under each (muted light #C9C2D6, 8.4 contrast), arrow icon right, socials at bottom, close button top right. Focus trapped while open, Esc closes.
- **Buttons** (6px radius, 2px ink border, 44px high, mono-free bold 700 uppercase): primary = ink bg, #F3F1F6 text; secondary = white bg, ink border and text; accent = pink bg, ink text. Hover: shift up 2px with a 3px hard ink shadow. Active: back to 0, no shadow. Disabled: line colour border, muted text. Focus: ring above.
- **Steel truss band**: 24px strip, diagonal ink stripes on surface (repeating-linear-gradient is allowed here as a pattern, not a wash), ink top and bottom borders. Decorative, aria-hidden.
- **Hall sign**: hangs from two thin ink lines; ink plate, mono "HALL A" in pink (or purple), bold event name in white, 4px coloured bottom border.
- **Polaroid**: white, 2px ink border, 10px radius, washi-tape strip (pink or lilac, 60% wide, -3deg), mono caption. Hover/focus: rotate +-2deg and lift 4px. Click flips to a dark card (#2B2734) with the "Watch reel" accent button.
- **Guest pass card**: white, 2px ink border, hard shadow 6px 6px 0 ink; lace scallop edge in purple at the top; pink header strip "GUEST PASS · No. 001" (mono, ink); photo, name (h3), mono subtitle, CTA, decorative barcode. Hover: slight swing (+-1.5deg, 600ms ease-out).
- **Year timeline**: horizontal strip "YOU ARE HERE" (mono label). Years descending only (2026 · 2025 · 2024), small ticks for events between years, line in --color-line, the current position a filled ink dot with pink ring, other years hollow. Each year is a link (>= 44px target).
- **さしすせそ reel card**: white card, 2px ink; corner badge with kana + romaji (ink bg, pink text); Japanese line, romaji mono deep purple, English meaning, mono category; speaker button 36px desktop / 44px phone (ink circle, white icon; playing state = pink bg).
- **Pronunciation block (REQUIRED for every Japanese word on the site)**: line 1 Japanese with `<ruby>` furigana over kanji; line 2 romaji (Space Mono, deep purple); line 3 English meaning (secondary text); speaker `<button aria-label="Play pronunciation of [romaji]">` using audio file or speechSynthesis `ja-JP`. Set `lang="ja"` on the Japanese. Never show Japanese without the other three parts.
- **Event card**: white, 2px ink, 10px radius; 4:3 photo, mono date and place, h3 name, tag chips (mono, 1px ink border), "Details" secondary button. Hover: lift 2px + shadow 4px 4px 0 ink.
- **Admin forms**: labels above fields (mono 12px uppercase); inputs white, 2px ink border, 6px radius, 44px high; focus = deep-purple ring; error = --color-error border + message with icon below. File drop zone: 2px dashed ink on floor colour, hover/drag = pink border and white fill. Watermark preview: image on white card with mono "PREVIEW" tag and the watermark position shown.
- **Footer**: dark-card bg, white text, truss band above, mono small text, socials as outline icons, copyright.

## Motion
Short and subtle: 150-250ms for hover, 600ms for swing and flip. `@media (prefers-reduced-motion: reduce)`: no tilt, swing, flip animation or smooth scroll; flip becomes an instant swap, hover uses only a colour/outline change.

## Imagery rules
- Gallery: 4:5 portrait cards (masonry not required); event photos 4:3; polaroid photo 1:1 inside the frame; reel thumbnails 9:16.
- 6-10px radius only, always with a 2px ink border. No drop blur; hard shadows only.
- Captions in mono 12px under or inside the polaroid frame. Alt text: plain description, character + series + what is happening ("Sailor-style Lolita cosplay at Comic Fiesta, holding a fan"). Decorative items alt="".
- Placeholders use the --ph-* colours. Watermark is added by the uploader, not by CSS.

## Do / Don't
- Do use ink outlines, mono labels, pink/purple as small accents, plenty of space around posters.
- Do show a pronunciation block for every Japanese word.
- Don't use script/italic display fonts, petals, gradient washes, emoji, or pink text on white.
- Don't exceed two fonts or round corners above 10px (except circular icon buttons).
- Don't remove focus outlines or rely on colour alone.

## v2 additions (IDEA-8, IDEA-9): approved 2026-11-18
Adds rules only for the new UI. Nothing above changes. No new colours: every state uses existing tokens. Status is never colour alone (icon + text). Admin stays plain and functional; the public photo viewer is the only new visitor-facing UI.

### Lattice watermark (canvas, TASK-7)
Changed at the user's request on 2026-11-18 (reference image: white dashed diagonal lattice, small hearts at the crossings, name along the lines). Replaces the old -30deg tiled rows. The guide stays approved. Reference implementation: `storyboard/wm.js`.
- Unit `f` = round(shorter side / 80), minimum 8px (**2x density**, user decision 2026-11-18; was 2.5% / min 12px, then briefly /120 for 3x). The divisor is the one constant `WM_DIVISOR` = 80. Examples: 1200 x 800 -> f 10, cell 140; 2400 x 1600 -> f 20, cell 280; 6000 x 4000 -> f 50, cell 700; small images (for example 400 x 300) floor at f 8. On a 1200 x 800 display copy the name is about 10px tall; on the full-size master it is clearly readable. Font: **Space Mono 700**, canvas string `700 ${f}px "Space Mono", ui-monospace, monospace`. Before drawing, `await document.fonts.load('700 20px "Space Mono"')`, otherwise canvas silently uses the fallback.
- Lattice: white dashed lines in BOTH diagonal directions (+45 and -45 degrees). Line width = max(1px, 0.1f). Dashes 0.5f on, 0.35f off. One cell (crossing to crossing along a line) = 14f.
- Hearts: a small solid white heart at every crossing, upright, about 1f wide (heart scale s = 0.3f).
- Name: `@notpuzzkezz` is written ALONG the up-right lines, rotated -45deg so it reads bottom-left to top-right. It is centred between two crossings, and the line is broken around the text with a 0.5f gap at each end.
- Opacity: the whole layer is drawn at 40% (default, adjustable). The optional soft ink shadow still applies: `--color-ink` at 35%, offset 0.05f, blur 0.08f, no stroke; keep it off if the 40% white pixel test fails.
- Same rule for the master and the display copy, so the proportions are the same at both sizes (`cell` = 14f on both; rounding and the 8px floor make the cell count close to, not exactly, equal). Production `watermarkLayout(w,h)` returns `{ f, cell, lineWidth, dash, gap, heart }` (as in plan TASK-7).
- The preview in the uploader shows the real output (not a CSS overlay).

### Gallery photo viewer (TASK-10, public)
- Overlay: `--color-scrim` (ink 72%) full screen; photo centred, `object-fit: contain`, max 96vw x 88vh, `--radius-sm`, no border or shadow. Caption below in mono 12px `--color-on-dark`, with the event name and "Full size" / "Preview" tag.
- Loading: shows the 1200px display copy at once. The master loads in the background. While loading, a 3px indeterminate bar (pink on `--color-line` at 30%) sits at the top edge of the photo and a mono label "LOADING FULL SIZE" bottom-left in `--color-on-dark-muted`. When the master is decoded, swap with a 180ms cross-fade (instant under reduced motion), bar and label disappear, no layout jump (keep the display copy's box size until swap). If the master fails: keep the display copy, show mono "Full size unavailable" with an alert icon in pink; no error pop-up.
- Close button: top right, 44x44px, ink circle, white X icon, 2px white ring for contrast on the scrim, `aria-label="Close photo"`. Hover: ring turns pink. Focus: the usual 3px ring but in white (deep purple fails on the dark scrim), 2px offset.
- Keyboard and focus: `role="dialog" aria-modal="true"` with the caption as its label. Opening moves focus to the Close button; Tab stays inside (Close, Previous, Next); Esc closes; Left/Right arrows go to the previous/next photo; closing returns focus to the tile that opened it. Page behind gets `inert` and no scroll. Previous/Next are 44px ink circles with white arrows, hidden on the first/last photo.
- Phone (375px): photo fills the width edge to edge, Close fixed top right with 16px margin, caption under the photo, Previous/Next as a bottom bar of two 44px buttons (not on top of the photo), swipe left/right is a bonus. Pinch zoom stays enabled.

### Admin: GitHub panel (TASK-11)
Reuses `.panel`, `.field`, buttons. Order inside the panel: title "GitHub", help text (muted: "The token stays in this browser only."), then:
- **Token field**: label "TOKEN" (mono 12px uppercase), `type="password"`, `autocomplete="off"`, white input, 2px ink border, 44px high. Helper line (muted): "Fine-grained token, Contents: read and write, this repository only."
- **Buttons row**: Save (primary), Test connection (secondary), Forget token (secondary with error-colour border and text, like `.icon-btn.is-danger`). Disabled when nothing to do: `--color-line` border, muted text. Forget asks no dialog, but shows the not-connected message after.
- **Status message** below the buttons, one line in a box with a 2px left bar, `role="status"` (errors `role="alert"`), icon + text:
  - Success: check icon, text ink, left bar `--color-purple-deep`, e.g. "Connected to owner/repo (site-v1)."
  - Error: "!" icon, text `--color-error` bold, left bar `--color-error`, e.g. "GitHub said no (401). Check the token and try again."
  - Not connected: dash icon, muted text, left bar `--color-line`, "No token saved. Paste one above."
  - Testing: mono "Testing..." with the pink indeterminate bar.
- The token value is never printed back, only "Token saved (ends in ...x7Kq)" in mono.

### Admin: Publish area (TASK-12 and TASK-13)
- Layout: one panel, title "Publish", list of pending changes (mono 13px rows: `+` added, `~` changed, `-` removed, paths overflow-wrap anywhere), then the Publish button.
- **Publish button**: accent (pink bg, ink text), label "Publish to GitHub", 44px. Disabled with no pending changes or no token (line border, muted text, helper line says why).
- **Progress bar**: 12px high, 2px ink border, `--radius-sm`, white track, pink fill, step text in mono above ("Uploading 3 of 5 files"). `role="progressbar"` with aria-valuenow. During publishing, Publish is disabled and shows "Publishing..." (also announced).
- **Success**: purple-deep left bar, check icon, "Published. View commit" with the commit link in deep purple, underlined.
- **Confirmation dialog** (native `<dialog>`, `aria-modal`): white surface, 2px ink border, `--radius-card`, `--shadow-pass`, max width 520px, backdrop `--color-scrim`. Heading (h3): "These N old files will be removed". Under it the file list: scroll box max 40vh, mono 13px, one path per row with a minus icon, `--color-bg` background, 1px `--color-line` borders between rows. Buttons right-aligned: **Remove and publish** (primary, ink) and **Cancel** (secondary). Initial focus on Cancel (the safe choice). Esc = Cancel. Phone: dialog is 16px from the edges, buttons stack full width with Cancel last.
- **Error messages**: box with error left bar, "!" icon, `--color-error` bold first line saying what happened in plain words, one muted line saying what to do next, then the **Try again** button (secondary, 44px, placed under the message; it repeats the whole publish from the beginning). Nothing is half-published, say so: "Nothing was changed on GitHub."
- **Stale-ref message** (the branch moved while publishing): same box, first line "The site changed on GitHub while you were publishing." second line "Nothing was changed. Try again to use the newest version." plus Try again. Not styled as a crash.

### Uploader two-file preview (TASK-7)
- Each photo is a row on a white card (2px ink, `--radius-card`): two thumbnails side by side (phone: stacked), both showing the watermark. Each thumbnail has a mono 12px label under it: **MASTER** and **DISPLAY**, then pixel size and file size ("2400 x 1600 - 1.8 MB", "1200 x 800 - 180 KB"). Label chips: MASTER = ink bg, white text; DISPLAY = pink bg, ink text. Thumbnails keep the photo's real ratio, max 220px high.
- Under the pair: file name (bold, overflow-wrap anywhere) and the target paths in mono muted.
- **Per-photo error states**: the card gets an error-colour 2px border and a "!" message line in `--color-error` bold under the thumbnails ("Could not read this file. Is it a JPG, PNG or WebP?", "Too big to process in this browser", "Display copy still above 400 KB"). The failed photo does not block the others. Each failed card has a "Remove" secondary button. A processing card shows the pink indeterminate bar and "Processing...". Success shows a small check icon and "Ready".

## Analytics tabs and charts (IDEA-17)
**APPROVED 2026-11-27** (written 2026-11-27 by the designer; approved by the user on 2026-11-27 ("Approve")). Rules only, no code. Scope: the Analytics panel in /admin/ (TASK-32 to TASK-35). Admin stays plain: ink outlines, mono labels, no gradients, no emoji, hard shadows only, no animation in charts. "Phone" = under 900px, "PC" = 900px and up (the admin grid already changes at 1000px; this panel changes earlier because its charts need the width). All touch targets >= 44px at every width.
User answered 2026-11-27: Approved all, use 900px. 900px is the one switch for the admin gap, the Analytics controls row and the Overview tile column (the two-column grid stays at 1000px). Also accepted from the storyboard review: Analytics is the LAST block of the admin page; other filled black buttons (Save, Download all, dialog confirms) stay black; tab / range button sizes follow the storyboard (tighter padding from 900 to 1280px); the "Updated" line drops "(sample)" in production. This section is updated to match but stays APPROVED 2026-11-27 until the user explicitly approves the style guide.

### Admin layout order (APPROVED 2026-11-27, 2026-11-27; user said "Keep these 1-6 suggestions")
Changes 1-6 below are marked "[2026-11-27 APPROVED 2026-11-27]". They replace older wording in sections A, B, C, E and in "Admin: Publish area" where they conflict.
- **Phone (under 900px), top to bottom**: header, "Event manager" title, help box, source line, action row (ONE pink primary + Backup menu button), GitHub, Events, Event form, Publish, Moments, Media uploader, **Analytics (collapsed, the last block)**. Single column, same 24px gap everywhere.
- **PC (1000px and up for the grid; Analytics controls, tile column and 32px gap from 900px)**: header, title, help box, source line, action row, then the two-column grid (LEFT: GitHub, Events; RIGHT: Publish, Event form), then Moments and the Media uploader, then **Analytics full width as the LAST block of the page (collapsed)** [user accepted 2026-11-27 after the storyboard review]. Grid items align to the top.
- The two-column grid keeps its existing 1000px breakpoint (not changed). Between 900 and 999px the grid is one column, the gap is already 32px, the Analytics panel already uses its PC arrangement, and Analytics is still last.

### A. Panel (`#an-panel`, fold, the LAST block of the admin page after Moments and the Media uploader, collapsed on load) [2026-11-27 APPROVED 2026-11-27: was "above the GitHub / Events grid", then "below the grid"]
- Same `.panel.fold` + `.fold-head` as the other panels. Title "Analytics". Chip (`.fold-chip`, mono caps) text: "Not set up" (neutral) / "No passcode" (neutral) / "Last 30 days" (`data-s="ok"`, follows the range switch) / "Error" (`data-s="err"`). Chip words always say the state, colour is a bonus. Nothing is fetched while collapsed.
- Padding: 24px PC, 16px phone (charts need the width: 311px inside at 375). Gap between blocks 16px phone, 24px PC. **Order inside the body, top to bottom [2026-11-27 APPROVED 2026-11-27]**: (1) controls row (tabs + range switch + Refresh + Updated line, see below); (2) tab panel (range line, then content); (3) ONE collapsed "Settings" disclosure; (4) ONE collapsed "About these numbers" disclosure. The passcode block, Test / Forget and the opt-out checkbox live only inside Settings; the footer notes live only inside About.
- **Controls row [2026-11-27 APPROVED 2026-11-27, replaces the old tools row]**. PC (900px and up): ONE row, aligned to the same baseline (`align-items: end`), with the five tabs on the LEFT and, on the RIGHT, the range switch (7 / 30 / 90), the Refresh button (secondary, 44px) and mono 12px muted "Updated 14:05 Malaysia time" (generatedAt as GMT+8 clock time, never converted with the browser time zone; the storyboard's "(sample)" suffix is never shown in production). Tab and range button sizes follow the approved storyboard: tighter horizontal padding from 900 to 1280px so the row fits at 900px, height still at least 44px. The tab list keeps its 2px ink bottom line and the right group sits on that same line; the range legend text is visually hidden on PC but stays in the DOM for screen readers (the switch keeps its `fieldset` + `legend`). This saves about 100px of height. Phone: row 1 = range switch (3 equal parts, takes the free width) + Refresh as a 44 x 44px square icon button (circular-arrow icon, 2px ink border, secondary, `aria-label="Refresh"`, no visible text) on its right, 8px gap; row 2 = mono "Updated 14:05 Malaysia time" (wraps allowed); row 3 = the tab bar (still one sideways-scrolling row). The visible legend "Last 7 / 30 / 90 days (Malaysia time)" stays above the switch on phone. Refresh is disabled while loading (icon at 50%, `aria-disabled`/`disabled`, border `--color-line`).
- **Range switch**: `fieldset` + 3 radios (7 / 30 / 90), legend mono 12px caps "Last 7 / 30 / 90 days (Malaysia time)" (wraps on phone). Each option: label box min 44 x 44px (phone: equal thirds), 2px ink border, boxes joined (overlap 2px), outer radius 6px; unselected = white, ink text, hover `--ph-lilac`; selected = ink bg, `--color-on-dark` text, 4px pink bar inset at the bottom (same cue as the active tab). Radio input visually hidden but focusable; focus = deep-purple ring on the label (`:has(:focus-visible)`), offset 2px. Arrow keys move and select as native radios do. Disabled 90 (range-unavailable): `--color-line` border, muted text, `aria-disabled`, linked note (state in section D).
- **Settings disclosure [2026-11-27 APPROVED 2026-11-27]**: native `<details class="an-settings">` at the bottom of the panel body, collapsed by default. `<summary>`: 44px high, mono 13px bold caps "Settings", the same fold chevron as the panels (rotates only when motion is allowed), 3px deep-purple focus ring, 2px offset. Inside (padding 12px 0 0, gap 16px): the passcode block, its Test / Forget buttons, and the "Don't count my visits on this browser" checkbox. **Auto-open**: in the "Not set up" and "No passcode" states Settings is opened by the script on load of the panel (the user cannot see numbers without a passcode), and the passcode input is NOT focused automatically (focus stays where the user is; opening is announced by the existing status message). After a successful Save the passcode input is cleared and Settings stays open until the user closes it; it never re-opens by itself while numbers are shown. Settings is also forced open when the 401 state shows "Forget passcode" (the button lives in it). In "Not set up" (empty workerUrl) there is no passcode block, so Settings holds only the opt-out checkbox and is not auto-opened.
- **About these numbers disclosure [2026-11-27 APPROVED 2026-11-27]**: native `<details class="an-about">`, collapsed by default, after Settings. `<summary>` 44px, mono 13px bold caps "About these numbers" with the 16px `i` info icon (circle) BEFORE the text and the fold chevron on the right. Inside, the three footer sentences (see Footer notes) as separate lines. The word "UTC" never appears.
- **Passcode block** (now inside Settings; `.field`, same rules as the GitHub token): label "PASSCODE", `type="password"`, `autocomplete="off"`, helper (muted): "Stays in this browser only. Paste the long passcode you made for the Worker." Buttons row: Save (primary), Test (secondary), Forget passcode (secondary with error border and text, like `.icon-btn.is-danger`). After Save: input cleared, block shrinks to ONE row inside Settings: mono "Passcode saved (ends in ...x7Kq)" + Test + Forget passcode. Never printed back. **Forget asks first, inline (no dialog), rules unchanged:** the button becomes a message "Forget the passcode on this browser?" with two buttons, "Yes, forget it" (danger) and "Keep it" (secondary); focus moves to "Keep it"; Esc = Keep (and Settings stays open). After forgetting: "No passcode saved. Paste one above.", tabs disappear, Settings auto-opens (no other focus change from the existing rules).
- **Opt-out** (inside Settings): checkbox row, 44px high, 24px box (`accent-color: var(--color-purple-deep)`), text "Don't count my visits on this browser", muted helper "Only this browser. The Instagram app browser keeps its own setting."
- **Footer notes** [2026-11-27 APPROVED 2026-11-27: now live inside the collapsed "About these numbers" disclosure; the always-visible footer is gone] (mono 12px `--color-muted` on white 5.72, padding-top 12px, lines not merged into one block of text; the `i` icon moves to the summary):
  - "Page loads only (no clicks)."
  - "Numbers are sampled by Cloudflare and approximate."
  - "Days are Malaysia time (GMT+8), midnight to midnight. Updated about every 10 minutes."
  (Together these are the exact sentences in plan TASK-32. The word "UTC" never appears in the panel.)

### B. Tabs (Overview, Sources, Pages, Audience, Performance)
- Markup roles: `role="tablist"` `aria-label="Analytics views"`; each `role="tab"` with `aria-selected`, `aria-controls`, roving `tabindex` (selected = 0, others -1); one `role="tabpanel"` with `aria-labelledby` the tab id, `aria-busy="true"` while loading. The panel gets `tabindex="0"` only when it holds nothing focusable (empty or error states).
- **Look** (file-tab idiom, echoes the header tabs): the tablist has a 2px ink bottom border and 6px padding above and at the sides (room for the focus ring, because the list scrolls). Tabs sit on that line, 4px apart: min height 44px, padding 0 16px (tighter from 900 to 1280px, as in the storyboard), 2px ink border (no bottom border), radius 6px 6px 0 0, Zen Kaku Gothic New 700, 14px, UPPERCASE, letter-spacing 1px, `white-space: nowrap`.
  - Inactive: white bg, ink text (17.1). Hover: `--ph-lilac` bg (ink text 12.6). 
  - **Active**: ink bg, `--color-on-dark` text (15.3), 4px pink bar inset at the bottom edge (pink on ink 9.1), tab overlaps the list border by 2px so it looks joined to the content. The active state is shape and weight as well as colour: filled dark tab vs outlined white tabs.
  - **Focus**: `--focus-ring` (3px deep purple, 7.5 on white) with 2px offset, around the whole tab. 
  - Pressed: 1px lower, no shadow.
- **Phone behaviour (decision): ONE row that scrolls sideways, never wraps.** `overflow-x: auto`, `scroll-snap-type: x proximity`, `scrollbar-width: thin` (scrollbar thumb `--color-line`, visible, 4px). Five tabs are about 480px wide, so at 360 and 375px the 4th tab is cut by the screen edge: that cut-off tab is the "there is more" cue (no gradient fade, no arrows). The selected tab is brought into view with `scrollIntoView({ inline: "nearest", block: "nearest" })` on select and on focus; use `behavior: "auto"` (never smooth, so reduced motion is respected without extra code). The row must not make the page scroll sideways (`max-width: 100%`, `min-width: 0` on the parents). Why not wrap: wrapping makes a 3 + 2 block that jumps in height when the selected tab changes and loses the "tabs on a line" look. PC: all five fit, no scroll bar appears (overflow only when needed).
- **Keyboard** (automatic activation, as plan TASK-32): Right / Left move to the next / previous tab and select it (wraps), Home / End go to first / last, Tab leaves the tab list into the panel, Shift+Tab goes back to the selected tab. Selecting a tab loads it only if not loaded for this range. Panel change may fade 150ms only when `prefers-reduced-motion` is not `reduce`.
- Tabs on PC share the controls row with the range switch (section A) [2026-11-27 APPROVED 2026-11-27]; the tab look, roving tabindex and keyboard rules below do not change. Tab order follows plan H10 (DOM order: tablist first, then range switch, Refresh, "Updated"), on every width. On PC (900px and up) this equals the visual left-to-right order (tabs left, tools right). On phone (under 900px) the visual order is range switch + Refresh, "Updated", then tabs, so Tab order differs from the visual order; this is an accepted trade-off in plan H10 (like the TASK-18 desktop Publish order), and reviewers and QA should not flag it.
- Every tab panel starts with the **range line**: mono 13px ink, "27 Oct - 25 Nov 2026 (Malaysia time), compared with the 30 days before" [2026-11-27 APPROVED 2026-11-27: the "compared with the N days before" part is ALWAYS shown on the Overview tab, because the tile percentages use it, whether or not the compare switch is on; N follows the range (7 / 30 / 90). Other tabs show only "27 Oct - 25 Nov 2026 (Malaysia time)"], then the tab's blocks. Block titles are `h3.panel-subtitle` (1rem, 700); each chart has one.

### C. Chart kit (plain inline SVG, no library; one drawing for all widths)
**Series colours** (max 5, fixed order, colour follows the entity). Pink and light purple fail as lines on white (1.9 and 2.2 against white), so they are used only as FILLS with a 2px ink outline (the site's own idiom); the lines are ink and deep purple.

| # | Colour | Use | Second cue |
|---|---|---|---|
| 1 | `--color-ink` #1D1A24 | line: Visits | solid, circle marker |
| 2 | `--color-purple-deep` #5B4A8B | line: Page views | solid, square marker |
| 3 | `--color-purple` #B9A3E3 fill + ink outline | all single-series bars; PC in the device split | bars: none needed (one series); split: diagonal hatch |
| 4 | `--color-pink` #F4A7C0 fill + ink outline | Phone in the device split | dot pattern |
| 5 | `--ph-grey` #DCD6E4 fill + ink outline | Tablet in the device split ("Other" = white fill, cross-hatch) | plain / cross-hatch |

- "Previous period" is the SAME colour as its series, **dashed** (`stroke-dasharray: 6 4`), no markers. Current = solid 2px with 8px markers (white 2px ring). Markers are drawn for 7 days always, for 30 and 90 days only on the hovered / focused day and the last day.
- Validator results (`validate_palette.js`): ink vs deep purple normal-vision DeltaE 24.6, CVD worst 23.7 (PASS). Pink vs light purple normal-vision DeltaE 10.6 (below the 15 floor) and CVD 7.1: they are therefore never touching without a 2px ink separator, always carry different patterns, and are always named by text. The validator's "lightness band / chroma" flags are the zine's near-neutral ink (it is the site's text colour on purpose); contrast, not hue, separates series 1 from 2.
- **Axes and grid (line chart)**: y starts at 0; 3-5 horizontal gridlines at "nice" steps (0, 5, 10, 15); gridline = 1px `--color-line` (decorative, 1.6:1 on purpose; every value is also in the table); baseline = 2px ink; no vertical gridlines, no top or right frame, no second y axis. Tick and axis labels: Space Mono 12px `--color-muted` (5.7 on white, never on a tinted fill); y labels right-aligned 8px left of the plot, x labels centred under the point, 8px below the baseline; numbers in `Intl.NumberFormat("en")`, 10,000 and over as "12k". Plot margins: left 40, right 16 (PC 72 for end labels), top 12, bottom 28. Height 220px phone, 260px PC. The SVG `viewBox` equals the real pixel width (redraw on resize), so text is never scaled below 12px.
- **x labels** ("3 Nov", from the contract's date strings): always the first and last point; others only when 56px apart from the previous label (7 days on phone: every 2nd; 30 days: about every 5th; 90 days: about every 15th).
- **Legend** [2026-11-27 APPROVED 2026-11-27: 2 items while "Compare with previous period" is off (default), 4 while on]. HTML above the chart, always, because there are two series: items in a row, wrapping on phone, each with a 28px SVG swatch that shows the line style and marker ("Visits", "Page views", "Visits, previous period" dashed, "Page views, previous period" dashed), mono 12px ink text, 44px high rows only if they are buttons (they are not toggles; plain text). PC adds direct labels "Visits" and "Page views" in ink mono 12px bold at the right end of each current line (labels moved apart by at least 14px if they would collide). Phone: legend only.
- **Tooltip**: HTML box over the chart, white, 2px ink, `--radius-sm`, hard shadow 3px 3px 0 ink, mono 12px ink, padding 8px 12px, max-width 240px, never outside the chart box (clamped). Content: date line bold ("Mon 3 Nov"), then "Visits 12" and "Page views 30"; [2026-11-27 APPROVED 2026-11-27: the "(before: 9)" parts are added only while compare is on; "before: n/a" when there is no previous]. Plus a 1px ink vertical guide line and the markers for that day. It shows on pointer move (mouse), on tap and on drag along the chart (touch, `touch-action: pan-y`), and **on keyboard focus**: the plot area is one focusable element (`tabindex="0"`, `aria-label` "Chart. Left and Right arrows read each day. Escape hides."), Left / Right step one day, Home / End jump, Esc hides; focus ring = `--focus-ring` around the plot rectangle. The tooltip text is mirrored in a visually hidden `aria-live="polite"` line. The tooltip appears instantly (no fade).
- **Horizontal bar chart** (sources, pages, countries, browsers): one row per item, row pitch 56px phone / 48px PC. Label ABOVE the bar (body 14px 500 ink, wraps, never truncated; page path under it in mono 12px muted), bar 16px high, series 3 fill, 2px ink outline, 4px radius on the right end only, left end flush with a 2px ink baseline. Value at the bar end in mono 12px bold ink, "40 visits - 33%" (outside the bar, on white, never inside). No gridlines, no axis ticks (values are printed). Zero value: no bar, "0". Non-zero but tiny: minimum 4px bar. Order: largest first, except Sources in the fixed order Instagram, Facebook, Google, Direct / unknown, Other. Bar max length = chart width minus 96px reserved for the value. Because the values are always printed, bars have no tooltip and no tab stop (screen readers use the table); hover may highlight the row with `--ph-lilac`.
- **Split bar (Phone / PC / Tablet, 100%)**: ONE bar, 32px high, full width, segments in the order Phone, PC, Tablet (+ Other if present), 2px ink outline round the whole bar (radius 6px) and 2px ink separators between segments, fills by the table above with SVG patterns (`<pattern>`: dots for Phone, 45-degree hatch for PC, none for Tablet, cross-hatch for Other; pattern strokes 1px `--color-ink`, 6px spacing). No text inside segments (small segments would not fit). Direct labels sit in a list under the bar, one row per segment: swatch (24 x 16px, same pattern and outline), name ("Phone", "PC", "Tablet"), big number (heading font 900, 24px) "71%", mono 12px muted "85 visits". Segment under 4px wide still drawn 4px. The list is the legend and the labels at once.
- **Compare switch (Overview) [2026-11-27 APPROVED 2026-11-27]**: a labelled native `<input type="checkbox">` styled as a switch, label text "Compare with previous period" (body 14px 700 ink), row 44px high (the whole row, label included, is the click target), placed under the range line and above the tiles / chart. **OFF by default** and OFF again whenever the range changes or the page reloads (not stored). Track 44 x 24px, 2px ink border, radius 12px; OFF = white track with an ink knob on the left (ink on `--color-line` 10.6 for the knob against the track edge; border ink on white 17.1); ON = `--color-purple-deep` track with a white knob on the right (white on deep purple 7.5) and a 14px check mark inside the knob so the state is shape as well as colour. The words "On" / "Off" are not printed, the state is exposed by the native checkbox (`aria-checked` is implicit) and the knob position. Focus = 3px deep-purple ring around the track, offset 2px (7.5 on white). Knob moves instantly under reduced motion, 150ms otherwise. While OFF: only the two current lines are drawn and the legend has 2 items. While ON: the two dashed previous-period lines are drawn and 2 extra legend items appear. Toggling redraws in place (no refetch if the previous data is already loaded; the Worker response already contains it), keeps focus on the switch, and the chart's `aria-live` line says "Comparison on" / "Comparison off".
- **Stat tiles** (Overview) [2026-11-27 APPROVED 2026-11-27: PC layout and helper text changed]: 2 tiles. Phone: side by side, 2 columns of about 150px, number 28px, above the chart. **PC (900px and up): the two tiles sit in ONE column on the LEFT (about 240px wide, 16px gap between them, number 32px) and the line chart fills the RIGHT (rest of the width)**; tiles and chart are top-aligned. Tile = `--color-bg` fill, 2px ink border, `--radius-card`, padding 16px. Content: mono 12px caps label ("VISITS", "PAGE VIEWS"), value in heading font 900, then the change line: 12px SVG arrow + signed % + word. **The tile helper line "vs previous 30 days" is removed** (too long at 150px); the range line above says once what the percentage compares with, and the tile `aria-label` still says it in full. The change line is the always-visible comparison and does not depend on the compare switch. Examples: up-triangle "+33% up", down-triangle "-12% down", right-pointing triangle "0% no change", dash "n/a" (previous is null or 0: line reads "n/a - no earlier numbers"). Text and arrow are ink (the change is shown by shape and words, not by green / red; more or fewer visits is not "good" or "bad" by itself). The tile's `aria-label` reads "Visits 120, up 33 percent compared with the previous 30 days".
- **Core Web Vitals rows** (Performance; one column per device: Phone, PC; column title has the device swatch). One row each for page load (median), LCP, INP, CLS, laid out as: name in plain words with the short name in mono ("Loading (LCP)", "Reacting to taps (INP)", "Layout jumping (CLS)", "Page load (median)"), the value in heading font 900 20px with unit in mono ("2.3 s", "150 ms", "0.04"; under 1000 ms shown as ms, otherwise seconds with one decimal; CLS two decimals, no unit), the rating chip, and mono 12px muted threshold text ("Good up to 2.5 s, poor above 4 s"). Page load has no rating chip (Google gives no threshold): the chip slot says nothing. Row = white, 2px `--color-line` bottom border, padding 12px 0; phone: name and value on line 1, chip on line 2. Sample line under the column title: "from 120 page loads", and under 20 samples "Few samples (n). Treat as a guess." with the info icon. `null` value: "n/a" in muted mono, chip "n/a".
- **Rating chips** (word + icon + colour; all three differ in shape of icon and border, so grey-scale and CVD still work): pill 28px high, 2px border, mono 12px bold caps, padding 0 10px, icon 14px before the word.

| Rating | Word | Icon (14px, inline SVG) | Fill / border / text | Contrast |
|---|---|---|---|---|
| Good | "Good" | check in a circle | `--ph-lilac` / `--color-purple-deep` / purple-deep | text 5.5 |
| Needs improvement | "Needs improvement" | triangle with "!" | `--ph-pink` / `--color-ink` / ink | text 12.5 |
| Poor | "Poor" | cross in a square | white / `--color-error` / error | text 6.4 |
| No data | "n/a" | dash | white / `--color-line` / muted | text 5.7 |

  Boundaries (Google): LCP 2.5 s and 4 s, INP 200 ms and 500 ms, CLS 0.1 and 0.25 (equal to the limit is Good / Needs improvement). Status colours are reserved: never used as a series colour.
- **"Show the numbers"**: every chart is followed by a native `<details>` with a 44px `<summary>` "Show the numbers" (mono 13px bold, chevron like the fold, focus ring). [2026-11-27 APPROVED 2026-11-27: the toggle UNDER THE STAT TILES is removed on Overview; only the one under the chart stays. Other tabs are unchanged.] Inside: a `<table>` with `<caption>` (the chart summary), `<th scope>`, 13px mono right-aligned numbers (`font-variant-numeric: tabular-nums`), 1px `--color-line` row borders, white on white, header row `--color-bg`. Line chart columns: Date, Visits, Page views, and [2026-11-27 APPROVED 2026-11-27] Visits before, Page views before ONLY while compare is on; box `max-height: 320px; overflow: auto` with a sticky header (this inner scroll is allowed, the page itself never scrolls sideways). Table text wraps (`overflow-wrap: anywhere`).
- **Chart accessibility**: `<svg role="img">` with `<title>` = one summary sentence ("Visits per day, 27 Oct to 25 Nov 2026 (Malaysia time). Total 120, busiest day 3 Nov with 14."). Text from the Worker only via `textContent`.

### D. States (reuse `.msg`: icon + text, 2px left bar; `role="status"` for calm states, `role="alert"` for errors; first line says what happened, second line (`.msg-next`, muted) says what to do, buttons under it)
| State | Chip | Look | Text (line 1 / line 2) | Actions |
|---|---|---|---|---|
| Not set up (empty workerUrl) | Not set up | none, dash icon | "Analytics is not set up yet. See worker/README.md." / "Nothing is sent anywhere until it is." | none; no passcode block, tabs hidden |
| No passcode | No passcode | none, dash icon | "No passcode saved. Paste one in Settings below." [2026-11-27 APPROVED 2026-11-27: was "above"; Settings opens by itself] | Settings auto-opened with the passcode block, tabs hidden |
| Loading | (keeps last) | skeleton + `.ibar` pink bar | "Loading..." (mono) | none; `aria-busy` |
| Empty (all zero) | Last N days | none, dash icon, shown instead of the chart | "No visits in this period yet." / "Only page loads on the public pages are counted. Numbers update about every 10 minutes." | Refresh stays |
| Wrong passcode (401) | Error | err, "!" | "Passcode is wrong. Paste the current one." / "It is kept in this browser until you press Forget passcode." | Try again, Forget passcode (danger) |
| Too many requests (429) | Error | err | "Cloudflare is busy. Try again in 2 minutes." (N from retryAfter, rounded up; under a minute: "in a minute") / "Your passcode is fine." | Try again |
| Cloudflare error (502) | Error | err | "Could not load the numbers. Try again." / "Cloudflare did not answer properly. Your passcode is fine." | Try again |
| Network failure | Error | err | "Could not reach the analytics Worker. Check your internet connection." / "Nothing was changed." | Try again |
| 90 days not available | (unchanged) | none, dash icon, under the range switch | "90 days is not available yet. Cloudflare has not kept that much data." / "Showing 30 days instead." | none (90 stays disabled) |
| Wrong origin (403) | Error | err | "This page is not allowed to ask for the numbers. Open /admin/ from the real site address." / "The Worker only answers the address it was set up for. See worker/README.md." | none (retry cannot help) |
| Worker not configured (503) | Error | err | "The Worker is missing a setting. See worker/README.md." | Try again |
- **Skeleton**: static (no shimmer, nothing moves except the existing `.ibar` bar, which is already still under reduced motion): two tile blocks and one chart block (`--color-bg` fill, 2px `--color-line` border, `--radius-card`, same height as the real chart so nothing jumps), 4 faint gridlines inside. Bar tabs: 4 row blocks. Text "Loading..." stays visible for screen readers.
- Errors replace only the tab panel content; the range switch, tabs and passcode row stay usable. A failed tab keeps no half-drawn chart.

### E. Layout, size, motion and contrast
- **Phone (under 900px)**: single column; panel padding 16px; tiles 2 columns; every chart full width (311px at 375, never wider than the panel, no sideways page scroll at 360px); Performance Phone column above PC column; Pages two bar charts stacked; Audience: split bar, Countries, Browsers stacked. Buttons 44px high, form rows stacked full width, spacing 16px between blocks, 8px inside a block. Controls: range switch + 44px icon Refresh on one row, "Updated" under, tabs row below (section A).
- **PC (900px and up)**: panel full width (last block of the page, after Moments and the Media uploader); controls row on one line (tabs left, range + Refresh + Updated right); Overview: tiles in a ~240px column on the LEFT and the line chart filling the RIGHT (260px high) [2026-11-27 APPROVED 2026-11-27: was tiles above a full-width chart]; Pages: two bar charts in two equal columns; Audience: split bar full width, then Countries and Browsers in two columns; Performance: Phone and PC columns side by side (equal, 24px gap). Content never wider than the panel (page max 1280px).
- **Minimum sizes**: tabs, range options, buttons, summary toggles, checkbox rows 44px; chart text 12px minimum (mono) and 14px for bar labels; markers 8px; keyboard-only controls (plot area) get a visible 3px ring.
- **Reduced motion**: charts, tooltip, skeleton, tab change and scrolling use no animation; no 150ms fade, no smooth scroll, chevron does not rotate with a transition (existing rule); the `.ibar` becomes a static full bar (existing rule). The drawing is identical with and without the setting.
- **Contrast** (WCAG ratios, computed with a short script on 2026-11-27; text needs 4.5, graphics and focus rings 3):
  - Text: ink on white 17.1, ink on bg 15.3, text-2 on white 11.8, muted on white 5.7, muted on bg 5.1 (muted never on `--ph-grey` 4.0 or `--ph-lilac` 4.2), deep purple on white 7.5, on bg 6.7, on `--ph-lilac` 5.5, error on white 6.4, on bg 5.7, ink on `--ph-pink` 12.5, ink on pink 9.1, ink on purple 7.7, ink on `--ph-grey` 12.1, on-dark #F3F1F6 on ink 15.3 (active tab and range option).
  - Graphics: ink line on white 17.1, deep-purple line on white 7.5, pink bar fill on white 1.9 and purple fill on white 2.2 (so every fill has the 2px ink outline, 17.1, and is labelled in text), gridline `--color-line` on white 1.6 (decorative on purpose), pink tab bar on ink 9.1, focus ring on white 7.5. Deep-purple focus ring on the ink active tab is 2.3, so the ring is drawn outside the tab on the white panel (offset 2px), never on the tab itself.
- **Do** [2026-11-27 APPROVED 2026-11-27, admin layout]: put Analytics last on the whole page (after Moments and the Media uploader, on phone and PC) and collapsed; keep tabs left and range / Refresh / Updated right on one baseline on PC; fold Settings and About into collapsed disclosures; use one gap value on the whole admin page; use pink for exactly one main action per screen; put secondary file actions in the Backup menu; open Settings automatically when there is no passcode. **Don't**: put the passcode block, opt-out or footer notes always visible in the panel; show previous-period lines without the compare switch on; repeat "vs previous 30 days" on every tile; fill EXPORT black; show two pink buttons at once; mix 24px and 40px gaps between panels; leave a grid item stretching (always `align-items: start`).
- **Do**: say "visits" and "page views", never "visitors" or "people"; show a table for every chart; label by words, icons or patterns as well as colour. **Don't**: use a second y axis, pie or donut charts, 3D, rounded line smoothing that invents values, gradients, animation, tooltips that only work on hover, status colours as series colours, UTC anywhere.

### G. Admin page spacing and actions [2026-11-27 APPROVED 2026-11-27] (changes 5 and 6)
- **One gap value for the whole admin page**: `--admin-gap` = `var(--space-6)` (24px) on phone and `var(--space-8)` (32px) from 900px up. It is used for BOTH axes: between stacked panels, between grid rows and between grid columns, and between the action row, the grid, Moments, the Media uploader and the Analytics panel (the last block). The old mix (24px grid gap, 24px grid bottom margin, 40px seen between panels) goes. Panels have no own `margin-bottom` (the container's `gap` does the spacing, so there are no stray margins and no double gaps; `.gh-panel`, `.pub-panel` lose theirs). Grid items use `align-items: start` (no stretching). Inside a panel the existing 8 / 12 / 16px steps stay.
- **Publish panel**: the Publish to GitHub button sits 12px (`--space-3`) under the header row (it currently touches the header).
- **One pink primary per screen**: pink (`--color-pink`, accent button) always means "the main action right now". Nothing pending: **NEW EVENT** is pink (accent) and Publish is disabled (line border, muted text). Changes pending and a token saved: **PUBLISH TO GITHUB** (enabled) is pink and NEW EVENT becomes secondary (white, ink border). A disabled Publish is never pink. Never two filled pink buttons at once. EXPORT is no longer filled (it becomes a Backup menu item); the other filled black (ink, primary) buttons, such as Save, Download all and dialog confirms, stay black [user accepted 2026-11-27]. The pink state is also described in text ("6 pending" chip), colour is not the only cue.
- **Backup menu button**: ONE secondary 44px button "Backup" with a chevron, placed after the pink action in the action row (phone: same row if it fits, else wraps; 44px high). Native `<details class="backup-menu">` / `<summary>` popover: opening shows a white card (2px ink border, `--radius-card`, hard shadow 3px 3px 0 ink, min width 220px, 8px gap under the button, z-index above panels) with three full-width 44px items: **Import events.json**, **Export events.json**, **Discard draft**. Items are ink text on white (17.1), hover/focus `--ph-lilac` (ink 12.6). **Discard draft keeps its danger style** (`--color-error` text and a "!" or trash icon, 6.4 on white; on lilac hover 4.7, still passes) and keeps its existing confirm before anything is deleted. Import opens the file picker; Export downloads as now.
  - Focus order: Backup summary, then (when open) Import, Export, Discard draft, then back to the page order (Tab does not trap; Tab past the last item closes the menu). Enter / Space on the summary toggles; Up / Down arrows move between items while open (optional bonus, Tab is the required way). **Esc closes the menu and returns focus to the Backup summary.** Clicking an item runs it and closes the menu (focus returns to Backup, except Discard draft which moves focus into its confirm and returns to Backup after Cancel). Clicking outside closes it. `aria-haspopup` is not used on a details element; the summary text says "Backup" and the open state is exposed by the native `open` attribute.
- Contrast (script, 2026-11-27): ink on pink 9.1, white on deep purple (switch ON) 7.5, ink on `--color-line` 10.6, ink on white 17.1, ink on lilac 12.6, error on white 6.4, error on lilac 4.7, muted on white 5.7, deep-purple ring on white 7.5. All text pairs are at least 4.5, graphics at least 3.

### F. Variables for this section
No new hex values. Add these aliases to `css/tokens.css` (and to the block below) once approved:
```css
:root {
  --chart-1: var(--color-ink);          /* Visits line */
  --chart-2: var(--color-purple-deep);  /* Page views line */
  --chart-3: var(--color-purple);       /* bars, PC fill (with ink outline) */
  --chart-4: var(--color-pink);         /* Phone fill (with ink outline) */
  --chart-5: var(--ph-grey);            /* Tablet fill (with ink outline) */
  --chart-grid: var(--color-line);
  --chart-axis: var(--color-ink);
  --chart-label: var(--color-muted);
  --status-good-fg: var(--color-purple-deep); --status-good-bg: var(--ph-lilac);
  --status-mid-fg: var(--color-ink);          --status-mid-bg: var(--ph-pink);
  --status-poor-fg: var(--color-error);       --status-poor-bg: var(--color-surface);
  --chart-h: 220px;                           /* 260px from 900px up */
  --admin-gap: var(--space-6);                /* 2026-11-27 APPROVED 2026-11-27: 24px phone */
}
@media (min-width: 900px) { :root { --chart-h: 260px; --admin-gap: var(--space-8); } } /* 32px PC */
```

## CSS variables
```css
:root {
  --color-bg: #F3F1F6;
  --color-surface: #FFFFFF;
  --color-ink: #1D1A24;
  --color-text: #1D1A24;
  --color-text-2: #3B3546;
  --color-muted: #6A6378;
  --color-line: #CFC8DA;
  --color-floor: #E4DEEC;
  --color-grid: #D2C8DF;
  --color-primary: #1D1A24;
  --color-pink: #F4A7C0;
  --color-purple: #B9A3E3;
  --color-purple-deep: #5B4A8B;
  --color-dark-card: #2B2734;
  --color-on-dark-muted: #C9C2D6;
  --color-error: #B3264F;
  --ph-pink: #F7D3DF; --ph-lilac: #E3D8F6; --ph-sky: #D6ECF7; --ph-grey: #DCD6E4;

  --font-heading: "Zen Kaku Gothic New", "Hiragino Kaku Gothic ProN", sans-serif;
  --font-body: "Zen Kaku Gothic New", "Hiragino Kaku Gothic ProN", sans-serif;
  --font-mono: "Space Mono", ui-monospace, monospace;
  --fs-h1: clamp(2rem, 1.2rem + 3.5vw, 3.5rem);
  --fs-h2: clamp(1.5rem, 1.1rem + 1.6vw, 2.25rem);
  --fs-h3: clamp(1.125rem, 1rem + 0.5vw, 1.5rem);
  --fs-body: 1rem;
  --fs-small: 0.75rem;
  --lh-heading: 1.15; --lh-body: 1.6; --lh-ja: 1.7;
  --ls-heading: 1.5px;

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;
  --content-max: 1280px;
  --gutter: 16px; /* 32px >=768, 48px >=1200 */
  --bp-tablet: 768px; --bp-desktop: 1200px;

  --radius-sm: 4px; --radius-btn: 6px; --radius-card: 10px;
  --outline: 2px solid var(--color-ink);
  --shadow-pass: 6px 6px 0 var(--color-ink);
  --shadow-hover: 3px 3px 0 var(--color-ink);
  --focus-ring: 3px solid var(--color-purple-deep);
  --tap-min: 44px;
  --dur-fast: 180ms; --dur-slow: 600ms;
  /* v2 (add to css/tokens.css only if not present) */
  --focus-ring-on-dark: 3px solid #FFFFFF;
  --wm-color: #FFFFFF; --wm-opacity: 0.4; --wm-lattice-angle: 45deg;
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-slow: 0ms; }
}
```
