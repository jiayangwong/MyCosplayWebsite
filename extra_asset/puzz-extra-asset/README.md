# Puzz Kezz cosplay website: extra assets and ideas

Collected from the idea-collector chat on 2026-11-16.

## Folder contents

| Path | What it is |
|---|---|
| `gacha-prototype/index.html` | 3D gacha machine opening (three.js from CDN). Open in a browser. Live copy: https://claude.ai/artifact/QSgLDJbgnTzq16a5AUex8n |
| `audio-tools/melody-player.html` | Original さしすせそ melody (Web Audio), with key and tempo sliders, for singing practice |
| `audio-tools/voice-player.html` | Japanese text-to-speech pronunciation guide (best in Edge, Nanami voice) |
| `audio-tools/scroll-audio-snippet.html` | Code: one looping audio plays while the reels section is visible, after "Sound on" |
| `design-canvas/` | Source files of the 3 homepage layout concepts (desktop + phone). These are Claude Design canvas files and don't open as normal web pages. View them here: https://claude.ai/artifact/G21i2sRrvB3f2cVuDZaiYF |
| `sashisuseso-reference.png` | The さしすせそ reference screenshot |

## Ideas and decisions so far

### Homepage reels section: さしすせそ
- 5 boxes, one Instagram reel each:
  - さ さすが！ = best cosplay
  - し 知らなかった！ = behind the scenes
  - す すごい！ = transformation
  - せ センスいいね！ = outfit details
  - そ そうなんだ！ = event vlog
- Each box shows your own cover image. Tapping it opens the reel on Instagram (more reliable than embeds, and views count there). The Instagram account must stay public.
- The phrases are free to use. Write your own explanations; don't copy text from the Medium article or YouTube video.

### Audio
- One audio file loops while the reels section is visible, and starts only after the visitor taps "Sound on" (browsers block sound before a tap).
- Don't use the YouTube clip (0:54–1:01) without the creator's written permission, and don't clone her voice with AI.
- Options: record your own voice (speaking or singing; your own melody, not hers), VOICEVOX with a credit like "VOICEVOX:ずんだもん", or a hired voice actor.
- Keep the clip short (5–8 s), as an MP3 under ~100 KB, at about 60% volume.

### Opening animation concepts (layouts in `design-canvas/`)
1. Sweet and gothic switch (recommended look): pastel and gothic sides, a toggle flips day/night, sakura and rose petals
2. Lolita music box: a lace arch frame, the name writes itself in, sparkles
3. Convention sticker bomb: polaroids, stickers, a "Breaking news from Puzz" ticker

### Tech notes
- TypeScript: use it for safety; no size or visual effect.
- Rust/WASM: not needed for this page.
- three.js: about 115 KB gzipped. Fine if the page shows first and the 3D loads after it.
- Lightweight alternative: WebGL2 shaders or OGL (about 17 KB).
- Use WebGL2 rather than WebGPU, because WebGPU covers only about 84% of browsers.
- Most visitors come from the Instagram bio link on phones. Compress photos (WebP) and models, and show a lighter version on weak phones.

### Animation ideas with three.js
- Gacha machine (prototype built): a capsule opens to reveal a reel card with SR/SSR/UR rarity, Watch reel and Spin again buttons
- Lolita wardrobe: doors open, cosplay photo cards sway on hangers
- Convention walk-through: a scroll-driven camera flies past photo polaroids
- Petal storm that forms the name "Puzz Kezz"

### Gacha prototype: still to do
- Replace the coloured placeholders with real reel covers
- Link each card to its specific reel (it currently opens the profile)
- Possibly add a gothic variant of the machine
