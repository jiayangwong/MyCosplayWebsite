// Events page: years newest first, a year jump row, and one card per event.
import { loadEvents, groupByYear, formatDate } from './events-data.js';
import { renderMedia } from './embed.js';
import { siteUrl } from './nav.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function eventCard(event) {
  const card = make('article', 'event-card');
  card.id = event.id;
  card.setAttribute('aria-labelledby', `${event.id}-title`);

  card.append(renderMedia({
    link: event.link,
    photo: event.photo ? siteUrl(event.photo) : '',
    alt: `${event.name} ${event.date.slice(0, 4)}`,
    placeholder: `${event.short} · photo coming soon`,
    title: event.name,
  }));

  const body = make('div', 'event-body');
  const tags = make('div', 'event-tags');
  tags.append(make('span', 'tag tag-short', event.short));
  if (event.sample) tags.append(make('span', 'tag tag-sample', 'Sample'));
  body.append(tags);

  const title = make('h3', 'event-name', event.name);
  title.id = `${event.id}-title`;
  body.append(title);

  const meta = make('p', 'event-meta');
  const time = make('time', '', formatDate(event.date));
  time.dateTime = event.date;
  meta.append(time);
  if (event.venue) meta.append(` · ${event.venue}`);
  body.append(meta);

  if (event.activities && event.activities.length) {
    const list = make('ul', 'event-activities');
    list.setAttribute('aria-label', 'Activities');
    event.activities.forEach((a) => list.append(make('li', '', a)));
    body.append(list);
  }
  card.append(body);
  return card;
}

export async function mountEventsPage(root) {
  const events = await loadEvents();
  if (!events.length) {
    root.append(make('p', 'empty-state', 'Events coming soon.'));
    return;
  }
  const groups = groupByYear(events);

  const jump = make('nav', 'year-jump');
  jump.setAttribute('aria-label', 'Jump to year');
  groups.forEach((g) => {
    const a = make('a', 'btn btn-secondary btn-sm', String(g.year));
    a.href = `#y-${g.year}`;
    jump.append(a);
  });
  root.append(jump);

  for (const group of groups) {
    const section = make('section', 'year-group');
    section.id = `y-${group.year}`;
    section.setAttribute('aria-labelledby', `y-${group.year}-h`);
    const h2 = make('h2', 'year-heading');
    h2.id = `y-${group.year}-h`;
    h2.append(make('span', 'year-heading-num', String(group.year)));
    h2.append(make('span', 'year-heading-count', `${group.events.length} event${group.events.length === 1 ? '' : 's'}`));
    section.append(h2);
    const grid = make('div', 'event-grid');
    group.events.forEach((e) => grid.append(eventCard(e)));
    section.append(grid);
    root.append(section);
  }

  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ block: 'start' });
  }
}
