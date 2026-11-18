# Style guide - Puzz Kezz website ("Concept 6B")

STYLE APPROVED: 2026-11-18 (by the user, including the v2 additions for IDEA-8 / IDEA-9).

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
  - Success: check icon, text ink, left bar `--color-purple-deep`, e.g. "Connected to owner/repo (branch main)."
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
