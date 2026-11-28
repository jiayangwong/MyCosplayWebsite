// Page script for events.html (moved out of the HTML so the page CSP needs no 'unsafe-inline', TASK-30).
import { mountChrome } from './nav.js';
import { mountEventsPage } from './events-page.js';
mountChrome('events');
mountEventsPage(document.getElementById('events-root'));
