// TASK-30: Cloudflare beacon loader (js/analytics.js) on the public pages only, plus the public-page CSP.
// Nothing here reaches the internet: every request to cloudflareinsights is aborted and fails the test that made it.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const PUBLIC = ['index', 'gallery', 'reels', 'events', 'about', 'contact', '404'];
const HOST = 'puzzkezz-testing.loc.cc';

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---- Node-only checks (no browser page) ----

test('repo scan: admin/ and storyboard/ never mention the beacon', () => {
  const files = [...walk(path.join(ROOT, 'admin')), ...walk(path.join(ROOT, 'storyboard'))].filter((f) => /\.(html|js|css)$/.test(f));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    expect(text.includes('analytics.js'), f).toBe(false);
    expect(text.includes('cloudflareinsights'), f).toBe(false);
    expect(text.includes('data-cf-beacon'), f).toBe(false);
  }
});

test('repo scan: each of the 7 public pages loads analytics.js once, has no inline script and has the CSP', () => {
  for (const name of PUBLIC) {
    const html = fs.readFileSync(path.join(ROOT, `${name}.html`), 'utf8');
    expect((html.match(/analytics\.js/g) || []).length, name).toBe(1);
    expect(html.includes('data-cf-beacon'), name).toBe(false);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    expect(scripts.length, name).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) {
      expect(attrs, `${name} inline script`).toMatch(/\ssrc="/);
      expect(body.trim(), `${name} inline script body`).toBe('');
    }
    expect(html, name).not.toMatch(/\son[a-z]+=/i);
    const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
    expect(meta, `${name} CSP`).not.toBeNull();
    expect(meta[1]).toContain("script-src 'self' https://static.cloudflareinsights.com;");
    expect(meta[1]).toContain("object-src 'none'");
    expect(meta[1]).not.toContain('unsafe-inline');
    expect(meta[1]).not.toContain('unsafe-eval');
  }
});

test('siteHost equals CNAME and the token is still a placeholder', async ({ page }) => {
  const cname = fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim();
  await page.goto('index.html');
  const cfg = await page.evaluate(async () => (await import('/js/site-config.js')).SITE.analytics);
  expect(cfg.siteHost).toBe(cname);
  expect(typeof cfg.beaconToken).toBe('string');
});

// ---- Browser checks ----

test('shouldLoadBeacon is true only for the right host + token + no opt-out', async ({ page }) => {
  await page.goto('index.html');
  const r = await page.evaluate(async (host) => {
    const { shouldLoadBeacon } = await import('/js/analytics.js');
    const ok = { hostname: host, siteHost: host, token: 'abc', optOut: null };
    return {
      ok: shouldLoadBeacon(ok),
      optOutNull: shouldLoadBeacon({ ...ok, optOut: null }),
      optOutZero: shouldLoadBeacon({ ...ok, optOut: '0' }),
      optOut: shouldLoadBeacon({ ...ok, optOut: '1' }),
      emptyToken: shouldLoadBeacon({ ...ok, token: '' }),
      blankToken: shouldLoadBeacon({ ...ok, token: '   ' }),
      noToken: shouldLoadBeacon({ ...ok, token: undefined }),
      loopback: shouldLoadBeacon({ ...ok, hostname: '127.0.0.1' }),
      localhost: shouldLoadBeacon({ ...ok, hostname: 'localhost' }),
      emptyHost: shouldLoadBeacon({ ...ok, hostname: '', siteHost: '' }),
      other: shouldLoadBeacon({ ...ok, hostname: 'evil.example' }),
      none: shouldLoadBeacon(),
    };
  }, HOST);
  expect(r.ok).toBe(true);
  expect(r.optOutNull).toBe(true);
  expect(r.optOutZero).toBe(true);
  for (const k of ['optOut', 'emptyToken', 'blankToken', 'noToken', 'loopback', 'localhost', 'emptyHost', 'other', 'none']) expect(r[k], k).toBe(false);
});

