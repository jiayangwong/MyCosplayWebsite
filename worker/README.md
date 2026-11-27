# Analytics Worker (TASK-31)

A tiny Cloudflare Worker that reads your site's **Cloudflare Web Analytics** numbers and hands them, as plain JSON, to the
Analytics panel in `/admin/` (built in TASK-32 to TASK-35). The admin page never talks to Cloudflare directly, and your
Cloudflare token never leaves the Worker.

- Endpoint: `GET <worker url>/v1/stats?tab=<overview|sources|pages|audience|performance>&days=<7|30|90>`
- Header: `Authorization: Bearer <your passcode>`; only from the origin in `ALLOWED_ORIGIN`.
- **Days are Malaysia days (GMT+8), midnight to midnight**, ending yesterday in Malaysia time. Cloudflare itself groups by UTC
  day, so the Worker asks for hourly rows and regroups them into GMT+8 days itself (`hoursToLocalDays` in `src/index.js`).
  GMT+8 never changes (no daylight saving), so it is a fixed +8 hours.
- Answers are cached for 10 minutes, so opening the panel often causes few Cloudflare calls. **Unverified:** the Cache API may
  do nothing on a `*.workers.dev` address; if so, every panel open calls Cloudflare again.
- No npm packages, no build step. Tests: `npx playwright test tests/task-31.spec.js` (Node only; nothing reaches Cloudflare).

## What was checked (2026-11-27) and what was not

Cloudflare's docs pages (developers.cloudflare.com) could not be opened from the build machine (its network policy
blocked them). The **source text of the same docs** (github.com/cloudflare/cloudflare-docs, branch `production`) was read
instead. Nothing could be tested against a real Cloudflare account, because there is no account or token yet.

**Confirmed in Cloudflare's own docs text**
- Account-level datasets are queried as `viewer { accounts(filter: { accountTag }) { ... } }`, one account per query.
- A `settings` node exists next to the datasets and gives, per dataset: `enabled`, `availableFields`, `maxPageSize`,
  `maxNumberOfFields`, `notOlderThan` (seconds back), `maxDuration` (widest time range, seconds). The Worker reads it.
- Filters accept the operators `gt`, `lt`, `geq`, `leq`, `neq`, `in` on scalar fields (for example `datetime_geq`,
  `datetime_lt`), and `datetimeHour` exists as a general hourly dimension (the docs show it on another dataset).
- GraphQL answers are sampled, and a `sampleInterval` field tells how much (adaptive datasets).
- API token: **Account -> Account Analytics -> Read** is the documented permission (page "Configure an Analytics API token").
  Tokens are now created on the **Account API tokens** page; Custom Token lets you set an expiry (TTL).
- Limit: 300 GraphQL queries per 5 minutes per user.
- Web Analytics FAQ: data is available for **the previous six months**; unsampled data is kept 7 days, then reduced to about
  10 percent. The beacon is `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "..."}'>`;
  a page CSP needs `script-src` for that file and `connect-src cloudflareinsights.com`. Cloudflare only accepts beacons from the
  hostname you registered (it matches the end of the host name) and needs a `Referer` / `Origin` header.
- The "30 days of analytics on every plan" change (2 Oct 2026) is about the HTTP, security and DNS adaptive datasets of a
  domain. It does **not** say anything about Web Analytics (RUM) data, so it is not used here. The six months above is.
- The dashboard menus changed in October 2026 (domain analytics are tabs under **Analytics**; account-level analytics under
  **Observability -> Analytics**).

**NOT confirmed (no Cloudflare page or account was available to prove them; the Worker is written defensively)**
- That the three datasets `rumPageloadEventsAdaptiveGroups`, `rumPerformanceEventsAdaptiveGroups` and
  `rumWebVitalsEventsAdaptiveGroups` exist with exactly these names, are account-level (the Worker assumes they are, and so also
  needs the account ID), and are on your plan.
