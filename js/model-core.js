/* =====================================================================
   model-core.js — Red wolf competition–hybridization model.

   Equations follow the published spec EXACTLY. Do not modify, simplify,
   or re-derive these. State variables:
       W = wolf abundance
       C = nonwolf abundance (coyotes + hybrids)

   Vector field:
       dW/dt = rW * W * (1 - (W + αWC*C)/KW) - δ*W - rW*W*H(W,C)
       dC/dt = rC * C * (1 - (C + αCW*W)/KC) + η*rW*W*H(W,C)

   Reproductive-diversion (regularized):
       H(W,C) = h0*(1-m) * [C/(C+θ*W+ε)] * [A/(A+W)]

   Wolf nullcline (Φ): for W > 0, solve quadratic in C
       a    = αWC/KW
       q    = 1 - δ/rW - W/KW          (valid only if q > 0)
       bW   = q - B(W) - a*(θW + ε)
       ΔW   = bW² + 4*a*q*(θW + ε)
       Φ(W) = (bW + √ΔW) / (2a)

   Nonwolf nullcline (Ψ): for W > 0, solve quadratic in C
       bC   = KC - (αCW + θ)*W - ε
       dC   = (KC - αCW*W)*(θW + ε) + KC*η*rW/rC * W * B(W)
       ΔC   = bC² + 4*dC
       Ψ(W) = (bC + √ΔC) / 2

   With B(W) = h0*(1-m) * A/(A+W).
   ===================================================================== */

