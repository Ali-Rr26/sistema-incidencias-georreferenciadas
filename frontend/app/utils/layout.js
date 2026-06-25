/**
 * initLayout — re-runs Freedash layout setup after each component mount.
 *
 * Freedash CSS hides .page-wrapper by default (display:none) and relies on
 * jQuery to show it. Since we have no jQuery, we do it here via vanilla JS.
 * Must be called after outlet.innerHTML is set, before onInit runs.
 */
export function initLayout() {
  // Show page-wrapper (hidden by default in freedash-layout.css)
  const pageWrapper = document.querySelector('.page-wrapper');
  if (pageWrapper) pageWrapper.style.display = 'block';

  // Sidebar toggle (hamburger — mobile)
  const navToggler = document.querySelector('.nav-toggler');
  if (navToggler) {
    const fresh = navToggler.cloneNode(true);
    navToggler.parentNode.replaceChild(fresh, navToggler);
    fresh.addEventListener('click', () => {
      const wrapper = document.getElementById('main-wrapper');
      wrapper?.classList.toggle('show-sidebar');
      const icon = fresh.querySelector('i');
      if (icon) {
        icon.classList.toggle('ti-menu');
        icon.classList.toggle('ti-close');
      }
    });
  }

  // Sidebar overlay — close on click (mobile)
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    const fresh = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(fresh, overlay);
    fresh.addEventListener('click', () => {
      document.getElementById('main-wrapper')?.classList.remove('show-sidebar');
    });
  }

  // Accordion submenus (has-arrow links)
  document.querySelectorAll('#sidebarnav > li > a.has-arrow').forEach(link => {
    const fresh = link.cloneNode(true);
    link.parentNode.replaceChild(fresh, link);
    fresh.addEventListener('click', e => {
      e.preventDefault();
      const ul = fresh.nextElementSibling;
      const isOpen = fresh.classList.contains('active');

      // Close all siblings
      fresh.closest('ul')?.querySelectorAll('li > a.has-arrow').forEach(sib => {
        if (sib !== fresh) {
          sib.classList.remove('active');
          sib.nextElementSibling?.classList.remove('in');
        }
      });

      fresh.classList.toggle('active', !isOpen);
      ul?.classList.toggle('in', !isOpen);
    });
  });

  // Bootstrap tooltips
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    if (typeof bootstrap !== 'undefined') {
      // Prevent duplicate tooltips on re-mount
      const tip = bootstrap.Tooltip.getInstance(el);
      if (tip) tip.dispose();
      new bootstrap.Tooltip(el);
    }
  });

  // Bootstrap popovers
  document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
    if (typeof bootstrap !== 'undefined') {
      const pop = bootstrap.Popover.getInstance(el);
      if (pop) pop.dispose();
      new bootstrap.Popover(el);
    }
  });

  // Preloader fade out
  const preloader = document.querySelector('.preloader');
  if (preloader) {
    preloader.style.transition = 'opacity 0.3s ease';
    preloader.style.opacity = '0';
    setTimeout(() => { preloader.style.display = 'none'; }, 300);
  }

  // Feather icons — replace [data-feather] attributes with SVGs
  if (window.feather) window.feather.replace();
}
