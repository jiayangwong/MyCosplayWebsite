// Page script for gallery.html (moved out of the HTML so the page CSP needs no 'unsafe-inline', TASK-30).
import { mountChrome } from './nav.js';
import { mountGallery } from './gallery.js';
mountChrome('gallery');
mountGallery(document.getElementById('gallery-root'));