- That they accept the filters `siteTag`, `datetime_geq`, `datetime_lt` and have the hourly dimension `datetimeHour`.
- The field names used: `count`, `sum { visits }`, dimensions `refererHost`, `requestPath`, `countryName`, `deviceType`,
  `userAgentBrowser`; `quantiles { pageLoadTimeP50 firstContentfulPaintP75 }`; `quantiles { largestContentfulPaintP75
  interactionToNextPaintP75 cumulativeLayoutShiftP75 }`; and the rating counts `sum { lcpGood lcpNeedsImprovement lcpPoor inpGood
  ... clsPoor }`. All of them are in `EXPECTED_FIELDS` at the top of `src/index.js` (from the planner's memory and third-party notes).
- The unit of the timing fields (the Worker assumes milliseconds) and whether `orderBy: [count_DESC]` is accepted.
- The real `maxDuration`, `maxPageSize`, `notOlderThan` and hourly retention of the three datasets for a free account, and whether
  the datasets even show up in the `settings` node.
- Whether a bot filter exists (none is applied).
- Where exactly the **site tag** is shown (it may differ from the beacon token, see step 2).

**How the Worker copes**: if the `settings` node cannot be read it uses safe defaults (queries of 7 days at a time, data kept 180
days, from the six months in the FAQ). If one field name is wrong, only the tab that uses it answers `502 upstream`; the other tabs
keep working. If hourly data is not kept long enough, that range answers `502` with code `range-unavailable` (the 90-day switch
is then switched off); it never falls back to UTC days. **Run the schema check below before you rely on the numbers.**

## Check the schema (5 minutes, read-only)

After step 5 below you have a token. From this `worker/` folder:

```
CF_API_TOKEN=<your token> ACCOUNT_ID=<your account id> SITE_TAG=<your site tag> node scripts/check-schema.mjs
```

It lists every Cloudflare field the Worker uses as `OK` or `MISSING`, prints the real limits of the three datasets and tests one
tiny hourly query. If anything says `MISSING`, tell the programmer (the Worker queries need a small change).

## Setup: what you do (about 20 minutes)

If a menu looks different from the names below, type **Web Analytics** in the dashboard search box.

1. **Cloudflare account.** Create a free account at cloudflare.com. Your site stays on GitHub Pages; no DNS change is needed.
2. **Add the site.** Dashboard -> **Web Analytics** (older path: Account home -> Analytics & Logs -> Web Analytics) -> **Add a site** ->
   type the host name from the `CNAME` file (`puzzkezz-testing.loc.cc`) -> **Done**. Open **Manage site** and copy the JS snippet.
   Copy two things: the **beacon token** (the long value inside `data-cf-beacon='{"token": "..."}'`) and the **site tag**
   (shown in the site's settings; if you only see one value, use it for both and run the schema check; it prints whether the
   sample query returns rows).
3. **Beacon token into the site.** Paste the beacon token into `js/site-config.js`, `analytics.beaconToken` (it is not a secret, it is
   visible in every page), commit it, or ask the programmer. Until then the site loads no beacon at all.
4. **Account ID.** Dashboard home -> your account -> copy the **Account ID** (not a password, but keep it out of the public repo).
5. **API token.** Dashboard -> **Manage account -> Account API tokens** (older path: My Profile -> API Tokens) -> **Create Token ->
   Create Custom Token**. Permission: **Account -> Account Analytics -> Read**. Account resources: **only this account**. Set an
   **expiry date**. Nothing else. Create it and copy the token once (you cannot see it again).
6. **Passcode.** Make 24 or more random characters with your password manager. The Worker refuses to run with a shorter one.
7. **Install tools.** Install Node 18 or newer, then in this folder `npx wrangler login`. Copy `wrangler.toml.example` to
   `wrangler.toml` and fill in `ACCOUNT_ID`, `SITE_TAG` and `ALLOWED_ORIGIN = "https://puzzkezz-testing.loc.cc"`.
   (`wrangler.toml` is in `.gitignore`: it never goes to GitHub.)
8. **Secrets and deploy.**
   ```
   npx wrangler secret put CF_API_TOKEN     # paste the API token from step 5
   npx wrangler secret put PASSCODE         # paste the passcode from step 6
   npx wrangler deploy
   ```
   Note the Worker URL it prints (`https://puzzkezz-analytics.<your-subdomain>.workers.dev`).
   If the Worker was ever deployed before the Overview `previousDaily` field existed (needed for the Compare switch), run `npx wrangler deploy` again.
9. **Tell the programmer the Worker URL.** It goes into `js/admin/analytics-config.js` and the admin CSP (TASK-32). Then paste
   the passcode in `/admin/` -> Analytics.
10. **Rotate or revoke.** New passcode: `npx wrangler secret put PASSCODE` again, then paste the new one in each browser. If the
    API token leaks, revoke it on the Account API tokens page and make a new one (`wrangler secret put CF_API_TOKEN`).

Local try-out on your own computer: copy `.dev.vars.example` to `.dev.vars` (gitignored), fill it in, run `npx wrangler dev`.

## What Cloudflare can't tell you

- **Page loads only.** Clicks (reel taps that go to Instagram, Gallery photo opens, the Hall ??? polaroid) are not counted.
- **Sampled, approximate numbers**, especially small ones; sampling is applied per hour too, so a single day is approximate.
- **"Visits", not "people".** Cloudflare Web Analytics sets no cookies and does not count unique visitors.
- **Instagram may be under-counted.** Visits from inside the Instagram app often arrive without a referrer and show as "Direct / unknown".
- **Your own visits on the public pages count** unless you switch the opt-out on in that browser. `/admin/` is never counted.
- **Days are Malaysia days (GMT+8).** The last day shown is yesterday, so every day is complete.
- When a range is split into several Cloudflare queries, the performance percentiles are a count-weighted average of the pieces (an approximation).

## Errors the Worker answers (JSON `{ "error": "<code>" }`, nothing else)

`400 bad-request` (unknown tab, days not 7 / 30 / 90, any other parameter), `401 passcode`, `403 origin`, `404 not-found`, `405 method`,
`429 busy` (+ `retryAfter` seconds), `502 upstream` (Cloudflare error or unexpected answer; for a range Cloudflare does not keep:
`{ "error": "upstream", "code": "range-unavailable" }`), `503 not-configured` (a secret or variable is missing, or the passcode is
shorter than 24 characters or still the example placeholder). The logs contain only a short code, never the token, passcode or Cloudflare's error text.
