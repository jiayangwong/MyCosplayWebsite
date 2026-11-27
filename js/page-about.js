// Page script for about.html (moved out of the HTML so the page CSP needs no 'unsafe-inline', TASK-30).
import { mountChrome } from './nav.js';
import { mountPortrait } from './portrait.js';
mountChrome('about');
mountPortrait(document.querySelector('.portrait'));
