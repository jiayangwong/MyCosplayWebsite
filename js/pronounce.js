// Pronunciation pattern used for every Japanese word on the site:
//   line 1 Japanese (furigana over kanji via <ruby>), line 2 romaji, line 3 English, + speaker button.
// Japanese source text marks furigana as {kanji|reading}, e.g. "{知|し}らなかった！".

const RUBY = /\{([^|{}]+)\|([^|{}]+)\}/g;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** "{知|し}らなかった" -> '<ruby>知<rt>し</rt></ruby>らなかった' (HTML-escaped). */
export function rubyHtml(text) {
  return escapeHtml(text).replace(RUBY, '<ruby>$1<rt>$2</rt></ruby>');
}

/** "{知|し}らなかった" -> "知らなかった" (what the speech engine reads). */
export function plainJapanese(text) {
  return String(text).replace(RUBY, '$1');
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function japaneseVoice() {
  const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
  return voices.find((v) => /^ja(-|_|$)/i.test(v.lang)) || null;
}

/** Speaks Japanese text. Marks `button` as playing until speech ends. */
export function speak(text, button) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(plainJapanese(text));
  utterance.lang = 'ja-JP';
  utterance.rate = 0.85;
  const voice = japaneseVoice();
  if (voice) utterance.voice = voice;
  if (button) {
    button.classList.add('is-playing');
    const done = () => button.classList.remove('is-playing');
    utterance.onend = done;
    utterance.onerror = done;
    setTimeout(done, 4000);
  }
  synth.speak(utterance);
}

const SPEAKER_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>';

/** Speaker button, or null when the browser cannot speak. */
export function speakerButton(jp, romaji) {
  if (!canSpeak()) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'speaker';
  button.setAttribute('aria-label', `Play pronunciation: ${romaji}`);
  button.innerHTML = SPEAKER_ICON;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    speak(jp, button);
  });
  return button;
}

/**
 * Builds the pronunciation block.
 * options.tag: element for the Japanese line (default 'p'); options.className: extra class.
 */
export function pronunciationBlock({ jp, romaji, en }, options = {}) {
  const block = document.createElement('div');
  block.className = `pron ${options.className || ''}`.trim();

  const top = document.createElement('div');
  top.className = 'pron-top';
  const ja = document.createElement(options.tag || 'p');
  ja.className = 'pron-jp';
  ja.lang = 'ja';
  ja.innerHTML = rubyHtml(jp);
  top.append(ja);
  const button = speakerButton(jp, romaji);
  if (button) top.append(button);

  const ro = document.createElement('p');
  ro.className = 'pron-romaji';
  ro.textContent = romaji;

  const meaning = document.createElement('p');
  meaning.className = 'pron-en';
  meaning.textContent = `"${en}"`;

  block.append(top, ro, meaning);
  return block;
}

/** Upgrades static markup: <span data-pron data-jp=".." data-romaji=".." data-en=".."></span> */
export function enhancePronunciation(root = document) {
  root.querySelectorAll('[data-pron]').forEach((node) => {
    const block = pronunciationBlock(
      { jp: node.dataset.jp, romaji: node.dataset.romaji, en: node.dataset.en },
      { tag: node.dataset.tag || 'p', className: node.dataset.class || '' }
    );
    node.replaceWith(block);
  });
}
