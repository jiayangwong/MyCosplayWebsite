// Page script for reels.html (moved out of the HTML so the page CSP needs no 'unsafe-inline', TASK-30).
import { mountChrome } from './nav.js';
import { mountReels } from './reels.js';
mountChrome('reels');
mountReels(document.getElementById('reels-mount'));
