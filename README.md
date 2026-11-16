# Puzz Kezz: cosplay website

Static site (HTML + CSS + vanilla JavaScript, no build step, no database), hosted on GitHub Pages.

- **Specification:** [docs/specification.md](docs/specification.md)
- **Plan / style guide / storyboard:** [docs/plan.md](docs/plan.md), [docs/style-guide.md](docs/style-guide.md), [storyboard/index.html](storyboard/index.html)
- **Screenshots:** [docs/screenshots/](docs/screenshots/)

## Run locally
```
python3 -m http.server 4173 --bind 127.0.0.1
```
Open http://127.0.0.1:4173/. The event manager is at http://127.0.0.1:4173/admin/.

## Add an event
Open `/admin/`, add the event and its photos (they get watermarked automatically), click **Export events.json**, replace `data/events.json`, add the photos under `media/events/<event-id>/`, then commit and push. Full steps are in the specification, §5.

## Tests
```
npm install
npx playwright install chromium
npx playwright test
```
