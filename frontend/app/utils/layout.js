/**
 * initShell — runs ONCE when the app shell (navbar + sidebar) is first shown.
 * Wires persistent UI interactions that live in index.html.
 *
 * initPage — runs on every route change inside the shell.
 * Re-initialises Bootstrap widgets and Feather icons for newly mounted content.
 */

export function initShell() {
  const pageWrapper = document.querySelector('.page-wrapper');
  if (pageWrapper) pageWrapper.style.display = 'block';

  const navToggler = document.querySelector('.nav-toggler');
  if (navToggler) {
    navToggler.addEventListener('click', () => {
      const wrapper = document.getElementById('main-wrapper');
      wrapper?.classList.toggle('show-sidebar');
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
      document.getElementById('main-wrapper')?.classList.remove('show-sidebar');
    });
  }

  document.querySelectorAll('#sidebarnav > li > a.has-arrow').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const ul = link.nextElementSibling;
      const isOpen = link.classList.contains('active');
      link.closest('ul')?.querySelectorAll('li > a.has-arrow').forEach(sib => {
        if (sib !== link) {
          sib.classList.remove('active');
          sib.nextElementSibling?.classList.remove('in');
        }
      });
      link.classList.toggle('active', !isOpen);
      ul?.classList.toggle('in', !isOpen);
    });
  });

  if (window.feather) window.feather.replace();
}

export function initPage() {
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    if (typeof bootstrap !== 'undefined') {
      bootstrap.Tooltip.getInstance(el)?.dispose();
      new bootstrap.Tooltip(el);
    }
  });

  document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
    if (typeof bootstrap !== 'undefined') {
      bootstrap.Popover.getInstance(el)?.dispose();
      new bootstrap.Popover(el);
    }
  });

  if (window.feather) window.feather.replace();
}

/** Backwards-compat alias used by any code that still imports initLayout. */
export function initLayout() {
  initShell();
  initPage();
}
