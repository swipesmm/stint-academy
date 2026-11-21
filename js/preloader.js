(() => {
  const overlay = document.getElementById('preloader');
  if (!overlay) return;

  const forceReplay = new URLSearchParams(window.location.search).get('replay') === '1';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const navEntry = performance.getEntriesByType('navigation')[0];
  const isReload = navEntry && navEntry.type === 'reload';

  function dismissImmediate() {
    overlay.remove();
    document.body.classList.remove('is-preloading');
    document.body.classList.add('is-hero-ready');
  }

  if (reduceMotion || (!forceReplay && !isReload && sessionStorage.getItem('stint_intro_seen'))) {
    dismissImmediate();
    return;
  }

  document.body.classList.add('is-preloading');

  let dismissed = false;
  let disposeFn = null;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    sessionStorage.setItem('stint_intro_seen', '1');
    overlay.classList.add('is-hidden');
    document.body.classList.remove('is-preloading');
    document.body.classList.add('is-hero-ready');
    setTimeout(() => {
      if (disposeFn) disposeFn();
      overlay.remove();
    }, 520);
  }
  // Страховка: сайт откроется в любом случае, даже если WebGL2 недоступен
  const hardTimeout = setTimeout(dismiss, 3600);
  overlay.addEventListener('click', dismiss);

  const P = {
    tileSize: 220, logoScale: 0.7, finalScale: 0.74, logoOffset: [0, 0],
    iconPlate: false, keepPlate: false, originalColors: true,
    opticalDepth: 1.05, dispersion: 1.5, colorBleed: 1.1, doubleBevel: 1, bevelWidth: 0.14,
    corner: 4.8, cornerPull: 2.0, cornerWidth: 2.0, cornerFocus: 0.56, edgeSmear: 2.5,
    stretch: 0, tilt: 0.35, bulge: 1, specular: 1, halo: 0, shadow: 1, ripple: 1,
    bounce: 0, response: 0.36, startSize: 0.2, startZoom: 2.4, glide: 1.45, present: 1.55,
    drift: 0.1, swell: 0.4, focus: 1, sheen: 1, lightTurn: 0.9,
    background: '#F5F5F7', plateColor: '#FFFFFF', logoColor: '#1D94EE'
  };

  const TEX = 512;
  const BOX = 0.74;
  const TAIL = 0.85;
  const END_TIME = P.present + TAIL;

  const VERT = `#version 300 es
  in vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  out vec4 outColor;
  uniform vec2 uCenter; uniform float uTile; uniform sampler2D uSdf; uniform sampler2D uCol;
  uniform float uTexSize; uniform float uBoxFrac; uniform float uPlateScale; uniform float uShapeN;
  uniform float uCornerN; uniform float uOptics; uniform float uPlateAlpha; uniform float uLogoHalf;
  uniform vec2 uLogoOff; uniform float uBold; uniform float uBlur; uniform float uFrost;
  uniform float uDome; uniform float uDrop; uniform float uPinch; uniform float uTilt;
  uniform float uRim; uniform float uHalo; uniform float uShadow; uniform float uGhost;
  uniform float uRipR; uniform float uRipA; uniform float uBare; uniform float uReach;
  uniform float uCornerPull; uniform float uStreak; uniform float uWiden; uniform float uSlab;
  uniform float uEtaSpread; uniform float uFocus; uniform float uFocusK; uniform float uFocusSplit;
  uniform float uRimLine; uniform float uCornerOn; uniform float uDissolve; uniform float uGlow;
  uniform float uFaceDisp; uniform float uVivid; uniform float uDisp; uniform float uDouble;
  uniform float uBevelW; uniform float uSpec; uniform float uIconPlate; uniform float uUseColor;
  uniform float uLightScene; uniform float uLightGlass; uniform float uKeep; uniform float uSheen;
  uniform float uSweep; uniform float uLightAng;
  uniform vec3 uBg; uniform vec3 uPlateCol; uniform vec3 uLogoCol;
  float px;

  vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

  vec4 logoAt(vec2 q, float blur, float aa) {
    float L = uLogoHalf;
    float k = 0.5 * uBoxFrac / L;
    vec2 uv = vec2(0.5 + (q.x - uLogoOff.x) * k, 0.5 - (q.y - uLogoOff.y) * k);
    float d = texture(uSdf, uv).r / k;
    float w = 0.75 * aa + blur;
    float a = 1.0 - smoothstep(-w, w, d - uBold * L);
    vec3 c = uLogoCol;
    if (uUseColor > 0.5) {
      float lod = log2(max(1.0, w * k * uTexSize));
      vec4 c0 = textureLod(uCol, uv, lod);
      vec4 c1 = textureLod(uCol, uv, lod + 3.0);
      vec4 c2 = textureLod(uCol, uv, 7.0);
      c = c2.rgb / max(c2.a, 1e-4);
      c = mix(c, c1.rgb / max(c1.a, 1e-4), smoothstep(0.0, 0.06, c1.a));
      c = mix(c, c0.rgb / max(c0.a, 1e-4), smoothstep(0.02, 0.3, c0.a));
    }
    return vec4(c, a);
  }

  float shape(vec2 p, float scale, float n, out vec2 nOut, out float g, out vec2 dg) {
    vec2 pp = p / scale;
    vec2 a = max(abs(pp), vec2(1e-6));
    g = pow(pow(a.x, n) + pow(a.y, n), 1.0 / n);
    dg = sign(pp) * pow(a, vec2(n - 1.0)) * pow(max(g, 1e-6), 1.0 - n);
    float dgl = max(length(dg), 1e-6);
    nOut = dg / dgl;
    return (g - 1.0) / dgl * scale;
  }

  float contourRadius(vec2 p, float scale, float n) {
    vec2 a = max(abs(p / scale), vec2(1e-4));
    vec2 a1 = pow(a, vec2(n - 1.0));
    vec2 a2 = pow(a, vec2(n - 2.0));
    float k = (n - 1.0) * (a2.x * a1.y * a1.y + a2.y * a1.x * a1.x) / pow(max(dot(a1, a1), 1e-30), 1.5);
    return scale / max(k, 1e-3);
  }

  vec2 refractSample(float x, float bwF, float eta, float R, vec2 dirOut, vec2 p, float dome, float offMul) {
    float u = clamp(1.0 - x, 0.0, 0.995);
    float th = asin(u), thr = asin(u / eta);
    float z = uSlab + bwF * sqrt(1.0 - u * u);
    float off = offMul * z * tan(th - thr);
    off = off / (1.0 + off / (6.0 * R));
    return p - (dirOut * off + p * dome) * uOptics;
  }

  float gauss(float x, float c, float w) { float d = (x - c) / w; return exp(-0.5 * d * d); }
  float band(float x, float a, float b, float w) { return smoothstep(a - w, a, x) * (1.0 - smoothstep(b, b + w, x)); }
  float bump(float x, float c, float w) { float d = (x - c) / w; return exp(-0.5 * d * d); }
  vec3 spectrum(float x) {
    return vec3(bump(x, 0.34, 0.2) + 0.08 * bump(x, 0.93, 0.05), bump(x, 0.58, 0.1), bump(x, 0.8, 0.11));
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    px = 2.0 / uTile;
    vec2 p = (gl_FragCoord.xy - uCenter) * px;
    vec4 lg = logoAt(p, uBlur, px);
    vec3 plain = mix(uBg, lg.rgb, lg.a * uBare);

    vec2 nOut, dg; float g;
    float sd = shape(p, uPlateScale, uShapeN, nOut, g, dg);
    float s = -sd;
    float bw = max(uBevelW, 0.004) * uPlateScale;
    float x = clamp(s / bw, 0.0, 1.0);
    float R = contourRadius(p, uPlateScale, uShapeN);
    vec2 pq = p * p;
    float diag = 4.0 * pq.x * pq.y / max((pq.x + pq.y) * (pq.x + pq.y), 1e-6);
    float tilt = mix(1.0 - uTilt, 1.0, smoothstep(-0.02, 0.02, p.x * p.y));
    float pinchPart = uPinch * min(g * g, 1.0) * diag * diag * tilt;
    float dome = uDome * (1.0 - min(g * g, 1.0)) + pinchPart;
    vec2 dirOut = normalize(mix(nOut, p / max(length(p), 1e-4), 0.2));
    float cornerness = max(smoothstep(0.1, 0.9, 4.0 * nOut.x * nOut.x * nOut.y * nOut.y), smoothstep(0.15, 0.75, diag));
    float offMul = 1.0 + 0.4 * max(uCornerPull - 1.0, 0.0) * tilt * cornerness * uCornerOn;
    vec2 focus = sign(p) * (pow(0.5, 1.0 / uShapeN) - uFocus * 0.70710678) * uPlateScale;
    float focusW = tilt * cornerness * uOptics * uCornerOn;
    float bwF = max(uReach, 0.004) * (1.0 + uWiden * tilt * cornerness * uCornerOn);
    float xf = clamp(s / bwF, 0.0, 1.0);
    vec2 qc = refractSample(xf, bwF, 1.5, R, dirOut, p, dome, offMul);
    float foot = max(max(length(dFdx(qc)), length(dFdy(qc))), 0.25 * px);

    vec3 bg = uBg;
    vec3 lift = mix(uBg + vec3(0.06), mix(uBg, vec3(1.0), 0.55), uLightScene);
    if (uGhost > 0.001) {
      vec2 gn, gdg; float gg;
      float gsd = shape(p, 1.0, uCornerN, gn, gg, gdg);
      bg = mix(bg, lift, uGhost * 0.12 * (1.0 - smoothstep(-0.16, 0.14, gsd)));
      bg *= 1.0 - uGhost * 0.03 * uLightScene * exp(-max(gsd, 0.0) / 0.12) * step(0.0, gsd);
    }
    if (uRipA > 0.001) {
      float d0 = (uRipR - 1.0) * uPlateScale;
      float rx = (sd - d0) / 0.022;
      float ring = exp(-rx * rx);
      bg += uRipA * ring * (0.04 * (0.55 + 0.45 * dot(nOut, normalize(vec2(-0.5, 0.8))))) * mix(0.5, 1.0, uLightScene);
      bg -= uRipA * 0.016 * uLightScene * exp(-(rx - 1.6) * (rx - 1.6));
    }
    float shadowFall = max(sd, 0.0) / (0.9 * uPlateScale);
    bg *= 1.0 - uShadow * 0.03 * exp(-shadowFall * shadowFall) * step(0.0, sd);

    vec3 col = bg;
    float soft = px + uBlur * 0.8 + 0.06 * uDissolve * (1.0 - uKeep) * uPlateScale;
    if (sd < soft) {
      float y1 = 1.0 - x;
      const float K = 2.6;
      float base1 = max(1.0 - pow(y1, K), 1e-4);
      float db = min(pow(y1, K - 1.0) * pow(base1, 1.0 / K - 1.0), 25.0);
      float s1 = bw * 0.62;
      float w2 = bw * 0.22;
      float t2 = clamp((s - s1) / w2, -1.0, 1.0);
      float dh2 = uDouble * bw * 0.16;
      float dd = dh2 * 0.5 * cos(t2 * 1.5707963) * 1.5707963 / w2 * step(abs(t2), 0.999);
      vec2 gDome = -uDome * 2.0 * g * dg * step(g, 1.0);
      vec2 grad = -(db + dd) * nOut + gDome;

      vec3 back = mix(uBg, uPlateCol, uIconPlate);
      vec3 liftG = mix(back + vec3(0.06), mix(back, vec3(1.0), 0.55), uLightGlass);
      float rblur = uBlur + 0.05 * length(qc - p) + min(uGlow * uOptics * (1.0 - xf) * foot / px, 0.04);

      float cornerW = smoothstep(0.1, 0.9, 4.0 * nOut.x * nOut.x * nOut.y * nOut.y);
      float streak = 0.35 * uStreak * bw * mix(0.15, 1.0, cornerW) * pow(1.0 - xf, 1.5) * uOptics;
      vec2 tangent = vec2(-nOut.y, nOut.x);
      vec3 acc = vec3(0.0), wsum = vec3(0.0);
      for (int i = 0; i < 16; i++) {
        float lam = (float(i) + 0.5) / 16.0;
        float c = uDisp * (1.0 - 2.0 * lam);
        vec2 along = tangent * (streak * 2.0 * (fract(float(i) * 0.618034 + 0.31) - 0.5));
        float cf = uDisp * (1.0 - 2.0 * lam) * (lam > 0.5 ? 1.0 : 0.5);
        vec2 sp = refractSample(xf, bwF, 1.5 + uEtaSpread * c, R, dirOut, p + along, dome + pinchPart * 0.3 * c, offMul);
        vec2 focusL = focus - sign(p) * (0.70710678 * uFocusSplit * c * uPlateScale);
        float wFocus = pow(1.0 - xf, uFocusK) * smoothstep(0.0, uRimLine * (1.0 + 0.6 * c), xf);
        sp = mix(sp, mix(p + along, focusL, wFocus), focusW);
        float faceOnly = smoothstep(0.7, 1.0, xf) * uOptics;
        sp *= 1.0 + uFaceDisp * cf * faceOnly;
        vec4 l = logoAt(sp, rblur + 0.12 * streak + uFaceDisp * 0.5 * max(c, 0.0) * faceOnly, foot);
        vec3 w = spectrum(lam);
        acc += mix(back, l.rgb, l.a) * w;
        wsum += w;
      }
      vec3 trans = acc / wsum;
      float tl = dot(trans, vec3(0.2126, 0.7152, 0.0722));
      trans = clamp(tl + (trans - tl) * (1.0 + uVivid * uOptics), 0.0, 1.0);
      float hazeLum = dot(trans, vec3(0.2126, 0.7152, 0.0722));
      float hazeGate = mix(1.0 - smoothstep(0.25, 0.75, hazeLum), smoothstep(0.25, 0.75, hazeLum), uLightGlass);
      trans = mix(trans, liftG, uFrost * 0.45 * hazeGate);

      float glassAmt = pow(1.0 - uDissolve, 1.5);
      float lit = uSpec * glassAmt;
      float sc = uPlateScale;
      float tLum = dot(trans, vec3(0.2126, 0.7152, 0.0722));
      float lightOnly = smoothstep(0.35, 0.85, tLum);
      float hw = smoothstep(-0.85, 0.5, dot(nOut, rot(vec2(0.5, 0.866), uLightAng)));
      float tileBand = band(s, 0.016 * sc, 0.075 * sc, 0.022 * sc);
      float dropBand = (1.0 - smoothstep(0.06 * sc, 0.13 * sc, s)) * smoothstep(0.0, 0.004 * sc, s);
      float glow = mix(0.32 * tileBand, 0.75 * dropBand, uDrop) * lightOnly;
      float edgeLine = gauss(s, 0.005 * sc, 0.0045 * sc);
      float lip = gauss(s, 0.15 * sc, 0.007 * sc) * uDouble * (1.0 - uDrop);
      vec3 glass = mix(trans, vec3(1.0), glow * glassAmt);
      glass += (0.075 * hw * edgeLine + 0.06 * (0.4 + 0.6 * hw) * lip) * lit;
      glass *= 1.0 - 0.05 * (1.0 - hw) * edgeLine * glassAmt * (1.0 - uDrop);
      glass = mix(glass, vec3(1.0), 0.55 * uDrop * glassAmt * edgeLine);

      float sweepD = dot(p / uPlateScale, normalize(vec2(0.8, 0.6))) - uSweep;
      float sheen = uSheen * glassAmt * exp(-sweepD * sweepD / 0.03) * (0.55 + 0.45 * (1.0 - x));
      glass = mix(glass, vec3(1.0), sheen * 0.42);

      float cov = clamp(0.5 - sd / soft, 0.0, 1.0);
      col = mix(bg, glass, cov);
    }

    vec3 outc = mix(plain, col, uPlateAlpha);
    outc += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    outColor = vec4(outc, 1.0);
  }`;

  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const smoother = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
  const hexToRgb = hex => {
    const v = parseInt(hex.replace('#', ''), 16) || 0;
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  };
  const spring = (t, response) => {
    if (t <= 0) return 0;
    const w = (2 * Math.PI) / response;
    return 1 - Math.exp(-w * t) * (1 + w * t);
  };
  const timeToReach = (level, response) => {
    let lo = 0, hi = 3;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (spring(mid, response) < level) lo = mid; else hi = mid;
    }
    return hi;
  };

  function edt1d(grid, offset, stride, f, v, z, INF) {
    v[0] = 0; z[0] = -INF; z[1] = INF; f[0] = grid[offset];
    for (let q = 1, k = 0, s = 0; q < TEX; q++) {
      f[q] = grid[offset + q * stride];
      const q2 = q * q;
      do {
        const r = v[k];
        s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
      } while (s <= z[k] && --k > -1);
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    for (let q = 0, k = 0; q < TEX; q++) {
      while (z[k + 1] < q) k++;
      const r = v[k]; const qr = q - r;
      grid[offset + q * stride] = f[r] + qr * qr;
    }
  }

  function buildLogoData(img) {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const s = Math.min((TEX * BOX) / img.naturalWidth, (TEX * BOX) / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, (TEX - dw) / 2, (TEX - dh) / 2, dw, dh);

    const n = TEX * TEX;
    const alpha = ctx.getImageData(0, 0, TEX, TEX).data;
    const INF = 1e20;
    const outer = new Float64Array(n), inner = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = alpha[i * 4 + 3] / 255;
      if (a >= 1) { outer[i] = 0; inner[i] = INF; }
      else if (a <= 0) { outer[i] = INF; inner[i] = 0; }
      else { const dd = 0.5 - a; outer[i] = dd > 0 ? dd * dd : 0; inner[i] = dd < 0 ? dd * dd : 0; }
    }
    const f = new Float64Array(TEX), z = new Float64Array(TEX + 1), v = new Uint16Array(TEX);
    for (let x = 0; x < TEX; x++) edt1d(outer, x, TEX, f, v, z, INF);
    for (let y = 0; y < TEX; y++) edt1d(outer, y * TEX, 1, f, v, z, INF);
    for (let x = 0; x < TEX; x++) edt1d(inner, x, TEX, f, v, z, INF);
    for (let y = 0; y < TEX; y++) edt1d(inner, y * TEX, 1, f, v, z, INF);

    const sdf = new Float32Array(n);
    for (let i = 0; i < n; i++) sdf[i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / TEX;
    return { canvas: c, sdf };
  }

  function frameAt(T) {
    const tx = P.present;
    const grow = spring(T + 0.01, P.response);
    const tl = timeToReach(0.85, P.response) - 0.01;
    const tm = timeToReach(0.92, P.response) - 0.01;
    const morph = spring(T - tm, 0.36);
    const drop = 1 - smooth(0.05, 1, morph);
    const appear = smooth(0, 0.08, T);
    const drift = P.drift * spring(T - 0.25, 2.0);
    const zoomIn = 0.25 * spring(T, 0.65) + 0.75 * smoother(0, P.glide, T);
    const settle = spring(T - 0.45, 2.0);
    const exit = spring(T - tx, 0.85);
    const release = spring(T - tx - 0.04, 0.58);
    const dome = 0.15 * P.bulge * (1 - smooth(0.4, 0.95, grow));
    const view = (1 + (P.startZoom - 1) * (1 - zoomIn)) * (1 - 0.045 * settle) * mix(1, P.finalScale, exit);
    const bandW = mix(P.bevelWidth, Math.max(P.bevelWidth, 0.4), drop);
    const plateScale = mix(P.startSize, 1, grow) * (1 + drift) * (1 + 0.14 * release);
    const bg = hexToRgb(P.background);
    return {
      uPlateScale: plateScale, uShapeN: mix(2, P.corner, morph), uCornerN: P.corner,
      uOptics: 1 - smooth(0.55, 1, release), uPlateAlpha: appear * (1 - smooth(0.45, 1, release)),
      uLogoHalf: P.logoScale * view, uLogoOff: [0, 0], uKeep: 0, uSheen: P.sheen,
      uSweep: mix(-1.6, 1.6, smoother(0.75, tx - 0.08, T)), uLightAng: P.lightTurn * smoother(0.35, tx + 0.3, T),
      uBold: P.swell * 0.03 * (1 - zoomIn), uBlur: P.focus * 0.05 * (1 - smooth(0.3, 0.95, grow)),
      uFrost: P.focus * (1 - smooth(0.5, 0.95, grow)), uPinch: 0, uTilt: P.tilt, uDome: dome, uDrop: drop,
      uRim: 1 + 0.8 * drop, uHalo: 0, uShadow: P.shadow * smooth(0.45, 0.8, grow) * (1 - smooth(0, 0.6, morph)),
      uGhost: smooth(0, 0.03, T) * (1 - smooth(0.04, 0.08, T)),
      uRipR: 1 + 0.9 * Math.max(0, T - tl), uRipA: P.ripple * smooth(tl, tl + 0.06, T) * Math.exp(-Math.max(0, T - tl) / 0.55),
      uBare: smooth(tx - 0.22, tx, T), uReach: bandW * plateScale, uCornerPull: P.cornerPull,
      uStreak: P.edgeSmear, uWiden: P.cornerWidth, uSlab: 0.3 * P.opticalDepth, uEtaSpread: 0.06,
      uFocus: P.cornerFocus, uFocusK: 1.0, uFocusSplit: 0.056 * P.colorBleed, uRimLine: 0.09,
      uCornerOn: smooth(0.35, 1, morph), uGlow: 0.012 * P.colorBleed, uFaceDisp: 0.012 * P.dispersion,
      uVivid: 0.85, uDissolve: release, uDisp: P.dispersion, uDouble: P.doubleBevel,
      uBevelW: bandW * (1 - release), uSpec: P.specular, uIconPlate: 0, uUseColor: 1,
      uLightScene: 1, uLightGlass: 1, uBg: bg, uPlateCol: hexToRgb(P.plateColor), uLogoCol: hexToRgb(P.logoColor)
    };
  }

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  overlay.appendChild(canvas);

  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
  if (!gl) { clearTimeout(hardTimeout); dismiss(); return; }

  try {
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader');
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    const cnt = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < cnt; i++) {
      const info = gl.getActiveUniform(prog, i);
      U[info.name] = gl.getUniformLocation(prog, info.name);
    }

    const sdfTex = gl.createTexture();
    const colTex = gl.createTexture();
    gl.uniform1i(U.uSdf, 0);
    gl.uniform1i(U.uCol, 1);

    const img = new Image();
    img.src = 'assets/img/logo.png';
    img.onerror = () => { clearTimeout(hardTimeout); dismiss(); };
    img.onload = () => {
      if (dismissed) return;
      const data = buildLogoData(img);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sdfTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, TEX, TEX, 0, gl.RED, gl.FLOAT, data.sdf);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, colTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data.canvas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      let t = 0;
      let last = performance.now();
      let raf = 0;

      disposeFn = () => {
        if (raf) cancelAnimationFrame(raf);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };

      function tick(now) {
        if (dismissed) return;
        const dt = Math.min(0.08, (now - last) / 1000);
        last = now;
        t += dt;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = overlay.clientWidth || window.innerWidth;
        const ch = overlay.clientHeight || window.innerHeight;
        const w = Math.max(1, Math.round(cw * dpr));
        const h = Math.max(1, Math.round(ch * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        const tile = Math.min(P.tileSize, Math.min(cw, ch) / 1.85);
        const fr = frameAt(Math.min(t, END_TIME));

        gl.viewport(0, 0, w, h);
        gl.uniform2f(U.uCenter, w / 2, h / 2);
        gl.uniform1f(U.uTile, tile * dpr);
        gl.uniform1f(U.uTexSize, TEX);
        gl.uniform1f(U.uBoxFrac, BOX);
        for (const k in fr) {
          if (typeof fr[k] === 'number' && U[k]) gl.uniform1f(U[k], fr[k]);
        }
        gl.uniform3fv(U.uBg, fr.uBg);
        gl.uniform3fv(U.uPlateCol, fr.uPlateCol);
        gl.uniform3fv(U.uLogoCol, fr.uLogoCol);
        gl.uniform2fv(U.uLogoOff, fr.uLogoOff);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (t >= END_TIME + 0.25) {
          clearTimeout(hardTimeout);
          dismiss();
        } else {
          raf = requestAnimationFrame(tick);
        }
      }

      raf = requestAnimationFrame(tick);
    };
  } catch (e) {
    clearTimeout(hardTimeout);
    dismiss();
  }
})();