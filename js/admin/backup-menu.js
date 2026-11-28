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
  // Tab out of the menu: close it so it does not cover the next panel (no focus move).
  menu.addEventListener('focusout', (e) => {
    if (menu.open && e.relatedTarget && !menu.contains(e.relatedTarget)) close(false);
  });
  document.addEventListener('click', (e) => {
    if (menu.open && !menu.contains(e.target)) close(false);
  });
  // Close at once; focus a moment later, after the browser has finished the click / download / file dialog.
  // BUG-25: only if focus is still in the menu or nowhere; if the person has moved on, leave it there.
  document.addEventListener('backup:done', () => {
    close(false);
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body || menu.contains(active)) summary.focus();
    }, 50);
  });
}
