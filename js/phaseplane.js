/* =====================================================================
   phaseplane.js — phase portrait + nullclines + click-to-integrate.

   Raw canvas drawing. Axes:
       x = W ∈ [0, max(KW, 200)]
       y = C ∈ [0, max(KC + 50, 200)]
   ===================================================================== */

const PhasePlane = (function () {

  let canvas = null;
  let ctx = null;
  let cachedParams = null;
  let cachedNullclines = null;
  let cachedEqs = null;
  let lastTrajectory = null;
  let outcomeText = null;

  // Margins around the plotting area
  const M = { top: 18, right: 22, bottom: 48, left: 60 };

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', () => { resize(); redraw(); });
    canvas.addEventListener('click', handleClick);
  }

  function resize() {
    // Match canvas pixel size to its rendered size (HiDPI-aware)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.max(rect.width  * dpr, 100);
    canvas.height = Math.max(rect.height * dpr, 100);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function plotBounds(p) {
    return {
      xMin: 0,
      xMax: Math.max(p.KW, 200),
      yMin: 0,
      yMax: Math.max(p.KC + 50, 200)
    };
  }

  function px(x, b, w) {
    return M.left + (x - b.xMin) / (b.xMax - b.xMin) * (w - M.left - M.right);
  }
  function py(y, b, h) {
    return h - M.bottom - (y - b.yMin) / (b.yMax - b.yMin) * (h - M.top - M.bottom);
  }
  // Inverse mapping for clicks
  function xFromPx(xp, b, w) {
    return b.xMin + (xp - M.left) / (w - M.left - M.right) * (b.xMax - b.xMin);
  }
  function yFromPx(yp, b, h) {
    return b.yMin + (h - M.bottom - yp) / (h - M.top - M.bottom) * (b.yMax - b.yMin);
  }

  function computeNullclines(p) {
    const b = plotBounds(p);
    const Ws = [];
    const dW = (b.xMax - 0.3) / 600;
    for (let W = 0.3; W <= b.xMax; W += dW) Ws.push(W);
    const wolfNullcline = Ws.map(W => ({ W, C: Model.Phi(W, p) })).filter(p => p.C !== null);
    const nonwolfNullcline = Ws.map(W => ({ W, C: Model.Psi(W, p) })).filter(p => p.C !== null);
    return { wolfNullcline, nonwolfNullcline };
  }

  function setParams(p) {
    cachedParams = p;
    cachedNullclines = computeNullclines(p);
    cachedEqs = Model.findEquilibria(p);
    lastTrajectory = null;
    outcomeText = null;
    redraw();
  }

  function integrateAndDraw(W0, C0) {
    if (!cachedParams) return;
    const traj = Model.integrate(W0, C0, cachedParams, { dt: 0.02, Tmax: 100 });
    lastTrajectory = { W0, C0, ...traj };

    // Determine outcome label
    const lastW = traj.W[traj.W.length - 1];
    const lastC = traj.C[traj.C.length - 1];
    if (traj.outcome === 'collapse' || lastW < 0.5) {
      outcomeText = { kind: 'collapse', text: `From (W₀=${W0.toFixed(0)}, C₀=${C0.toFixed(0)}): → Collapse to nonwolf dominance (W* ≈ 0, C* ≈ ${lastC.toFixed(0)})` };
    } else {
      outcomeText = { kind: 'persist', text: `From (W₀=${W0.toFixed(0)}, C₀=${C0.toFixed(0)}): → Wolves persist at (W* ≈ ${lastW.toFixed(0)}, C* ≈ ${lastC.toFixed(0)})` };
    }
    // Update outcome metric on page
    const out = document.getElementById('met-outcome');
    if (out) {
      out.textContent = outcomeText.kind === 'persist'
        ? `Persists → W*≈${lastW.toFixed(0)}, C*≈${lastC.toFixed(0)}`
        : `Collapse → W→0, C*≈${lastC.toFixed(0)}`;
      out.classList.remove('outcome-persist','outcome-collapse');
      out.classList.add(outcomeText.kind === 'persist' ? 'outcome-persist' : 'outcome-collapse');
    }
    redraw();
  }

  function handleClick(ev) {
    if (!cachedParams) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const b = plotBounds(cachedParams);
    const xp = ev.clientX - rect.left;
    const yp = ev.clientY - rect.top;
    const Wclick = xFromPx(xp, b, w);
    const Cclick = yFromPx(yp, b, h);
    if (Wclick < b.xMin || Wclick > b.xMax || Cclick < b.yMin || Cclick > b.yMax) return;

    // Update W0/C0 sliders if present
    const w0s = document.getElementById('slider-W0');
    const c0s = document.getElementById('slider-C0');
    if (w0s) { w0s.value = Math.max(0, Math.min(200, Math.round(Wclick))); document.getElementById('val-W0').textContent = w0s.value; }
    if (c0s) { c0s.value = Math.max(0, Math.min(200, Math.round(Cclick))); document.getElementById('val-C0').textContent = c0s.value; }

    integrateAndDraw(Math.max(0.1, Wclick), Math.max(0.1, Cclick));
  }

  function redraw() {
    if (!ctx || !cachedParams) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const b = plotBounds(cachedParams);

    ctx.clearRect(0, 0, w, h);

    // ---- background ----
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // ---- gridlines ----
    ctx.strokeStyle = 'rgba(12,69,79,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const xTicks = niceTicks(b.xMin, b.xMax, 6);
    const yTicks = niceTicks(b.yMin, b.yMax, 6);
    xTicks.forEach(t => {
      const xp = px(t, b, w);
      ctx.moveTo(xp, M.top); ctx.lineTo(xp, h - M.bottom);
    });
    yTicks.forEach(t => {
      const yp = py(t, b, h);
      ctx.moveTo(M.left, yp); ctx.lineTo(w - M.right, yp);
    });
    ctx.stroke();

    // ---- axes ----
    ctx.strokeStyle = '#849DA1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M.left, M.top);
    ctx.lineTo(M.left, h - M.bottom);
    ctx.lineTo(w - M.right, h - M.bottom);
    ctx.stroke();

    // ---- tick labels ----
    ctx.fillStyle = '#849DA1';
    ctx.font = '12px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    xTicks.forEach(t => {
      const xp = px(t, b, w);
      ctx.fillText(formatTick(t), xp, h - M.bottom + 6);
    });
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    yTicks.forEach(t => {
      const yp = py(t, b, h);
      ctx.fillText(formatTick(t), M.left - 6, yp);
    });

    // ---- axis labels ----
    ctx.fillStyle = '#323536';
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('W — wolves', (w + M.left - M.right) / 2, h - 8);

    ctx.save();
    ctx.translate(16, (h + M.top - M.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('C — nonwolves', 0, 0);
    ctx.restore();

    // ---- wolf nullcline (Φ) ----
    drawCurve(cachedNullclines.wolfNullcline, '#0C454F', 2.2, b, w, h);
    // ---- nonwolf nullcline (Ψ) ----
    drawCurve(cachedNullclines.nonwolfNullcline, '#732209', 2.2, b, w, h);

    // ---- trajectory ----
    if (lastTrajectory) {
      ctx.strokeStyle = '#0097B2';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < lastTrajectory.W.length; i++) {
        const xp = px(lastTrajectory.W[i], b, w);
        const yp = py(lastTrajectory.C[i], b, h);
        if (i === 0) ctx.moveTo(xp, yp);
        else ctx.lineTo(xp, yp);
      }
      ctx.stroke();

      // Start marker
      const sx = px(lastTrajectory.W0, b, w);
      const sy = py(lastTrajectory.C0, b, h);
      ctx.fillStyle = '#0097B2';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrow at end (small triangle in direction of motion)
      const n = lastTrajectory.W.length;
      if (n > 2) {
        const xEnd = lastTrajectory.W[n - 1];
        const yEnd = lastTrajectory.C[n - 1];
        const xPrev = lastTrajectory.W[Math.max(0, n - 6)];
        const yPrev = lastTrajectory.C[Math.max(0, n - 6)];
        const dxp = px(xEnd, b, w) - px(xPrev, b, w);
        const dyp = py(yEnd, b, h) - py(yPrev, b, h);
        const len = Math.hypot(dxp, dyp);
        if (len > 1) {
          const ux = dxp / len, uy = dyp / len;
          const tip = { x: px(xEnd, b, w), y: py(yEnd, b, h) };
          const sz = 8;
          ctx.fillStyle = '#0097B2';
          ctx.beginPath();
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(tip.x - sz * ux - sz * 0.5 * uy, tip.y - sz * uy + sz * 0.5 * ux);
          ctx.lineTo(tip.x - sz * ux + sz * 0.5 * uy, tip.y - sz * uy - sz * 0.5 * ux);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // ---- equilibria ----
    if (cachedEqs && cachedEqs.length) {
      cachedEqs.forEach(eq => {
        const xp = px(eq.W, b, w);
        const yp = py(eq.C, b, h);
        if (eq.type === 'stable') {
          ctx.fillStyle = '#0C454F';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(xp, yp, 7, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        } else if (eq.type === 'saddle') {
          ctx.strokeStyle = '#732209';
          ctx.fillStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(xp, yp - 8);
          ctx.lineTo(xp + 8, yp);
          ctx.lineTo(xp, yp + 8);
          ctx.lineTo(xp - 8, yp);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    // Wolf-only boundary (W = EW, C = 0) and nonwolf-only (W = 0, C = KC)
    const EW = Model.wolfOnlyEq(cachedParams);
    if (EW !== null && EW > 0) {
      ctx.fillStyle = '#849DA1';
      ctx.beginPath();
      ctx.arc(px(EW, b, w), py(0, b, h), 4.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = '#849DA1';
    ctx.beginPath();
    ctx.arc(px(0, b, w), py(cachedParams.KC, b, h), 4.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  function drawCurve(pts, color, lw, b, w, h) {
    if (!pts || !pts.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < pts.length; i++) {
      const xp = px(pts[i].W, b, w);
      const yp = py(pts[i].C, b, h);
      if (yp < M.top - 5 || yp > h - M.bottom + 5) {
        started = false;
        continue;
      }
      if (!started) { ctx.moveTo(xp, yp); started = true; }
      else ctx.lineTo(xp, yp);
    }
    ctx.stroke();
  }

  function niceTicks(lo, hi, n) {
    const span = hi - lo;
    const step0 = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    let step;
    if (norm < 1.5) step = mag;
    else if (norm < 3) step = 2 * mag;
    else if (norm < 7) step = 5 * mag;
    else step = 10 * mag;
    const start = Math.ceil(lo / step) * step;
    const out = [];
    for (let v = start; v <= hi + 1e-9; v += step) out.push(v);
    return out;
  }

  function formatTick(v) {
    if (Math.abs(v) < 1e-9) return '0';
    if (Math.abs(v) >= 100) return v.toFixed(0);
    if (Math.abs(v) >= 10)  return v.toFixed(0);
    if (Math.abs(v) >= 1)   return v.toFixed(1);
    return v.toFixed(2);
  }

  return { init, setParams, integrateAndDraw, redraw };
})();
