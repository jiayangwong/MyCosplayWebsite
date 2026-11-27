// TASK-36: the Backup menu (a <details> disclosure). Esc closes it and puts focus on the summary, a click
// outside closes it, and manager.js sends "backup:done" when Export / Import / Discard ended.
const menu = document.getElementById('backup-menu');

if (menu) {
  const summary = menu.querySelector('summary');
  const close = (focus) => {
    if (!menu.open) return;
    menu.open = false;
    if (focus) summary.focus();
  };
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) { e.preventDefault(); close(true); }
  });
  document.addEventListener('click', (e) => {
    if (menu.open && !menu.contains(e.target)) close(false);
  });
  // Close at once; focus a moment later, after the browser has finished the click / download / file dialog.
  document.addEventListener('backup:done', () => {
    close(false);
    setTimeout(() => summary.focus(), 50);
  });
}
