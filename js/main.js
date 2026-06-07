/* =====================================================================
   main.js — navigation toggle, Vimeo random-start, miscellaneous
   ===================================================================== */

(function () {
  // ---- Mobile nav toggle ----
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.nav');
    const btn = document.querySelector('.nav-toggle');
    if (btn && nav) {
      btn.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      });
      // Close nav when a link inside is clicked (mobile)
      nav.querySelectorAll('.nav-links a').forEach(a => {
        a.addEventListener('click', () => {
          nav.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // ---- Vimeo random-start ----
    // Any iframe with data-vimeo-random gets a randomized #t= start.
    // Drew sets data-vimeo-id="..." and data-vimeo-duration="180" (seconds).
    document.querySelectorAll('[data-vimeo-random]').forEach(iframe => {
      const id  = iframe.dataset.vimeoId;
      const dur = parseInt(iframe.dataset.vimeoDuration, 10) || 180;
      if (!id || id === 'REPLACE_WITH_ID') {
        // Leave src blank until a real ID is set; show poster background.
        iframe.removeAttribute('src');
        iframe.setAttribute('title', 'Video placeholder — add a Vimeo ID');
        return;
      }
      const start = Math.floor(Math.random() * Math.max(dur - 30, 1));
      iframe.src =
        `https://player.vimeo.com/video/${id}?loop=1&muted=1#t=${start}s`;
    });
  });
})();
