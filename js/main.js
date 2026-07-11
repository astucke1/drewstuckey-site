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

    // ---- YouTube thumbnail fallback ----
    // Tile thumbnails and titles are hardcoded in the HTML. Neither Vimeo's nor
    // YouTube's oEmbed endpoint sends CORS headers, so they can't be fetched
    // from the browser — don't reintroduce that.
    //
    // The one thing worth doing at runtime: maxresdefault.jpg doesn't exist for
    // every upload, and YouTube answers with a 120x90 grey placeholder instead
    // of a 404. This is a plain image load, not a cross-origin fetch, so it is
    // allowed. Probe the image and downgrade to hqdefault (always present).
    document.querySelectorAll('[data-youtube-tile]').forEach(tile => {
      const id  = tile.dataset.youtubeId;
      const img = tile.querySelector('.film-img');
      if (!id || !img) return;

      const probe = new Image();
      probe.onload = () => {
        if (probe.naturalWidth <= 120) {
          img.style.background =
            `url('https://i.ytimg.com/vi/${id}/hqdefault.jpg') center/cover`;
        }
      };
      probe.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    });
  });
})();
