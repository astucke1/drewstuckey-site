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

    // ---- Vimeo tile auto-fill ----
    // Any .film-tile with data-vimeo-tile + data-vimeo-id pulls its thumbnail
    // and title from Vimeo's oEmbed endpoint. Anything already written into
    // .film-title / .film-tag by hand is left alone (hand-written wins).
    document.querySelectorAll('[data-vimeo-tile]').forEach(async tile => {
      const id = tile.dataset.vimeoId;
      if (!id) return;

      const img   = tile.querySelector('.film-img');
      const title = tile.querySelector('.film-title');

      try {
        const url = 'https://vimeo.com/api/oembed.json' +
                    `?url=https%3A%2F%2Fvimeo.com%2F${id}&width=800`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        if (img && data.thumbnail_url) {
          // Ask Vimeo for a properly sized crop rather than the default.
          const thumb = data.thumbnail_url.replace(/-d_\d+x\d+/, '-d_800x450');
          img.style.background = `url('${thumb}') center/cover`;
          if (data.title) img.setAttribute('aria-label', data.title);
        }
        // Only overwrite the title if it's still the placeholder.
        if (title && data.title && title.textContent.trim() === 'Untitled') {
          title.textContent = data.title;
        }
      } catch (e) {
        /* Offline or blocked — tile keeps its placeholder styling. */
      }
    });

    // ---- YouTube tile auto-fill ----
    // Thumbnail is set inline in the HTML (i.ytimg.com needs no API call).
    // Two jobs here: fall back if maxresdefault doesn't exist for that upload,
    // and pull the real title via oEmbed. Both fail quietly.
    document.querySelectorAll('[data-youtube-tile]').forEach(tile => {
      const id = tile.dataset.youtubeId;
      if (!id) return;

      const img   = tile.querySelector('.film-img');
      const title = tile.querySelector('.film-title');

      // maxresdefault.jpg is missing on lower-res uploads; YouTube serves a
      // 120x90 grey placeholder instead. Probe it and downgrade if needed.
      if (img) {
        const probe = new Image();
        probe.onload = () => {
          if (probe.naturalWidth <= 120) {
            img.style.background =
              `url('https://i.ytimg.com/vi/${id}/hqdefault.jpg') center/cover`;
          }
        };
        probe.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
      }

      fetch('https://www.youtube.com/oembed?format=json&url=' +
            encodeURIComponent(`https://www.youtube.com/watch?v=${id}`))
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!data || !data.title) return;
          if (img) img.setAttribute('aria-label', data.title);
          if (title && title.textContent.trim() === 'Untitled') {
            title.textContent = data.title;
          }
        })
        .catch(() => { /* CORS or offline — placeholder title stands. */ });
    });
  });
})();
