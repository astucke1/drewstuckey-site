/* =====================================================================
   model-init.js — wires sliders to bifurcation + phase-plane.

   Shared sliders update both panels. δ slider updates both the
   vertical line on the bifurcation diagram and the nullclines on the
   phase portrait. Metrics row reflects δ_inv, fold W*, bistable
   window width, and the most recent trajectory outcome.
   ===================================================================== */

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const ids = ['m', 'delta', 'KW', 'KC', 'W0', 'C0'];
    const sliders = {};
    const valEls = {};
    ids.forEach(k => {
      sliders[k] = document.getElementById('slider-' + k);
      valEls[k]  = document.getElementById('val-' + k);
    });

    if (!sliders.m) return; // not on research page

    function readState() {
      return {
        m:     parseFloat(sliders.m.value),
        delta: parseFloat(sliders.delta.value),
        KW:    parseFloat(sliders.KW.value),
        KC:    parseFloat(sliders.KC.value),
        W0:    parseFloat(sliders.W0.value),
        C0:    parseFloat(sliders.C0.value)
      };
    }

    function paintVals(s) {
      valEls.m.textContent     = s.m.toFixed(2);
      valEls.delta.textContent = s.delta.toFixed(3);
      valEls.KW.textContent    = s.KW.toFixed(0);
      valEls.KC.textContent    = s.KC.toFixed(0);
      valEls.W0.textContent    = s.W0.toFixed(0);
      valEls.C0.textContent    = s.C0.toFixed(0);
    }

    function paintMetrics(bifData, params) {
      const dInv = Model.deltaInv(params);
      const dInvStr = (isFinite(dInv)) ? dInv.toFixed(3) : '—';
      document.getElementById('met-dinv').textContent = dInvStr;

      if (bifData && bifData.foldDelta !== null && bifData.foldW !== null) {
        document.getElementById('met-fold').textContent =
          `W*=${bifData.foldW.toFixed(1)} at δ=${bifData.foldDelta.toFixed(3)}`;
      } else {
        document.getElementById('met-fold').textContent = '—';
      }

      if (bifData && bifData.foldDelta !== null && bifData.dInv !== null
          && bifData.dInv > 0 && bifData.foldDelta > bifData.dInv) {
        document.getElementById('met-bistable').textContent =
          (bifData.foldDelta - bifData.dInv).toFixed(3);
      } else {
        document.getElementById('met-bistable').textContent = '—';
      }
    }

    // ----- Initial render -----
    function fullRender(integrateTrajectory) {
      const s = readState();
      paintVals(s);
      const p = Model.makeParams({ m: s.m, delta: s.delta, KW: s.KW, KC: s.KC });
      const bifData = Bifurcation.render(p);
      PhasePlane.setParams(p);
      if (integrateTrajectory) {
        PhasePlane.integrateAndDraw(Math.max(0.1, s.W0), Math.max(0.1, s.C0));
      }
      paintMetrics(bifData, p);
    }

    // Initialize phase canvas
    PhasePlane.init('phase-canvas');

    // ----- Wire up sliders -----
    // m, δ, K_W, K_C all require a full re-sweep of the bifurcation
    // diagram + nullclines + equilibria (expensive but acceptable).
    ['m', 'delta', 'KW', 'KC'].forEach(k => {
      sliders[k].addEventListener('input', () => {
        fullRender(false);
      });
      sliders[k].addEventListener('change', () => {
        // After release, also re-integrate trajectory at current W0/C0
        fullRender(true);
      });
    });
    // W0, C0 just re-integrate
    ['W0', 'C0'].forEach(k => {
      sliders[k].addEventListener('input', () => {
        const s = readState();
        paintVals(s);
      });
      sliders[k].addEventListener('change', () => {
        const s = readState();
        PhasePlane.integrateAndDraw(Math.max(0.1, s.W0), Math.max(0.1, s.C0));
      });
    });

    // Reset-to-defaults button. Defaults match the values used in the article.
    const DEFAULTS = { m: 0.60, delta: 0.08, KW: 150, KC: 150, W0: 30, C0: 120 };
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', (ev) => {
        ev.preventDefault();

        // Push values into each slider as a string so the browser's
        // step-snap interprets it cleanly, then nudge the thumb visually.
        ids.forEach(k => {
          sliders[k].value = String(DEFAULTS[k]);
        });

        // Explicit full re-render of both panels with the new state.
        const s = readState();
        paintVals(s);
        const p = Model.makeParams({ m: s.m, delta: s.delta, KW: s.KW, KC: s.KC });
        const bifData = Bifurcation.render(p);
        PhasePlane.setParams(p);
        PhasePlane.integrateAndDraw(Math.max(0.1, s.W0), Math.max(0.1, s.C0));
        paintMetrics(bifData, p);

        // Brief visual confirmation so the click never feels silent.
        btnReset.classList.add('btn-flash');
        const orig = btnReset.textContent;
        btnReset.textContent = 'Reset ✓';
        setTimeout(() => {
          btnReset.classList.remove('btn-flash');
          btnReset.textContent = orig;
        }, 800);
      });
    }

    // First paint (no trajectory until user clicks or releases a slider)
    fullRender(true);
  });
})();
