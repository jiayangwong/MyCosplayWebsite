// Shared page chrome: header with tabs (PC), MENU + full-screen menu (phone), and footer.
// Every public page calls mountChrome('<tab id>') once.
import { SITE } from './site-config.js';

const ROOT = new URL('../', import.meta.url);

export const TABS = [
  { id: 'home', label: 'HOME', href: 'index.html', sub: 'Walk the hall' },
  { id: 'gallery', label: 'GALLERY', href: 'gallery.html', sub: 'Cosplay photos' },
  { id: 'reels', label: 'REELS', href: 'reels.html', subJa: 'さしすせそ', sub: 'sa shi su se so' },
  { id: 'events', label: 'EVENTS', href: 'events.html', sub: 'Meet me at the con' },
  { id: 'about', label: 'ABOUT', href: 'about.html', sub: 'Who is Puzz' },
  { id: 'contact', label: 'CONTACT', href: 'contact.html', sub: 'Collabs & bookings' },
];

export function siteUrl(path) {
  return new URL(path, ROOT).href;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

const ICONS = {
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  arrow: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  instagram: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  external: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
};

export function icon(name) {
  const span = el('span', { class: 'icon' });
  span.innerHTML = ICONS[name];
  return span;
}

function externalLink(label, url, className) {
  return el('a', { href: url, target: '_blank', rel: 'noopener', class: className }, [label]);
}

function buildHeader(activeId) {
  const tabs = el('nav', { class: 'tabs', 'aria-label': 'Main navigation' }, TABS.map((tab) =>
    el('a', {
      href: siteUrl(tab.href),
      class: 'tab',
      'aria-current': tab.id === activeId ? 'page' : null,
    }, [tab.label])
  ));

  const insta = el('a', {
    href: SITE.instagram, target: '_blank', rel: 'noopener', class: 'btn btn-secondary btn-sm header-insta',
  }, [icon('instagram'), 'Instagram']);

  const menuButton = el('button', {
    type: 'button', class: 'btn btn-secondary btn-sm menu-button',
    'aria-expanded': 'false', 'aria-controls': 'site-menu',
  }, ['MENU', icon('menu')]);

  const header = el('header', { class: 'site-header' }, [
    el('div', { class: 'site-header-inner' }, [
      el('a', { href: siteUrl('index.html'), class: 'wordmark', 'aria-label': `${SITE.name} home` }, [SITE.wordmark]),
      tabs,
      insta,
      menuButton,
    ]),
  ]);
  return { header, menuButton };
}

function buildMenu(activeId) {
  const closeButton = el('button', {
    type: 'button', class: 'menu-close', 'aria-label': 'Close menu',
  }, [icon('close')]);

  const links = TABS.map((tab) => {
    const sub = el('span', { class: 'menu-sub' });
    if (tab.subJa) {
      sub.append(el('span', { lang: 'ja', text: tab.subJa }), ` · ${tab.sub}`);
    } else {
      sub.textContent = tab.sub;
    }
    return el('a', {
      href: siteUrl(tab.href), class: 'menu-link', 'aria-current': tab.id === activeId ? 'page' : null,
    }, [el('span', { class: 'menu-text' }, [el('span', { class: 'menu-label', text: tab.label }), sub]), icon('arrow')]);
  });

  const socials = el('div', { class: 'menu-socials' }, [
    el('p', { class: 'menu-follow', text: 'FOLLOW' }),
    el('div', { class: 'menu-social-row' }, SITE.socials.map((s) => externalLink(s.label, s.url, 'btn btn-on-dark btn-sm'))),
  ]);

  const dialog = el('dialog', { id: 'site-menu', class: 'site-menu', 'aria-label': 'Navigation menu' }, [
    el('div', { class: 'lace-edge', 'aria-hidden': 'true' }),
    el('div', { class: 'menu-top' }, [
      el('a', { href: siteUrl('index.html'), class: 'wordmark wordmark-on-dark', text: SITE.wordmark }),
      closeButton,
    ]),
    el('nav', { class: 'menu-nav', 'aria-label': 'Menu' }, links),
    socials,
  ]);
  return { dialog, closeButton };
}

function buildFooter() {
  const year = new Date().getFullYear();
  return el('footer', { class: 'site-footer' }, [
    el('div', { class: 'truss', 'aria-hidden': 'true' }),
    el('div', { class: 'site-footer-inner' }, [
      el('p', { class: 'footer-mark', text: SITE.wordmark }),
      el('ul', { class: 'footer-socials' }, SITE.socials.map((s) => el('li', {}, [externalLink(s.label, s.url, 'footer-link')]))),
      el('p', { class: 'footer-note', text: 'Photos watermarked. Please ask before reposting.' }),
      el('p', { class: 'footer-copy', text: `© ${year} ${SITE.name}` }),
    ]),
  ]);
}

function wireMenu(dialog, menuButton, closeButton) {
  const open = () => {
    dialog.showModal();
    menuButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    closeButton.focus();
  };
  const close = () => {
    if (dialog.open) dialog.close();
  };
  menuButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('close', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    menuButton.focus();
  });
  dialog.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  // The menu only exists on phone layouts; close it if the window grows to desktop width.
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) close(); });
}

export function mountChrome(activeId) {
  const skip = el('a', { href: '#main', class: 'skip-link', text: 'Skip to content' });
  const { header, menuButton } = buildHeader(activeId);
  const { dialog, closeButton } = buildMenu(activeId);
  document.body.prepend(skip, header, dialog);
  document.body.append(buildFooter());
  wireMenu(dialog, menuButton, closeButton);
}
