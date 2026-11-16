# Changelog

## Unreleased
- 2026-11-17 TASK-1: site shell. Design tokens, fonts, header tabs (PC), MENU full-screen menu (phone), footer, robots.txt (css/tokens.css, css/base.css, js/nav.js, js/site-config.js, *.html)
- 2026-11-17 TASK-2: event data layer. Sample data/events.json, load / sort newest first / group by year / validate / make ids, embed detection (js/events-data.js, js/embed.js, data/events.json)
- 2026-11-17 TASK-3: Home convention hall. Guest pass, hall signs, polaroids that flip, scroll "camera", descending years-only YOU ARE HERE timeline, reduced-motion list (index.html, js/hall.js, css/home.css, css/components.css)
- 2026-11-17 TASK-4: pronunciation block (furigana / romaji / meaning / speaker) and さしすせそ reels on Home and reels.html (js/pronounce.js, js/reels.js, data/reels.json, css/reels.css)
- 2026-11-17 TASK-5: Events page. Grouped by year, click-to-load embeds, Sample tags, deep links (events.html, js/events-page.js, css/pages.css)
- 2026-11-17 TASK-6: admin event manager. Form, validation, browser draft, import/export events.json, embed preview (admin/index.html, js/admin/manager.js, css/admin.css)
- 2026-11-17 TASK-7: media uploader with automatic watermark. Max 2000px, WebP, EXIF removed, attach to event (js/admin/watermark.js)
- 2026-11-17 TASK-8: Gallery, About, Contact pages (gallery.html, about.html, contact.html, js/gallery.js)
- 2026-11-17 TASK-9: meta and Open Graph tags, favicon, og-image, 404 page, accessibility checks (404.html, favicon.svg, og-image.png)
- 2026-11-17 Tests: Playwright tests/task-1..9.spec.js, 80 checks passing at PC and phone sizes
