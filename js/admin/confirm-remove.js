// The "Remove this photo?" dialog (TASK-23), shared by the uploader's X button and the photo slots' X (TASK-27).
const $ = (id) => document.getElementById(id);

/** Shows the dialog with this text. Resolves true on "Remove", false on Cancel or Esc. */
export function askRemove(text) {
  const dialog = $('wm-remove-confirm');
  $('wm-remove-text').textContent = text;
  return new Promise((resolve) => {
    const yes = $('wm-remove-yes');
    const no = $('wm-remove-no');
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
      if (dialog.open) dialog.close();
      resolve(ok);
    };
    const onYes = () => finish(true);
    const onNo = () => finish(false);
    const onCancel = (e) => { e.preventDefault(); finish(false); };
    const onClose = () => finish(false);
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
    no.focus(); // the safe choice
  });
}