const Model = (function () {

  // ----- Fixed parameters (per spec, hardcoded) -----
  const FIXED = Object.freeze({
    rW:  0.182,
    rC:  0.25,
    KC:  150,
    aWC: 0.15,    // αWC
    aCW: 0.80,    // αCW
    h0:  0.50,
    A:   25,
    theta: 1.0,
    eta: 0.50,
    eps: 0.15
  });

  // ----- H, F, G -----
  function H(W, C, p) {
    const denom = C + p.theta * W + p.eps;
    return p.h0 * (1 - p.m) * (C / denom) * (p.A / (p.A + W));
  }

  function F(W, C, p) {
    return p.rW * W * (1 - (W + p.aWC * C) / p.KW)
         - p.delta * W
         - p.rW * W * H(W, C, p);
  }

  function G(W, C, p) {
    return p.rC * C * (1 - (C + p.aCW * W) / p.KC)
         + p.eta * p.rW * W * H(W, C, p);
  }

  // ----- B(W) helper for nullclines -----
  function B(W, p) {
    return p.h0 * (1 - p.m) * p.A / (p.A + W);
  }

  // ----- Φ(W): wolf nullcline -----
  // Returns positive C such that dW/dt = 0 at given W, or null if none.
  function Phi(W, p) {
    if (W <= 0) return null;
    const a = p.aWC / p.KW;
    const q = 1 - p.delta / p.rW - W / p.KW;
    if (q <= 0) return null;
    const term = p.theta * W + p.eps;
    const bW = q - B(W, p) - a * term;
    const disc = bW * bW + 4 * a * q * term;
    if (disc < 0) return null;
    const C = (bW + Math.sqrt(disc)) / (2 * a);
    return (isFinite(C) && C > 0) ? C : null;
  }

  // ----- Ψ(W): nonwolf nullcline -----
  function Psi(W, p) {
    if (W <= 0) return null;
    const bC = p.KC - (p.aCW + p.theta) * W - p.eps;
    const dC = (p.KC - p.aCW * W) * (p.theta * W + p.eps)
             + p.KC * p.eta * p.rW / p.rC * W * B(W, p);
    const disc = bC * bC + 4 * dC;
    if (disc < 0) return null;
    const C = (bC + Math.sqrt(disc)) / 2;
    return (isFinite(C) && C > 0) ? C : null;
  }

  // ----- Γ(W) = Φ(W) - Ψ(W); roots are interior equilibria -----
  function Gamma(W, p) {
    const phi = Phi(W, p);
    const psi = Psi(W, p);
    if (phi === null || psi === null) return null;
    return phi - psi;
  }

  // ----- Bisection refinement of a Γ sign-change bracket -----
  function bisectGamma(Wlo, Whi, p, iters = 35) {
    let lo = Wlo, hi = Whi;
    let flo = Gamma(lo, p);
    let fhi = Gamma(hi, p);
    if (flo === null || fhi === null) return null;
    if (flo * fhi > 0) return null;
    for (let i = 0; i < iters; i++) {
      const mid = 0.5 * (lo + hi);
      const fm = Gamma(mid, p);
      if (fm === null) return null;
      if (flo * fm <= 0) { hi = mid; fhi = fm; }
      else                { lo = mid; flo = fm; }
    }
    return 0.5 * (lo + hi);
  }

  // ----- Scan W-axis, find all interior equilibria at given params -----
  // Returns array of { W, C, type: 'stable'|'saddle'|'unknown', det, tr }
  function findEquilibria(p, opts = {}) {
    const Wmax = opts.Wmax || (p.KW + 5);
    const dW   = opts.dW   || 0.4;
    const eqs  = [];

    let Wprev = 0.3;
    let gprev = Gamma(Wprev, p);

    for (let W = Wprev + dW; W <= Wmax + 1e-9; W += dW) {
      const g = Gamma(W, p);
      if (gprev !== null && g !== null && gprev * g < 0) {
        const Wstar = bisectGamma(Wprev, W, p);
        if (Wstar !== null) {
          const Cstar = Phi(Wstar, p);
          if (Cstar !== null) {
            const cls = classifyJacobian(Wstar, Cstar, p);
            eqs.push({ W: Wstar, C: Cstar, ...cls });
          }
        }
      }
      Wprev = W;
      gprev = g;
    }
    return eqs;
  }

  // ----- Classify (W*, C*) via finite-difference Jacobian -----
  function classifyJacobian(W, C, p) {
    const h = 1e-5;
    const J11 = (F(W + h, C, p) - F(W - h, C, p)) / (2 * h);
    const J12 = (F(W, C + h, p) - F(W, C - h, p)) / (2 * h);
    const J21 = (G(W + h, C, p) - G(W - h, C, p)) / (2 * h);
    const J22 = (G(W, C + h, p) - G(W, C - h, p)) / (2 * h);
    const det = J11 * J22 - J12 * J21;
    const tr  = J11 + J22;
    let type = 'unknown';
    if (det < 0) type = 'saddle';
    else if (det > 0 && tr < 0) type = 'stable';
    else type = 'unstable';
    return { type, det, tr };
  }

  // ----- Wolf-only equilibrium: EW = KW*(1 - δ/rW), valid if δ < rW -----
  function wolfOnlyEq(p) {
    if (p.delta >= p.rW) return null;
    return p.KW * (1 - p.delta / p.rW);
  }

  // ----- Closed-form invasion threshold -----
  //  δ_inv = rW * (1 - αWC*KC/KW - h0*(1-m)*KC/(KC+ε))
  function deltaInv(p) {
    return p.rW * (1 - p.aWC * p.KC / p.KW
                     - p.h0 * (1 - p.m) * p.KC / (p.KC + p.eps));
  }

  // ----- Build a parameters object from the slider values -----
  // ε is defined in the manuscript as 10⁻³ · min(K_W, K_C), so it must
  // scale whenever the user moves either carrying-capacity slider.
  // K_C defaults to FIXED.KC = 150 (the article's conservative choice)
  // but the slider lets reviewers probe sensitivity to that assumption.
  function makeParams({ m, delta, KW, KC }) {
    const KCeff = (KC != null) ? KC : FIXED.KC;
    const eps = 1e-3 * Math.min(KW, KCeff);
    return Object.assign({}, FIXED, { m, delta, KW, KC: KCeff, eps });
  }

  // ----- RK4 integration of the (W, C) system -----
  function rk4Step(W, C, p, dt) {
    const k1W = dt * F(W, C, p);
    const k1C = dt * G(W, C, p);
    const k2W = dt * F(W + k1W / 2, C + k1C / 2, p);
    const k2C = dt * G(W + k1W / 2, C + k1C / 2, p);
    const k3W = dt * F(W + k2W / 2, C + k2C / 2, p);
    const k3C = dt * G(W + k2W / 2, C + k2C / 2, p);
    const k4W = dt * F(W + k3W, C + k3C, p);
    const k4C = dt * G(W + k3W, C + k3C, p);
    return [
      W + (k1W + 2 * k2W + 2 * k3W + k4W) / 6,
      C + (k1C + 2 * k2C + 2 * k3C + k4C) / 6
    ];
  }

  function integrate(W0, C0, p, opts = {}) {
    const dt = opts.dt || 0.02;
    const Tmax = opts.Tmax || 100;
    const maxSteps = Math.ceil(Tmax / dt);
    const W = [W0], C = [C0], t = [0];
    let stableCount = 0;
    let outcome = 'maxtime';
    for (let i = 0; i < maxSteps; i++) {
      const [Wn, Cn] = rk4Step(W[W.length - 1], C[C.length - 1], p, dt);
      const Wsafe = Math.max(Wn, 0);
      const Csafe = Math.max(Cn, 0);
      const dWabs = Math.abs(Wsafe - W[W.length - 1]);
      const dCabs = Math.abs(Csafe - C[C.length - 1]);
      W.push(Wsafe);
      C.push(Csafe);
      t.push(t[t.length - 1] + dt);
      if (Wsafe < 0.01) { outcome = 'collapse'; break; }
      if (dWabs + dCabs < 1e-4) {
        stableCount++;
        if (stableCount >= 50) { outcome = 'converged'; break; }
      } else {
        stableCount = 0;
      }
    }
    return { W, C, t, outcome };
  }

  // ----- Public API -----
  return {
    FIXED,
    H, F, G, B,
    Phi, Psi, Gamma,
    bisectGamma,
    findEquilibria,
    classifyJacobian,
    wolfOnlyEq,
    deltaInv,
    makeParams,
    rk4Step,
    integrate
  };
})();
