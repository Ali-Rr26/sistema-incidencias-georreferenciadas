/**
 * Vanilla JS replacements for Freedash jQuery scripts.
 * Sin jQuery — querySelector, classList, y eventos nativos.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {

    // =============================================
    // Feather Icons — reemplazar [data-feather]
    // =============================================
    if (typeof feather !== 'undefined') {
      feather.replace();
    }

    // =============================================
    // Sidebar toggle (mobile)
    // =============================================
    const navToggler = document.querySelector('.nav-toggler');
    if (navToggler) {
      navToggler.addEventListener('click', function () {
        document.getElementById('main-wrapper')?.classList.toggle('show-sidebar');
        const icon = this.querySelector('i');
        if (icon) {
          icon.classList.toggle('ti-menu');
          icon.classList.toggle('ti-close');
        }
      });
    }

    // =============================================
    // Sidebar submenu collapse (has-arrow)
    // =============================================
    document.querySelectorAll('#sidebarnav > li > a.has-arrow').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const parent = this.parentElement;
        const ul = this.nextElementSibling;

        // Cerrar otros submenús abiertos en el mismo nivel
        const siblings = parent.closest('ul')?.querySelectorAll('li > a.has-arrow');
        siblings?.forEach(function (sib) {
          if (sib !== link) {
            sib.classList.remove('active');
            const sibUl = sib.nextElementSibling;
            if (sibUl) sibUl.classList.remove('in');
          }
        });

        // Toggle este submenú
        this.classList.toggle('active');
        if (ul) ul.classList.toggle('in');
      });
    });

    // =============================================
    // Tooltips y Popovers Bootstrap (si no los activa BS JS solo)
    // =============================================
    const tooltipTriggers = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    if (tooltipTriggers.length && typeof bootstrap !== 'undefined') {
      tooltipTriggers.forEach(function (el) {
        new bootstrap.Tooltip(el);
      });
    }

    const popoverTriggers = document.querySelectorAll('[data-bs-toggle="popover"]');
    if (popoverTriggers.length && typeof bootstrap !== 'undefined') {
      popoverTriggers.forEach(function (el) {
        new bootstrap.Popover(el);
      });
    }

    // =============================================
    // Preloader fade out (si existe)
    // =============================================
    const preloader = document.querySelector('.preloader');
    if (preloader) {
      preloader.style.transition = 'opacity 0.3s ease';
      preloader.style.opacity = '0';
      setTimeout(function () {
        preloader.style.display = 'none';
      }, 300);
    }

  });
})();
