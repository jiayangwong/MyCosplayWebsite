// Page script for contact.html (moved out of the HTML so the page CSP needs no 'unsafe-inline', TASK-30).
import { mountChrome } from './nav.js';
import { SITE } from './site-config.js';
mountChrome('contact');
const email = document.getElementById('contact-email');
email.href = `mailto:${SITE.email}`;
email.textContent = SITE.emailIsPlaceholder ? 'Email [email placeholder]' : `Email ${SITE.email}`;
if (SITE.emailIsPlaceholder) document.getElementById('contact-email-note').textContent = 'Real address coming soon.';
const socials = document.getElementById('contact-socials');
for (const s of SITE.socials) {
  const a = document.createElement('a');
  a.className = 'btn btn-secondary btn-sm';
  a.href = s.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = s.label;
  socials.append(a);
}
