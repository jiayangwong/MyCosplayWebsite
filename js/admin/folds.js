// Collapsible GitHub and Publish panels in /admin/ (layout from the approved storyboard).
// The panels' own scripts keep working: this file only opens/closes the body and mirrors a short status chip.
// It reads the status boxes already on the page and never touches the token. All text is set with textContent.
const $ = (id) => document.getElementById(id);

function fold(btn, open) {
  const body = $(btn.getAttribute('aria-controls'));
  if (!body) return;
  body.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}

const GH_CHIP = { none: 'Not connected', saved: 'Token saved', testing: 'Testing...', ok: 'Connected', err: 'Error' };

function syncGithub() {
  const btn = document.querySelector('#gh-panel .fold-btn');
  const box = $('gh-alert').hidden ? $('gh-status') : $('gh-alert');
  const state = box.dataset.state || 'none';
  const chip = $('gh-chip');
  chip.textContent = GH_CHIP[state] || state;
  chip.dataset.s = state;
  // No token or an error: open the panel so the next step is visible.
  if (state === 'none' || state === 'err') fold(btn, true);
}

function syncPublish() {
  const btn = document.querySelector('#publish-panel .fold-btn');
  const items = $('pub-pending').querySelectorAll('li');
  const empty = items.length === 0 || (items.length === 1 && !items[0].querySelector('button') && /^No pending/.test(items[0].textContent));
  const n = empty ? 0 : items.length;
  $('pub-chip').textContent = n ? `${n} pending` : 'Nothing pending';
  if (n) fold(btn, true);
}

function init() {
  if (!$('gh-panel') || !$('publish-panel')) return;
  // The whole header row (title, chip, arrow) toggles; the button stays the keyboard control.
  document.querySelectorAll('.fold-head').forEach((head) => {
    const btn = head.querySelector('.fold-btn');
    head.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      fold(btn, btn.getAttribute('aria-expanded') !== 'true');
    });
  });
  const watch = (el, opts, fn) => new MutationObserver(fn).observe(el, opts);
  watch($('gh-status'), { attributes: true, childList: true, subtree: true, attributeFilter: ['hidden', 'data-state'] }, syncGithub);
  watch($('gh-alert'), { attributes: true, childList: true, subtree: true, attributeFilter: ['hidden', 'data-state'] }, syncGithub);
  watch($('pub-pending'), { childList: true, subtree: true, characterData: true }, syncPublish);
  syncGithub();
  syncPublish();
}

init();
