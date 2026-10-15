/* Missouri State Fair — hero drone show.
   A few thousand GPU-rendered "drones" launch from behind the fairground
   skyline and fly choreographed formations, with fireworks between shapes.
   Raw WebGL, no dependencies. Respects reduced motion, pauses off-screen,
   and steps aside (static hero) if WebGL is unavailable. */

(() => {
  const hero = document.querySelector(".show-hero");
  const canvas = document.getElementById("drone-canvas");
  if (!hero || !canvas) return;

  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) {
    hero.classList.add("no-webgl");
    return;
  }
  hero.classList.add("has-show");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const copy = hero.querySelector(".show-copy");
  const caption = document.getElementById("show-caption");
  const playBtn = document.getElementById("show-toggle");
  const dotsWrap = document.getElementById("show-dots");

  /* ---------------- Colors ---------------- */
  const C = {
    white: [1, 0.97, 0.92],
    gold: [1, 0.74, 0.22],
    red: [1, 0.22, 0.27],
    blue: [0.35, 0.6, 1],
    purple: [0.68, 0.42, 1],
    dim: [0.35, 0.4, 0.55],
  };
  const hex = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;

  /* ---------------- Missouri outline (normalized, x-scaled by cos(lat)) ---------------- */
  const MO = [0.5929,0.0011,0.6086,0,0.6391,0.039,0.6557,0.0454,0.6424,0.0728,0.6441,0.1118,0.6631,0.1709,0.7093,0.2205,0.7597,0.2617,0.7696,0.325,0.7812,0.3366,0.7985,0.3187,0.8315,0.3271,0.853,0.3408,0.8382,0.364,0.8423,0.382,0.8167,0.4316,0.8159,0.4622,0.8604,0.5012,0.877,0.5265,0.8935,0.5223,0.9422,0.5634,0.9422,0.593,0.9546,0.6299,0.9422,0.6426,0.9761,0.6974,1,0.6996,0.9876,0.7776,0.9653,0.7692,0.9571,0.7935,0.9472,0.7935,0.9389,0.7935,0.9397,0.8409,0.91,0.8895,0.8126,0.8895,0.8365,0.8536,0.8596,0.8304,0.8464,0.7935,0.1949,0.7924,0.1734,0.7924,0.1734,0.6964,0.1742,0.2807,0.142,0.2712,0.1181,0.2258,0.0991,0.2068,0.1329,0.1509,0.0842,0.1361,0.0694,0.1182,0.0322,0.0675,0,0.0053,0.1709,0.0084,0.3782,0.0063,0.5929,0.0011];
  const MO_ASPECT = 1 / 0.8895;
  const SEDALIA = [0.3827, 0.3681];

  /* ---------------- Sizing ---------------- */
  let W = 0, H = 0, DPR = 1, N = 0, region = { x: 0, y: 0, w: 1, h: 1 };
  const STARS = 170, SPARKS = 900;

  function measure() {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    const copyTop = copy ? copy.getBoundingClientRect().top - r.top : H * 0.6;
    const padX = W < 700 ? 14 : Math.max(40, W * 0.06);
    const top = Math.max(18, H * 0.05);
    region = { x: padX, y: top, w: W - padX * 2, h: Math.max(140, copyTop - top - (W < 700 ? 18 : 34)) };
  }

  /* ---------------- Raster formations (sample a drawn shape) ---------------- */
  const off = document.createElement("canvas");
  const octx = off.getContext("2d", { willReadFrequently: true });

  function rasterSample(draw, count) {
    const w = Math.round(region.w), h = Math.round(region.h);
    off.width = w;
    off.height = h;
    octx.clearRect(0, 0, w, h);
    draw(octx, w, h);
    const data = octx.getImageData(0, 0, w, h).data;
    let filled = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 140) filled++;
    let step = Math.max(2, Math.sqrt(filled / count));
    let pts = [];
    for (let tries = 0; tries < 6; tries++) {
      pts = [];
      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          const k = ((y | 0) * w + (x | 0)) * 4;
          if (data[k + 3] > 140) pts.push([x + region.x, y + region.y, data[k] / 255, data[k + 1] / 255, data[k + 2] / 255]);
        }
      }
      if (pts.length >= count * 0.92 && pts.length <= count * 1.15) break;
      step *= Math.sqrt(pts.length / count);
    }
    // Exact count: thin evenly, or top up by doubling random points with jitter.
    if (pts.length > count) {
      const out = [];
      for (let i = 0; i < count; i++) out.push(pts[Math.floor((i * pts.length) / count)]);
      pts = out;
    }
    while (pts.length < count && pts.length) {
      const p = pts[(Math.random() * pts.length) | 0];
      pts.push([p[0] + (Math.random() - 0.5) * step, p[1] + (Math.random() - 0.5) * step, p[2], p[3], p[4]]);
    }
    return pts.map((p) => ({ x: p[0], y: p[1], c: [p[2], p[3], p[4]], kind: 0 }));
  }

  const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
  function drawLines(ctx, w, h, lines) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // Fit: widest line to width, stacked lines to height.
    let size = 100;
    ctx.font = `800 ${size}px ${FONT}`;
    const widths = lines.map((l) => ctx.measureText(l.t).width / size * (l.s || 1));
    const totalH = lines.reduce((a, l) => a + (l.s || 1) * 0.86, 0) + (lines.length - 1) * 0.08;
    size = Math.min((w * 0.98) / Math.max(...widths), (h * 0.98) / totalH);
    let y = (h - size * totalH) / 2;
    for (const l of lines) {
      const s = size * (l.s || 1);
      ctx.font = `800 ${s}px ${FONT}`;
      ctx.fillStyle = hex(l.c);
      y += s * 0.86;
      ctx.fillText(l.t, w / 2, y);
      y += size * 0.08;
    }
  }

  const FORMATIONS = [
    {
      label: "Missouri State Fair",
      build: (n) =>
        rasterSample((ctx, w, h) => {
          const wide = w / h > 2.1;
          drawLines(ctx, w, h, wide
            ? [{ t: "MISSOURI", c: C.white }, { t: "STATE FAIR", c: C.gold }]
            : [{ t: "MISSOURI", c: C.white }, { t: "STATE", c: C.gold }, { t: "FAIR", c: C.gold }]);
        }, n),
    },
    {
      label: "The midway wheel, turning",
      build: buildWheel,
    },
    {
      label: "★ Sedalia — the Fair’s home since 1901",
      build: (n) =>
        rasterSample((ctx, w, h) => {
          const mh = Math.min(h * 0.96, (w * 0.96) / MO_ASPECT);
          const mw = mh * MO_ASPECT;
          const ox = (w - mw) / 2, oy = (h - mh) / 2;
          const sx = mw, sy = mh / 0.8895;
          ctx.beginPath();
          for (let i = 0; i < MO.length; i += 2) ctx.lineTo(ox + MO[i] * sx, oy + MO[i + 1] * sy);
          ctx.closePath();
          ctx.fillStyle = hex(C.blue);
          ctx.fill();
          ctx.lineWidth = Math.max(8, mh * 0.035);
          ctx.lineJoin = "round";
          ctx.strokeStyle = hex(C.red);
          ctx.stroke();
          star(ctx, ox + SEDALIA[0] * sx, oy + SEDALIA[1] * sy, mh * 0.15, C.gold);
        }, n),
    },
    {
      label: "Aug 12–22, 2027",
      build: (n) =>
        rasterSample((ctx, w, h) => {
          const wide = w / h > 1.9;
          drawLines(ctx, w, h, wide
            ? [{ t: "AUG 12–22", c: C.gold }, { t: "2027 · SEDALIA", c: C.white, s: 0.62 }]
            : [{ t: "AUG", c: C.gold }, { t: "12–22", c: C.gold }, { t: "2027", c: C.white, s: 0.7 }]);
        }, n),
    },
    {
      label: "Grand Champion purple — since 1901",
      build: (n) =>
        rasterSample((ctx, w, h) => {
          const R = Math.min(w * 0.3, h * 0.36);
          const cx = w / 2, cy = h * 0.42;
          // Tails
          ctx.fillStyle = hex([0.55, 0.3, 0.9]);
          for (const dir of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(cx + dir * R * 0.12, cy + R * 0.4);
            ctx.lineTo(cx + dir * R * 0.62, cy + R * 0.4);
            ctx.lineTo(cx + dir * R * 0.78, cy + R * 1.55);
            ctx.lineTo(cx + dir * R * 0.5, cy + R * 1.35);
            ctx.lineTo(cx + dir * R * 0.3, cy + R * 1.6);
            ctx.closePath();
            ctx.fill();
          }
          // Pleated petals
          ctx.fillStyle = hex(C.purple);
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86, R * 0.17, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = hex(C.gold);
          ctx.beginPath(); ctx.arc(cx, cy, R * 0.68, 0, Math.PI * 2); ctx.fill();
          // Dark center with "1901" lettered in white drones
          ctx.globalCompositeOperation = "destination-out";
          ctx.beginPath(); ctx.arc(cx, cy, R * 0.56, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = hex(C.white);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `800 ${R * 0.56}px ${FONT}`;
          ctx.fillText("1901", cx, cy + R * 0.04);
          ctx.globalCompositeOperation = "source-over";
        }, n),
    },
  ];

  function star(ctx, x, y, r, c) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = hex(c);
    ctx.fill();
  }

  /* Ferris wheel: procedural, with rotating rim/spokes and gondolas that hang level. */
  function buildWheel(n) {
    const R = Math.min(region.w * 0.36, (region.h * 0.94) / 2.25);
    const cx = region.x + region.w / 2;
    const cy = region.y + R * 1.06;
    const base = cy + R * 1.13;
    const pts = [];
    const add = (count, fn) => { for (let i = 0; i < count; i++) pts.push(fn(i, count)); };
    const legs = Math.round(n * 0.08), rim = Math.round(n * 0.3), inner = Math.round(n * 0.1),
      spokes = Math.round(n * 0.18), hub = Math.round(n * 0.03);
    const gond = n - legs - rim - inner - spokes - hub;
    const G = 16;
    add(legs, (i, k) => {
      const side = i % 2 ? 1 : -1, t = (i >> 1) / (k / 2);
      return { x: cx + side * t * R * 0.62, y: cy + t * (base - cy), c: C.blue, kind: 0 };
    });
    add(rim, (i, k) => {
      const a = (i / k) * Math.PI * 2;
      const seg = Math.floor((i / k) * 48) % 3;
      return { rx: Math.cos(a) * R, ry: Math.sin(a) * R, c: seg === 0 ? C.red : seg === 1 ? C.gold : C.white, kind: 1 };
    });
    add(inner, (i, k) => {
      const a = (i / k) * Math.PI * 2;
      return { rx: Math.cos(a) * R * 0.7, ry: Math.sin(a) * R * 0.7, c: C.gold, kind: 1 };
    });
    add(spokes, (i, k) => {
      const s = i % G, t = 0.12 + (Math.floor(i / G) / Math.ceil(k / G)) * 0.88;
      const a = (s / G) * Math.PI * 2;
      return { rx: Math.cos(a) * R * t, ry: Math.sin(a) * R * t, c: C.white, kind: 1 };
    });
    add(hub, (i, k) => {
      const a = (i / k) * Math.PI * 2, r = R * 0.07 * Math.sqrt((i % 5) / 4);
      return { rx: Math.cos(a) * r, ry: Math.sin(a) * r, c: C.gold, kind: 1 };
    });
    const per = Math.ceil(gond / G);
    add(gond, (i) => {
      const g = i % G, j = Math.floor(i / G);
      const a = (g / G) * Math.PI * 2;
      const cols = 4, gx = (j % cols) / (cols - 1) - 0.5, gy = Math.floor(j / cols) / Math.max(1, Math.ceil(per / cols) - 1);
      const tint = [C.red, C.blue, C.gold, C.purple][g % 4];
      return { rx: Math.cos(a) * R, ry: Math.sin(a) * R, ox: gx * R * 0.16, oy: R * 0.06 + gy * R * 0.12, c: tint, kind: 2 };
    });
    pts.forEach((p) => { p.cx = cx; p.cy = cy; if (p.kind) { p.x = cx + p.rx + (p.ox || 0); p.y = cy + p.ry + (p.oy || 0); } });
    return pts;
  }

  /* ---------------- Drones ---------------- */
  let drones = [];
  let formationIndex = 0;
  let targets = [];
  let wheelAngle = 0;
  let clock = 0;
  let nextSwitchAt = 0;
  const HOLD = 6.2;

  function makeDrones() {
    N = W < 700 ? 1100 : W < 1200 ? 1700 : 2200;
    drones = Array.from({ length: N }, () => ({
      x: W * (0.08 + Math.random() * 0.84),
      y: H + 10 + Math.random() * 40,
      vx: 0, vy: 0,
      tx: 0, ty: 0,
      ptx: 0, pty: 0,
      c: [C.dim[0], C.dim[1], C.dim[2]],
      tc: C.white,
      wait: 0,
      ph: Math.random() * 6.283,
      tw: 0.6 + Math.random() * 0.8,
      t: null,
    }));
  }

  function assign(index, delayed) {
    formationIndex = index;
    targets = FORMATIONS[index].build(N);
    // Choreography: match drones to targets by horizontal order so the swarm
    // sweeps across instead of crisscrossing; launch in a left-to-right wave.
    const order = drones.map((d, i) => i).sort((a, b) => drones[a].x - drones[b].x);
    const tOrder = targets.map((t, i) => i).sort((a, b) => targets[a].x - targets[b].x);
    order.forEach((di, rank) => {
      const d = drones[di];
      d.t = targets[tOrder[rank]];
      d.wait = delayed ? (rank / N) * (clock < 0.5 ? 2.4 : 1.1) + Math.random() * 0.25 : 0;
      if (!delayed) { d.x = d.t.x; d.y = d.t.y; d.vx = d.vy = 0; d.c = d.t.c.slice(); }
    });
    if (caption) caption.textContent = FORMATIONS[index].label;
    if (dotsWrap) [...dotsWrap.children].forEach((b, i) => b.setAttribute("aria-current", String(i === index)));
    nextSwitchAt = clock + HOLD + (clock < 0.5 ? 2.2 : 0);
    if (delayed && clock > 0.5) volley(3);
  }

  function targetOf(t) {
    if (t.kind === 0) return [t.x, t.y];
    const ca = Math.cos(wheelAngle), sa = Math.sin(wheelAngle);
    const x = t.cx + t.rx * ca - t.ry * sa;
    const y = t.cy + t.rx * sa + t.ry * ca;
    return t.kind === 2 ? [x + t.ox, y + t.oy] : [x, y];
  }

  /* ---------------- Fireworks ---------------- */
  const sparks = Array.from({ length: SPARKS }, () => ({ life: 0 }));
  const shells = [];
  const PALETTE = [C.red, C.gold, C.white, C.blue, C.purple];

  function volley(count) {
    for (let i = 0; i < count; i++) {
      const side = Math.random() < 0.5 ? 0.06 + Math.random() * 0.24 : 0.7 + Math.random() * 0.24;
      shells.push({
        x: W * side, y: H + 5,
        vx: (Math.random() - 0.5) * 40,
        vy: -(H * 0.95 + Math.random() * H * 0.35),
        delay: i * 0.3,
        fuse: 0.85 + Math.random() * 0.35,
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
      });
    }
  }

  function burst(x, y, c) {
    const count = W < 700 ? 60 : 110;
    let made = 0;
    for (const s of sparks) {
      if (s.life > 0) continue;
      const a = Math.random() * Math.PI * 2, sp = (0.55 + Math.random() * 0.45) * (W < 700 ? 150 : 230);
      Object.assign(s, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.45 + Math.random() * 0.3, c, size: 1 });
      if (++made >= count) break;
    }
  }

  function trail(x, y) {
    for (const s of sparks) {
      if (s.life > 0) continue;
      Object.assign(s, { x, y, vx: (Math.random() - 0.5) * 20, vy: 30, life: 0.5, decay: 1.6, c: C.gold, size: 0.7 });
      return;
    }
  }

  /* ---------------- Stars ---------------- */
  let stars = [];
  function makeStars() {
    stars = Array.from({ length: STARS }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.75, b: 0.15 + Math.random() * 0.4, ph: Math.random() * 6.28 }));
  }

  /* ---------------- Pointer: the swarm parts around your cursor ---------------- */
  const pointer = { x: -9999, y: -9999, active: false };
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.active = true;
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { pointer.active = false; pointer.x = pointer.y = -9999; });

  /* ---------------- WebGL ---------------- */
  const vs = `
    attribute vec2 aPos; attribute float aSize; attribute vec4 aCol;
    uniform vec2 uRes; uniform float uDpr;
    varying vec4 vCol;
    void main() {
      vec2 p = aPos / uRes * 2.0 - 1.0;
      gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
      gl_PointSize = aSize * uDpr;
      vCol = aCol;
    }`;
  const fs = `
    precision mediump float;
    varying vec4 vCol;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      float core = smoothstep(0.24, 0.0, d);
      float halo = exp(-d * d * 6.0) * 0.42;
      float a = (core + halo) * vCol.a;
      gl_FragColor = vec4(mix(vCol.rgb, vec3(1.0), core * 0.55) * a, a);
    }`;
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    hero.classList.remove("has-show");
    hero.classList.add("no-webgl");
    return;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const STRIDE = 7;
  const loc = (n) => gl.getAttribLocation(prog, n);
  const aPos = loc("aPos"), aSize = loc("aSize"), aCol = loc("aCol");
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aSize);
  gl.enableVertexAttribArray(aCol);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, STRIDE * 4, 0);
  gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, STRIDE * 4, 8);
  gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, STRIDE * 4, 12);
  const uRes = gl.getUniformLocation(prog, "uRes"), uDpr = gl.getUniformLocation(prog, "uDpr");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  let vbo = new Float32Array(0);

  /* ---------------- Simulation + draw ---------------- */
  function step(dt) {
    clock += dt;
    wheelAngle += dt * 0.32;
    if (clock >= nextSwitchAt) assign((formationIndex + 1) % FORMATIONS.length, true);

    const stiff = 16, damp = Math.exp(-6.5 * dt);
    const R = W < 700 ? 70 : 120;
    for (const d of drones) {
      if (d.wait > 0) { d.wait -= dt; continue; }
      const [tx, ty] = targetOf(d.t);
      const hx = Math.sin(clock * 0.9 * d.tw + d.ph) * 1.4, hy = Math.cos(clock * 1.1 * d.tw + d.ph) * 1.4;
      d.vx += (tx + hx - d.x) * stiff * dt;
      d.vy += (ty + hy - d.y) * stiff * dt;
      if (pointer.active) {
        const dx = d.x - pointer.x, dy = d.y - pointer.y, dist = Math.hypot(dx, dy);
        if (dist < R && dist > 0.01) {
          const f = (1 - dist / R) ** 2 * 5200 * dt;
          d.vx += (dx / dist) * f;
          d.vy += (dy / dist) * f;
        }
      }
      d.vx *= damp;
      d.vy *= damp;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const k = Math.min(1, dt * 2.2);
      d.c[0] += (d.t.c[0] - d.c[0]) * k;
      d.c[1] += (d.t.c[1] - d.c[1]) * k;
      d.c[2] += (d.t.c[2] - d.c[2]) * k;
    }

    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.fuse -= dt;
      s.vy += 520 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (Math.random() < 0.7) trail(s.x, s.y);
      if (s.vy >= -60 || s.fuse <= 0) {
        burst(s.x, s.y, s.c);
        shells.splice(i, 1);
      }
    }
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.vy += 70 * dt;
      s.vx *= Math.exp(-1.3 * dt);
      s.vy *= Math.exp(-1.3 * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= s.decay * dt;
    }
  }

  function draw() {
    const total = STARS + N + SPARKS;
    if (vbo.length !== total * STRIDE) vbo = new Float32Array(total * STRIDE);
    let o = 0;
    const put = (x, y, size, r, g, b, a) => {
      vbo[o++] = x; vbo[o++] = y; vbo[o++] = size; vbo[o++] = r; vbo[o++] = g; vbo[o++] = b; vbo[o++] = a;
    };
    for (const s of stars) {
      put(s.x, s.y, 4, 0.8, 0.85, 1, s.b * (0.7 + 0.3 * Math.sin(clock * 1.7 + s.ph)));
    }
    const ds = W < 700 ? 10 : 14;
    for (const d of drones) {
      const flicker = 0.85 + 0.15 * Math.sin(clock * 6 * d.tw + d.ph);
      const a = d.wait > 0 ? 0.0 : flicker;
      put(d.x, d.y, ds, d.c[0], d.c[1], d.c[2], a);
    }
    for (const s of sparks) {
      if (s.life <= 0) { put(-50, -50, 0, 0, 0, 0, 0); continue; }
      const l = Math.max(0, s.life);
      put(s.x, s.y, (W < 700 ? 9 : 13) * s.size * (0.6 + 0.4 * l), s.c[0], s.c[1], s.c[2], Math.min(1, l * 1.3));
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uDpr, DPR);
    gl.bufferData(gl.ARRAY_BUFFER, vbo, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, total);
  }

  /* ---------------- Loop, visibility, controls ---------------- */
  let running = false, visible = true, userPaused = reduceMotion, raf = 0, last = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    const should = visible && !userPaused && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; cancelAnimationFrame(raf); }
    if (playBtn) {
      playBtn.setAttribute("aria-pressed", String(!userPaused));
      playBtn.querySelector("span").textContent = userPaused ? "Play show" : "Pause show";
      hero.classList.toggle("is-paused", userPaused);
    }
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(hero);
  document.addEventListener("visibilitychange", sync);

  if (playBtn) playBtn.addEventListener("click", () => { userPaused = !userPaused; sync(); });

  if (dotsWrap) {
    FORMATIONS.forEach((f, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "show-dot";
      b.setAttribute("aria-label", `Show formation: ${f.label}`);
      b.addEventListener("click", () => {
        assign(i, running);
        if (!running) draw();
      });
      dotsWrap.appendChild(b);
    });
  }

  let resizeTimer = 0;
  function setup(first) {
    measure();
    if (first || drones.length !== (W < 700 ? 1100 : W < 1200 ? 1700 : 2200)) makeDrones();
    makeStars();
    assign(formationIndex, first && !reduceMotion);
    draw();
  }
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = hero.getBoundingClientRect().width;
      if (Math.abs(w - W) > 2) setup(false);
    }, 160);
  });

  // Wait for the display face so lettered formations sample the real glyphs.
  const ready = document.fonts && document.fonts.load ? document.fonts.load(`800 100px "Barlow Condensed"`) : Promise.resolve();
  ready.catch(() => {}).then(() => {
    setup(true);
    if (reduceMotion) {
      // Still a show, just not a moving one: render the date formation statically.
      assign(3, false);
      draw();
    } else {
      setTimeout(() => volley(4), 2600);
    }
    sync();
  });
})();
