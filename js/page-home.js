// Page script for index.html (moved out of the HTML so the page CSP needs no 'unsafe-inline', TASK-30).
import { mountChrome } from './nav.js';
import { mountHall } from './hall.js';
import { mountReels } from './reels.js';
import { mountPortrait } from './portrait.js';

mountChrome('home');
mountPortrait(document.querySelector('.pass-photo'));
mountHall({
  hallList: document.getElementById('hall-list'),
  timelineSlot: document.getElementById('timeline-slot'),
  summary: document.getElementById('hall-summary'),
});
mountReels(document.getElementById('reels-mount'));
