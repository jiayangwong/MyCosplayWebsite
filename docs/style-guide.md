# Style guide - Puzz Kezz website ("Concept 6B")

Status: awaiting user approval (the main session records approval).

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
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-slow: 0ms; }
}
```
