/* =====================================================================
   bifurcation.js — equilibrium wolf abundance W* versus mortality δ.

   Sweep δ across [0, δ_max] (δ_max = max(rW + 0.01, 0.25)) with step
   ≈ 0.001. For each δ, find roots of Γ(W) = Φ(W) - Ψ(W) and classify.
   Plot stable branches (solid), saddle branches (dashed), wolf-only
   line, invasion threshold, fold point, current-δ indicator.

   Renders into <canvas id="bif-chart"> via Chart.js.
   ===================================================================== */

const Bifurcation = (function () {

  let chart = null;
  const D_STEP = 0.001;

  function dmax(p) {
    return Math.max(p.rW + 0.01, 0.25);
  }

  // Sweep δ; for each δ collect equilibria classified as stable / saddle.
  function sweep(p_template) {
    const dHi = dmax(p_template);
    const stable = [];     // [{x: δ, y: W*}]
    const saddle = [];
    const wolfOnly = [];
    const allEqs = [];     // flat list for fold detection

    let foldDelta = null;
    let foldW = null;
    let dInv = null;

    // Wolf-only line δ ∈ [0, rW)
    for (let d = 0; d < p_template.rW; d += D_STEP * 2) {
      const EW = p_template.KW * (1 - d / p_template.rW);
      wolfOnly.push({ x: d, y: EW });
    }

    // Closed-form invasion threshold (computed once, m and KW fixed across sweep)
    dInv = Model.deltaInv(p_template);

    // Track previous solution branches for adaptive scan
    for (let d = 0; d <= dHi + 1e-12; d += D_STEP) {
      const p = Object.assign({}, p_template, { delta: d });
      const eqs = Model.findEquilibria(p);
      eqs.forEach(eq => {
        allEqs.push({ d, W: eq.W, type: eq.type });
        const pt = { x: d, y: eq.W };
        if (eq.type === 'stable') stable.push(pt);
        else if (eq.type === 'saddle') saddle.push(pt);
      });
    }

    // Detect fold: maximum δ at which an interior equilibrium exists.
    // Roughly: the largest δ where any equilibrium pair persists.
    let foldD = -Infinity;
    let foldWval = null;
    // The fold corresponds to merging of stable+saddle. Find the largest
    // δ where both branches still exist, then the W there.
    // We'll group equilibria by δ:
    const byD = new Map();
    allEqs.forEach(e => {
      if (!byD.has(e.d)) byD.set(e.d, []);
      byD.get(e.d).push(e);
    });
    const dList = Array.from(byD.keys()).sort((a, b) => a - b);
    for (const d of dList) {
      const list = byD.get(d);
      const hasStable = list.some(e => e.type === 'stable');
      const hasSaddle = list.some(e => e.type === 'saddle');
      if (hasStable && hasSaddle && d > foldD) {
        foldD = d;
        // Lower-limb fold: take the smaller-W equilibrium (saddle ≈ stable at fold)
        const Ws = list.map(e => e.W).sort((a, b) => a - b);
        foldWval = Ws[0];
      }
    }
    if (foldD > -Infinity) {
      foldDelta = foldD;
      foldW = foldWval;
    }

    return {
      stable,
      saddle,
      wolfOnly,
      dInv,
      foldDelta,
      foldW,
      dHi
    };
  }

  function render(p_template) {
    const canvas = document.getElementById('bif-chart');
    if (!canvas || !window.Chart) return null;

    const data = sweep(p_template);
    const ctx = canvas.getContext('2d');

    // Build vertical-line dataset for current δ
    const currentDelta = p_template.delta;
    const yMax = Math.max(
      p_template.KW * 1.05,
      ...data.stable.map(p => p.y),
      120
    );

    // Danger zone fill: vertical band from δ_inv to foldDelta
    const dangerLo = (data.dInv && data.dInv > 0) ? data.dInv : null;
    const dangerHi = data.foldDelta;
    const dangerBox = (dangerLo !== null && dangerHi !== null && dangerHi > dangerLo)
      ? [
          { x: dangerLo, y: 0 },
          { x: dangerLo, y: yMax },
          { x: dangerHi, y: yMax },
          { x: dangerHi, y: 0 }
        ]
      : [];

    const datasets = [
      // Danger zone shading (filled polygon via line+fill)
      {
        label: 'Bistable window',
        data: dangerLo !== null && dangerHi !== null && dangerHi > dangerLo
          ? [
              { x: dangerLo, y: 0 },
              { x: dangerLo, y: yMax },
              { x: dangerHi, y: yMax },
              { x: dangerHi, y: 0 }
            ]
          : [],
        backgroundColor: 'rgba(115,34,9,0.10)',
        borderColor: 'rgba(115,34,9,0)',
        fill: true,
        showLine: true,
        pointRadius: 0,
        order: 10
      },
      // Wolf-only line
      {
        label: 'Wolf-only EW',
        data: data.wolfOnly,
        borderColor: 'rgba(132,157,161,0.85)',
        borderDash: [4, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        showLine: true,
        order: 5
      },
      // Stable branch
      {
        label: 'Stable W*',
        data: data.stable,
        borderColor: '#0C454F',
        backgroundColor: '#0C454F',
        borderWidth: 2.5,
        pointRadius: 1.8,
        showLine: false,
        order: 2
      },
      // Saddle branch
      {
        label: 'Saddle',
        data: data.saddle,
        borderColor: '#732209',
        backgroundColor: '#732209',
        borderWidth: 1.5,
        pointRadius: 1.8,
        showLine: false,
        order: 3
      },
      // Current-δ vertical line
      {
        label: 'Current δ',
        data: [
          { x: currentDelta, y: 0 },
          { x: currentDelta, y: yMax }
        ],
        borderColor: '#0097B2',
        borderWidth: 2,
        borderDash: [2, 3],
        pointRadius: 0,
        showLine: true,
        order: 1
      },
      // Current-state reference dot at (δ, ~30)
      {
        label: 'Reference (current δ, W=30)',
        data: [{ x: currentDelta, y: 30 }],
        backgroundColor: '#0097B2',
        borderColor: '#0097B2',
        pointRadius: 6,
        pointStyle: 'circle',
        showLine: false,
        order: 0
      }
    ];

    const config = {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: data.dHi,
            title: {
              display: true,
              text: 'δ — anthropogenic mortality (yr⁻¹)',
              font: { family: 'Inter', size: 13, weight: '500' },
              color: '#323536'
            },
            ticks: { color: '#849DA1', font: { family: 'JetBrains Mono', size: 12 } },
            grid: { color: 'rgba(12,69,79,0.06)' }
          },
          y: {
            min: 0,
            max: yMax,
            title: {
              display: true,
              text: 'W* — equilibrium wolves',
              font: { family: 'Inter', size: 13, weight: '500' },
              color: '#323536'
            },
            ticks: { color: '#849DA1', font: { family: 'JetBrains Mono', size: 12 } },
            grid: { color: 'rgba(12,69,79,0.06)' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = ctx.parsed.x.toFixed(3);
                const w = ctx.parsed.y.toFixed(1);
                return `${ctx.dataset.label}: δ=${d}, W=${w}`;
              }
            }
          }
        }
      }
    };

    if (chart) {
      chart.destroy();
    }
    chart = new Chart(ctx, config);
    return data;
  }

  return { render };
})();
