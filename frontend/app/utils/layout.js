/**
 * initShell — wires the admin shell's persistent UI interactions:
 *   - nav-toggler click → toggle sidebar
 *   - sidebar-overlay click → close sidebar
 *
 * Called once when the admin shell is first shown (via adminShell.init()).
 * Sidebar active state is handled by the router via updateActive().
 *
 * initPage — runs on every route change inside the shell.
 * Re-initialises Bootstrap widgets for newly mounted content.
 */

export function initShell() {
  // The admin shell template has `style="display: none"` on #main-wrapper
  // to hide it before JS is ready. Unhide it now that we're initializing.
  const mainWrapper = document.getElementById('main-wrapper');
  if (mainWrapper) mainWrapper.style.display = '';

  const pageWrapper = document.querySelector('.page-wrapper');
  if (pageWrapper) pageWrapper.style.display = 'block';

  const navToggler = document.querySelector('.nav-toggler');
  if (navToggler) {
    navToggler.addEventListener('click', () => {
      mainWrapper?.classList.toggle('show-sidebar');
      const icon = navToggler.querySelector('i');
      if (icon) {
        icon.classList.toggle('ti-menu');
        icon.classList.toggle('ti-close');
      }
    });
  }

  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      mainWrapper?.classList.remove('show-sidebar');
    });
  }
}

export function initPage() {
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
    if (typeof bootstrap !== 'undefined') {
      bootstrap.Tooltip.getInstance(el)?.dispose();
      new bootstrap.Tooltip(el);
    }
  });

  document.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => {
    if (typeof bootstrap !== 'undefined') {
      bootstrap.Popover.getInstance(el)?.dispose();
      new bootstrap.Popover(el);
    }
  });
}

/** Backwards-compat alias used by any code that still imports initLayout. */
export function initLayout() {
  initShell();
  initPage();
}