for (const name of PUBLIC) {
  test(`${name}: loader requested once, no cloudflareinsights request, no beacon tag (127.0.0.1)`, async ({ page }) => {
    const insights = [];
    const loader = [];
    page.on('request', (req) => {
      if (/cloudflareinsights/.test(req.url())) insights.push(req.url());
      if (/\/js\/analytics\.js(\?|$)/.test(req.url())) loader.push(req.url());
    });
    const csp = [];
    page.on('console', (msg) => { if (/Content Security Policy/i.test(msg.text())) csp.push(msg.text()); });
    await page.goto(name === '404' ? '404.html' : `${name}.html`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    expect(loader.length).toBe(1);
    expect(insights).toEqual([]);
    expect(csp).toEqual([]);
    await expect(page.locator('[data-cf-beacon]')).toHaveCount(0);
    await expect(page.locator('script[src*="cloudflareinsights"]')).toHaveCount(0);
    await expect(page.locator('.site-header, header').first()).toBeVisible(); // page script still ran (chrome mounted)
  });
}

test('loader with a forced host adds exactly one beacon tag with the token; opt-out adds none', async ({ page }) => {
  const insights = [];
  await page.route(/cloudflareinsights/, (route) => { insights.push(route.request().url()); route.abort(); });
  await page.goto('index.html');
  const result = await page.evaluate(async (host) => {
    const { loadBeacon } = await import('/js/analytics.js');
    const args = { hostname: host, siteHost: host, token: 'TEST-TOKEN-not-real', optOut: null };
    const first = loadBeacon(args);
    const second = loadBeacon(args);
    const tags = [...document.head.querySelectorAll('script[data-cf-beacon]')];
    return {
      first, second, count: tags.length,
      src: tags[0].getAttribute('src'), defer: tags[0].defer, type: tags[0].type, data: tags[0].getAttribute('data-cf-beacon'),
    };
  }, HOST);
  expect(result.first).toBe(true);
  expect(result.second).toBe(false);
  expect(result.count).toBe(1);
  expect(result.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
  expect(result.defer).toBe(true);
  expect(result.type).toBe('module');
  expect(JSON.parse(result.data)).toEqual({ token: 'TEST-TOKEN-not-real' });
  await expect.poll(() => insights.length).toBeGreaterThan(0); // the CSP lets this one host through (we aborted it)
  expect(insights.every((u) => u.startsWith('https://static.cloudflareinsights.com/'))).toBe(true);

  await page.goto('about.html');
  const optedOut = await page.evaluate(async (host) => {
    localStorage.setItem('puzzkezz.analytics.optout', '1');
    const { loadBeacon, readOptOut } = await import('/js/analytics.js');
    const added = loadBeacon({ hostname: host, siteHost: host, token: 'TEST-TOKEN-not-real', optOut: readOptOut() });
    localStorage.removeItem('puzzkezz.analytics.optout');
    return { added, tags: document.querySelectorAll('script[data-cf-beacon]').length };
  }, HOST);
  expect(optedOut).toEqual({ added: false, tags: 0 });
});

test('a throwing localStorage counts as not opted out', async ({ page }) => {
  await page.goto('index.html');
  const r = await page.evaluate(async () => {
    const { readOptOut } = await import('/js/analytics.js');
    const bad = { getItem() { throw new Error('blocked'); } };
    return { thrown: readOptOut(bad), none: readOptOut(null), set: readOptOut({ getItem: () => '1' }) };
  });
  expect(r).toEqual({ thrown: null, none: null, set: '1' });
});

test('the page CSP blocks other script hosts and inline scripts', async ({ page }) => {
  await page.goto('index.html');
  const r = await page.evaluate(() => new Promise((resolve) => {
    const seen = [];
    document.addEventListener('securitypolicyviolation', (e) => seen.push(e.violatedDirective));
    const inline = document.createElement('script');
    inline.textContent = 'window.__inlineRan = true';
    document.head.append(inline);
    const ext = document.createElement('script');
    ext.src = 'https://example.invalid/x.js';
    document.head.append(ext);
    setTimeout(() => resolve({ ran: !!window.__inlineRan, seen }), 400);
  }));
  expect(r.ran).toBe(false);
  expect(r.seen.some((d) => d.startsWith('script-src'))).toBe(true);
});
