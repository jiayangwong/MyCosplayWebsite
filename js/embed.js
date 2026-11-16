// Turn a social link into an embeddable player, behind a click-to-load facade (no third-party
// requests until the visitor asks). Unknown platforms fall back to a preview photo + external link.

const LABELS = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' };

function siteName(host) {
  if (/(^|\.)facebook\.com$|(^|\.)fb\.watch$/.test(host)) return 'Facebook';
  if (/(^|\.)x\.com$|(^|\.)twitter\.com$/.test(host)) return 'X';
  if (/(^|\.)threads\.net$/.test(host)) return 'Threads';
  return host.replace(/^www\./, '');
}

/** Returns { platform, embedUrl, label }. platform is youtube | instagram | tiktok | link | none. */
export function detectEmbed(link) {
  if (!link) return { platform: 'none', embedUrl: null, label: '' };
  let url;
  try {
    url = new URL(link);
  } catch {
    return { platform: 'none', embedUrl: null, label: '' };
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') {
    let id = null;
    if (host === 'youtu.be') id = parts[0];
    else if (url.searchParams.get('v')) id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1];
    if (id && /^[\w-]{6,}$/.test(id)) {
      return { platform: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, label: LABELS.youtube };
    }
  }

  if (/(^|\.)instagram\.com$/.test(host)) {
    const kind = parts[0] === 'reels' ? 'reel' : parts[0];
    if (['p', 'reel', 'tv'].includes(kind) && parts[1]) {
      const path = kind === 'tv' ? 'p' : kind;
      return { platform: 'instagram', embedUrl: `https://www.instagram.com/${path}/${parts[1]}/embed`, label: LABELS.instagram };
    }
  }

  if (/(^|\.)tiktok\.com$/.test(host)) {
    const i = parts.indexOf('video');
    if (i >= 0 && /^\d+$/.test(parts[i + 1] || '')) {
      return { platform: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${parts[i + 1]}`, label: LABELS.tiktok };
    }
  }

  return { platform: 'link', embedUrl: null, label: siteName(host) };
}

const PLAY_ICON = '<svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M10 8l6 4-6 4z" fill="var(--color-surface)"/></svg>';

function placeholderBox(text) {
  const box = document.createElement('div');
  box.className = 'media-placeholder';
  box.textContent = text;
  return box;
}

function photoOrPlaceholder({ photo, alt, placeholder }) {
  if (photo) {
    const img = document.createElement('img');
    img.src = photo;
    img.alt = alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    // A photo path that is not in the repo yet shows the placeholder instead of a broken image.
    img.addEventListener('error', () => img.replaceWith(placeholderBox(placeholder || 'Photo coming soon')), { once: true });
    return img;
  }
  return placeholderBox(placeholder || 'Photo coming soon');
}

/**
 * Builds the media block for an event: facade -> iframe for known video platforms,
 * photo + external link for other links, or a neutral placeholder.
 */
export function renderMedia({ link, photo, alt, placeholder, title }) {
  const wrap = document.createElement('div');
  wrap.className = 'media';
  const embed = detectEmbed(link);

  if (embed.embedUrl) {
    const facade = document.createElement('button');
    facade.type = 'button';
    facade.className = 'media-facade';
    facade.append(photoOrPlaceholder({ photo, alt: '', placeholder }));
    const overlay = document.createElement('span');
    overlay.className = 'media-play';
    overlay.innerHTML = PLAY_ICON;
    const label = document.createElement('span');
    label.className = 'media-play-label';
    label.textContent = `Load video from ${embed.label}`;
    overlay.append(label);
    facade.append(overlay);
    facade.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = embed.embedUrl;
      frame.title = title ? `${title} (${embed.label})` : `${embed.label} video`;
      frame.loading = 'lazy';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share';
      frame.allowFullscreen = true;
      frame.className = `media-frame media-frame-${embed.platform}`;
      facade.replaceWith(frame);
    });
    wrap.append(facade);
    wrap.dataset.platform = embed.platform;
    return wrap;
  }

  wrap.append(photoOrPlaceholder({ photo, alt, placeholder }));
  if (embed.platform === 'link') {
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'media-link';
    a.textContent = `Open on ${embed.label}`;
    wrap.append(a);
  }
  wrap.dataset.platform = embed.platform;
  return wrap;
}
