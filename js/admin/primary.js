// TASK-36: the one-pink-button rule. Exactly one visible .btn-accent on the admin page: Publish while it is
// enabled, otherwise New event. This is the only script that sets these classes.
const publish = document.getElementById('publish-btn');
const newEvent = document.getElementById('new-event');

function apply() {
  const publishOn = !publish.disabled;
  publish.classList.toggle('btn-accent', publishOn);
  publish.classList.toggle('btn-secondary', !publishOn);
  newEvent.classList.toggle('btn-accent', !publishOn);
  newEvent.classList.toggle('btn-secondary', publishOn);
}

if (publish && newEvent) {
  new MutationObserver(apply).observe(publish, { attributes: true, attributeFilter: ['disabled'] });
  apply();
}
