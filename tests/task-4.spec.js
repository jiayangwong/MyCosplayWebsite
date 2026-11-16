// TASK-4: pronunciation component + さしすせそ reels on Home and reels.html.
const { test, expect } = require('@playwright/test');
const { isPhone } = require('./helpers');

// Record calls to speechSynthesis.speak instead of making sound.
async function stubSpeech(page) {
  await page.addInitScript(() => {
    window.__spoken = [];
    const fake = {
      speak: (u) => { window.__spoken.push({ text: u.text, lang: u.lang }); if (u.onend) setTimeout(u.onend, 10); },
      cancel: () => {},
      getVoices: () => [],
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  });
}

const EXPECTED = [
  ['さすが！', 'sa-su-ga!', '"Impressive!"', 'Best cosplay'],
  ['知らなかった！', 'shi-ra-na-kat-ta!', '"I didn\'t know that!"', 'Behind the scenes'],
  ['すごい！', 'su-go-i!', '"Amazing!"', 'Transformation'],
  ['センスいいね！', 'sen-su ii ne!', '"Great taste!"', 'Outfit details'],
  ['そうなんだ！', 'sō nan da!', '"Oh, really? I see!"', 'Event vlogs'],
];

for (const pageName of ['index.html', 'reels.html']) {
  test(`reel cards on ${pageName} show Japanese / romaji / English / category`, async ({ page }) => {
    await stubSpeech(page);
    await page.goto(pageName);
    const cards = page.locator('.reel-card');
    await expect(cards).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      const card = cards.nth(i);
      // Japanese text without the furigana (<rt>) readings.
      const jp = await card.locator('.pron-jp').evaluate((el) => {
        const copy = el.cloneNode(true);
        copy.querySelectorAll('rt').forEach((rt) => rt.remove());
        return copy.textContent;
      });
      expect(jp).toBe(EXPECTED[i][0]);
      await expect(card.locator('.pron-romaji')).toHaveText(EXPECTED[i][1]);
      await expect(card.locator('.pron-en')).toHaveText(EXPECTED[i][2]);
      await expect(card.locator('.reel-cat')).toHaveText(EXPECTED[i][3]);
      await expect(card.locator('.pron-jp')).toHaveAttribute('lang', 'ja');
    }
    await expect(cards.nth(1).locator('ruby')).toHaveText(/知\s*し/);
    await expect(cards.nth(1).locator('rt')).toHaveText('し');
    await expect(cards.nth(0).locator('.kana-badge')).toContainText('さ');
    await expect(cards.nth(0).locator('.kana-badge')).toContainText('sa');

    const header = page.locator('.reels-sign');
    await expect(header.locator('.pron-jp')).toHaveText('さしすせそ');
    await expect(header.locator('.pron-romaji')).toHaveText('sa · shi · su · se · so');
    await expect(page.locator('.reels-subtitle')).toHaveText('Five reels, five reactions. Tap one to watch on Instagram.');
  });
}

test('speaker buttons speak Japanese with lang ja-JP and do not follow links', async ({ page }) => {
  await stubSpeech(page);
  await page.goto('reels.html');
  const speaker = page.locator('.reel-card').nth(1).locator('.speaker');
  await expect(speaker).toHaveAttribute('aria-label', 'Play pronunciation: shi-ra-na-kat-ta!');
  await speaker.click();
  await page.getByRole('button', { name: /Sound on/ }).click();
  const spoken = await page.evaluate(() => window.__spoken);
  expect(spoken[0]).toEqual({ text: '知らなかった！', lang: 'ja-JP' });
  expect(spoken[1].lang).toBe('ja-JP');
  await expect(page).toHaveURL(/reels\.html$/);
});

test('no speaker buttons when speech is not supported', async ({ page }) => {
  await page.addInitScript(() => { delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; });
  await page.goto('reels.html');
  await expect(page.locator('.reel-card')).toHaveCount(5);
  await expect(page.locator('.speaker')).toHaveCount(0);
});

test('cards without a URL say Coming soon and are not links; cards with a URL open in a new tab', async ({ page }) => {
  await page.route('**/data/reels.json', async (route) => {
    const res = await route.fetch();
    const data = await res.json();
    data.reels[0].url = 'https://www.instagram.com/reel/TEST/';
    await route.fulfill({ response: res, json: data });
  });
  await page.goto('reels.html');
  const first = page.locator('.reel-card').nth(0).locator('a.reel-cover');
  await expect(first).toHaveAttribute('href', 'https://www.instagram.com/reel/TEST/');
  await expect(first).toHaveAttribute('rel', 'noopener');
  const second = page.locator('.reel-card').nth(1);
  await expect(second.locator('a')).toHaveCount(0);
  await expect(second).toContainText('Coming soon');
});

test('PC shows 5 cards in one row; phone is a swipe carousel with dots', async ({ page }) => {
  await page.goto('reels.html');
  const tops = await page.locator('.reel-card').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  if (!isPhone(page)) {
    expect(new Set(tops).size).toBe(1);
    await expect(page.locator('.reel-dots')).toBeHidden();
    return;
  }
  await expect(page.locator('.reel-dot')).toHaveCount(5);
  await expect(page.locator('.reel-dot').first()).toHaveAttribute('aria-current', 'true');
  await page.locator('.reel-dot').nth(3).click();
  await expect(page.locator('.reel-dot').nth(3)).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => page.locator('.reel-track').evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
});
