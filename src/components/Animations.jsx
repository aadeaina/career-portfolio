// Canvas animations. Each scene is a pure draw(ctx, w, h, t, s) function; the
// shared hook handles DPR, resizing, pausing off-screen and reduced motion.
import { useEffect, useRef } from "react";

const C = {
  cyan: "#5EEAD4", blue: "#60A5FA", violet: "#A78BFA", amber: "#FBBF24",
  rose: "#FB7185", green: "#4ADE80", ink: "rgba(226,236,248,0.92)", dim: "rgba(160,184,210,0.55)",
  faint: "rgba(120,150,185,0.18)",
};
const MONO = "500 11px 'JetBrains Mono', ui-monospace, monospace";
const SANS = "600 12px Inter, system-ui, sans-serif";
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const rand = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

function useCanvas(draw, init) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const state = init ? init() : {};
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, visible = true, start = performance.now();
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce || !visible) frame(performance.now());
    };
    const frame = (now) => {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h, reduce ? 6.5 : (now - start) / 1000, state);
    };
    const loop = (now) => { frame(now); if (!reduce && visible) raf = requestAnimationFrame(loop); };
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !reduce) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);
    resize();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [draw, init]);
  return ref;
}

function label(ctx, text, x, y, color = C.ink, font = MONO, align = "left") {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(text, x, y);
}
function glowDot(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, color); g.addColorStop(0.35, color + "88"); g.addColorStop(1, color + "00");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
}
function brackets(ctx, x, y, w, h, len, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, dx, dy]) => {
    ctx.moveTo(px + dx * len, py); ctx.lineTo(px, py); ctx.lineTo(px, py + dy * len);
  });
  ctx.stroke();
}

/* ---------------- 1. Drones scanning & tracking ---------------- */
const droneInit = () => {
  const r = rand(7);
  return {
    terrain: Array.from({ length: 90 }, () => [r(), r(), r()]),
    targets: Array.from({ length: 5 }, (_, i) => ({ id: `T-${(i + 1) * 17}`, a: r() * 6.28, sp: 0.05 + r() * 0.06, rx: 0.15 + r() * 0.3, ry: 0.12 + r() * 0.25, cx: 0.3 + r() * 0.4, cy: 0.3 + r() * 0.4 })),
    drones: [0, 1, 2].map((i) => ({ id: `UAV-${i + 1}`, ph: i * 2.1, fx: 0.11 + i * 0.03, fy: 0.17 - i * 0.02, trail: [] })),
  };
};
function drawDrones(ctx, w, h, t, s) {
  // map grid + terrain contours
  ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  s.terrain.forEach(([x, y, z]) => {
    ctx.strokeStyle = `rgba(94,234,212,${0.05 + z * 0.08})`;
    ctx.beginPath(); ctx.ellipse(x * w, y * h, 8 + z * 26, 5 + z * 16, z * 3, 0, 6.28); ctx.stroke();
  });
  const targets = s.targets.map((g) => ({ ...g, x: (g.cx + Math.cos(g.a + t * g.sp) * g.rx) * w, y: (g.cy + Math.sin((g.a + t * g.sp) * 1.3) * g.ry) * h }));
  targets.forEach((g) => { ctx.fillStyle = C.dim; ctx.fillRect(g.x - 3, g.y - 3, 6, 6); });

  s.drones.forEach((d, i) => {
    const ox = [0.25, 0.5, 0.75][i];
    const x = w * (ox + 0.2 * Math.sin(t * d.fx * 2 + d.ph));
    const y = h * (0.5 + 0.3 * Math.sin(t * d.fy * 2 + d.ph * 1.7));
    d.trail.push([x, y]); if (d.trail.length > 70) d.trail.shift();
    ctx.strokeStyle = "rgba(96,165,250,0.35)"; ctx.setLineDash([3, 5]); ctx.beginPath();
    d.trail.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke(); ctx.setLineDash([]);
    const R = Math.min(w, h) * 0.2;
    // scan footprint + rotating sweep
    ctx.strokeStyle = "rgba(94,234,212,0.25)"; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.28); ctx.stroke();
    const ang = t * 2.2 + i * 2;
    const sweep = ctx.createRadialGradient(x, y, 0, x, y, R);
    sweep.addColorStop(0, "rgba(94,234,212,0.28)"); sweep.addColorStop(1, "rgba(94,234,212,0)");
    ctx.fillStyle = sweep; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, R, ang, ang + 0.7); ctx.closePath(); ctx.fill();
    // tracking
    targets.forEach((g) => {
      const dist = Math.hypot(g.x - x, g.y - y);
      if (dist < R) {
        ctx.strokeStyle = "rgba(251,191,36,0.5)"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(g.x, g.y); ctx.stroke();
        brackets(ctx, g.x - 13, g.y - 13, 26, 26, 6, C.amber);
        label(ctx, `${g.id} ${(0.82 + (1 - dist / R) * 0.17).toFixed(2)}`, g.x + 17, g.y - 10, C.amber);
      }
    });
    // drone body (quad)
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.4 + i);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, 9); ctx.moveTo(9, -9); ctx.lineTo(-9, 9); ctx.stroke();
    [[-9, -9], [9, 9], [9, -9], [-9, 9]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 4.5, 0, 6.28); ctx.stroke(); });
    ctx.restore();
    glowDot(ctx, x, y, 2.5, C.cyan);
    label(ctx, d.id, x + 14, y + 16, C.cyan);
  });
  label(ctx, `SCAN  ·  ${s.drones.length} UAV  ·  ${targets.length} contacts`, 12, 16, C.dim);
}

/* ---------------- 2. Point cloud forming ---------------- */
const cloudInit = () => {
  const r = rand(42), N = 1100, pts = [];
  for (let i = 0; i < N; i++) {
    let x, y, z;
    if (i < N * 0.72) { // terrain surface
      x = r() * 2 - 1; z = r() * 2 - 1;
      y = -0.55 + 0.18 * Math.sin(x * 3.1) * Math.cos(z * 2.4) + 0.06 * Math.sin(x * 9 + z * 7);
    } else { // a building block
      const f = Math.floor(r() * 5), u = r(), v = r();
      const bx = 0.15, bz = -0.1, sx = 0.32, sz = 0.28, top = 0.35, base = -0.5;
      if (f === 0) { x = bx + (u - 0.5) * sx; z = bz + (v - 0.5) * sz; y = top; }
      else if (f < 3) { x = bx + (f === 1 ? -0.5 : 0.5) * sx; z = bz + (u - 0.5) * sz; y = base + v * (top - base); }
      else { z = bz + (f === 3 ? -0.5 : 0.5) * sz; x = bx + (u - 0.5) * sx; y = base + v * (top - base); }
    }
    pts.push({ t: [x, y, z], s: [(r() * 2 - 1) * 1.6, (r() * 2 - 1) * 1.6, (r() * 2 - 1) * 1.6], d: r() * 0.35 });
  }
  // occupied octree cells (level 2: 4x4x4)
  const cells = new Map();
  pts.forEach((p) => {
    const k = p.t.map((v) => Math.min(3, Math.floor(((v + 1) / 2) * 4))).join(",");
    cells.set(k, (cells.get(k) || 0) + 1);
  });
  const boxes = [...cells.entries()].filter(([, n]) => n > 12).map(([k]) => k.split(",").map(Number));
  return { pts, boxes };
};
function drawCloud(ctx, w, h, t, s) {
  const cyc = 12, p = (t % cyc) / cyc;
  const form = p < 0.08 ? 0 : p < 0.45 ? (p - 0.08) / 0.37 : p < 0.88 ? 1 : 1 - (p - 0.88) / 0.12;
  const rot = t * 0.35, cr = Math.cos(rot), sr = Math.sin(rot), tilt = 0.42, ct = Math.cos(tilt), st = Math.sin(tilt);
  const sc = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2 + 18;
  const proj = ([x, y, z]) => {
    const X = x * cr - z * sr, Z = x * sr + z * cr;
    const Y = y * ct - Z * st, Z2 = y * st + Z * ct;
    const k = 2.6 / (2.6 + Z2);
    return [cx + X * sc * k, cy - Y * sc * k, Z2];
  };
  // octree boxes
  const boxA = clamp01((p - 0.42) / 0.12) * (p < 0.88 ? 1 : 1 - (p - 0.88) / 0.12);
  if (boxA > 0) {
    ctx.strokeStyle = `rgba(167,139,250,${0.16 * boxA})`; ctx.lineWidth = 0.7;
    const shown = Math.floor(s.boxes.length * clamp01((p - 0.42) / 0.25));
    s.boxes.slice(0, shown).forEach(([i, j, k]) => {
      const a = [i, j, k].map((v) => v / 2 - 1), b = a.map((v) => v + 0.5);
      const c = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => proj([n & 1 ? b[0] : a[0], n & 2 ? b[1] : a[1], n & 4 ? b[2] : a[2]]));
      ctx.beginPath();
      [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([m, n]) => { ctx.moveTo(c[m][0], c[m][1]); ctx.lineTo(c[n][0], c[n][1]); });
      ctx.stroke();
    });
  }
  // lidar sweep plane
  const sweepX = -1 + ((t * 0.5) % 1) * 2;
  s.pts.forEach((pt) => {
    const e = ease(clamp01((form - pt.d) / (1 - 0.35)));
    const q = [0, 1, 2].map((n) => pt.s[n] + (pt.t[n] - pt.s[n]) * e);
    const [x, y, z] = proj(q);
    const near = Math.abs(pt.t[0] - sweepX) < 0.05 && e > 0.95;
    const hgt = clamp01((pt.t[1] + 0.75) / 1.1);
    ctx.fillStyle = near ? C.amber : `hsla(${190 - hgt * 120},85%,${60 + hgt * 10}%,${0.35 + (1 - (z + 1.5) / 3) * 0.6})`;
    const r = near ? 1.9 : 1.2;
    ctx.fillRect(x - r / 2, y - r / 2, r, r);
  });
  const stage = form < 0.02 ? "raw returns" : form < 1 ? "registering points" : boxA > 0 ? "octree index · LOD 2" : "surface reconstructed";
  label(ctx, `LIDAR  ·  ${s.pts.length} pts  ·  ${stage}`, 12, 16, C.dim);
  label(ctx, `occupied cells ${s.boxes.length}`, w - 12, 16, C.violet, MONO, "right");
}

/* ---------------- 3. Packets moving through domains & layers ---------------- */
const DOMAINS = [
  { name: "Device", sub: "L1–L2", color: C.cyan },
  { name: "Edge", sub: "WAF · TLS", color: C.blue },
  { name: "Fabric", sub: "BGP · VXLAN", color: C.violet },
  { name: "Cloud", sub: "VPC · K8s", color: C.amber },
  { name: "App", sub: "REST · events", color: C.green },
  { name: "AI", sub: "agents · tools", color: C.rose },
];
const packetInit = () => ({ packets: [], last: 0, r: rand(3), nodes: DOMAINS.map((_, i) => [0.22, 0.42, 0.62, 0.82].map((y, k) => y + ((i + k) % 2 ? 0.03 : -0.03))) });
function drawPackets(ctx, w, h, t, s) {
  const n = DOMAINS.length, colW = w / n, top = 44;
  const nodeXY = (i, k) => [colW * (i + 0.5), top + (h - top - 14) * s.nodes[i][k]];
  DOMAINS.forEach((d, i) => {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(i * colW, top - 8, colW, h - top);
    label(ctx, d.name, colW * (i + 0.5), 14, d.color, SANS, "center");
    if (colW >= 92) label(ctx, d.sub, colW * (i + 0.5), 29, C.dim, MONO, "center");
    for (let k = 0; k < 4; k++) {
      const [x, y] = nodeXY(i, k);
      if (i < n - 1) for (let m = 0; m < 4; m++) { const [x2, y2] = nodeXY(i + 1, m); ctx.strokeStyle = "rgba(140,170,210,0.08)"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); }
    }
  });
  DOMAINS.forEach((d, i) => { for (let k = 0; k < 4; k++) { const [x, y] = nodeXY(i, k); ctx.fillStyle = "#0e1c2b"; ctx.strokeStyle = d.color + "aa"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.roundRect(x - 9, y - 6, 18, 12, 3); ctx.fill(); ctx.stroke(); } });
  if (t - s.last > 0.35) { s.last = t; s.packets.push({ born: t, route: DOMAINS.map(() => Math.floor(s.r() * 4)), back: s.r() < 0.3 }); }
  s.packets = s.packets.filter((p) => t - p.born < 4.2);
  s.packets.forEach((p) => {
    const prog = ((t - p.born) / 4.2) * (n - 1);
    const seg = Math.min(n - 2, Math.floor(prog)), f = ease(prog - seg);
    const idx = (k) => (p.back ? n - 1 - k : k);
    const [x1, y1] = nodeXY(idx(seg), p.route[seg]);
    const [x2, y2] = nodeXY(idx(seg + 1), p.route[seg + 1]);
    const x = x1 + (x2 - x1) * f, y = y1 + (y2 - y1) * f;
    const dom = DOMAINS[idx(Math.round(prog))];
    // encapsulation: header rings grow toward the middle of the path, shrink at the far end
    const depth = Math.round(Math.min(prog, n - 1 - prog)) + 1;
    for (let r = depth; r > 0; r--) { ctx.strokeStyle = DOMAINS[(idx(0) + r) % n].color + "66"; ctx.beginPath(); ctx.arc(x, y, 3 + r * 2.6, 0, 6.28); ctx.stroke(); }
    glowDot(ctx, x, y, 2.6, dom.color);
  });
  label(ctx, `${s.packets.length} in flight  ·  rings = encapsulated headers`, 12, h - 10, C.dim);
}

/* ---------------- 4. Handshake & transaction handling ---------------- */
const HS = [
  { m: "SYN", d: 1, c: C.blue, ph: "TCP" }, { m: "SYN-ACK", d: -1, c: C.blue, ph: "TCP" }, { m: "ACK", d: 1, c: C.blue, ph: "TCP" },
  { m: "ClientHello · key_share", d: 1, c: C.violet, ph: "TLS 1.3" }, { m: "ServerHello · cert · Finished", d: -1, c: C.violet, ph: "TLS 1.3" },
  { m: "Finished", d: 1, c: C.violet, ph: "TLS 1.3" },
  { m: "POST /orders  Idempotency-Key", d: 1, c: C.amber, ph: "TXN" }, { m: "BEGIN · INSERT · COMMIT", d: 2, c: C.green, ph: "TXN" },
  { m: "201 Created", d: -1, c: C.green, ph: "TXN" },
];
function drawHandshake(ctx, w, h, t) {
  const cols = [w * 0.14, w * 0.56, w * 0.88], names = ["Client", "API server", "Database"];
  const top = 46, rowH = (h - top - 18) / HS.length, per = 0.9, cyc = HS.length * per + 2.5, lt = t % cyc;
  names.forEach((n, i) => {
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.strokeStyle = "rgba(160,190,230,0.35)";
    ctx.beginPath(); ctx.roundRect(cols[i] - 46, 10, 92, 24, 8); ctx.fill(); ctx.stroke();
    label(ctx, n, cols[i], 22, C.ink, SANS, "center");
    ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(160,190,230,0.25)"; ctx.beginPath(); ctx.moveTo(cols[i], 36); ctx.lineTo(cols[i], h - 8); ctx.stroke(); ctx.setLineDash([]);
  });
  HS.forEach((s, i) => {
    const st = i * per, p = clamp01((lt - st) / (per * 0.8));
    if (p <= 0) return;
    const y = top + rowH * (i + 0.5);
    const [a, b] = s.d === 2 ? [cols[1], cols[2]] : s.d === 1 ? [cols[0], cols[1]] : [cols[1], cols[0]];
    const x = a + (b - a) * ease(p);
    ctx.strokeStyle = s.c; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(x, y); ctx.stroke();
    if (p >= 1) { const dir = Math.sign(b - a); ctx.fillStyle = s.c; ctx.beginPath(); ctx.moveTo(b, y); ctx.lineTo(b - dir * 7, y - 4); ctx.lineTo(b - dir * 7, y + 4); ctx.fill(); }
    else glowDot(ctx, x, y, 2.6, s.c);
    label(ctx, s.m, (a + b) / 2, y - 8, p >= 1 ? C.ink : C.dim, MONO, "center");
    if (i === 0 || HS[i - 1].ph !== s.ph) label(ctx, s.ph, 8, y, s.c, "600 10px Inter, sans-serif");
  });
  if (lt > HS.length * per) {
    const a = clamp01((lt - HS.length * per) / 0.4);
    ctx.globalAlpha = a; label(ctx, "✓ committed exactly once", w - 10, h - 14, C.green, SANS, "right"); ctx.globalAlpha = 1;
  }
  // lock icon when TLS done
  if (lt > 6 * per) { ctx.strokeStyle = C.violet; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cols[0] + 60, 22, 4, Math.PI, 0); ctx.stroke(); ctx.fillStyle = C.violet; ctx.fillRect(cols[0] + 55, 22, 10, 7); }
}

/* ---------------- 5. Encryption process ---------------- */
const hex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
const sbox = (v, r) => ((v * 29 + 113 + r * 37) ^ (v >> 3)) & 255;
const encInit = () => ({ plain: [..."Hello, recruiter"].map((c) => c.charCodeAt(0)) });
function drawEncryption(ctx, w, h, t, s) {
  const cyc = 11, lt = t % cyc;
  const rounds = 14, roundT = 0.42, start = 2.0, end = start + rounds * roundT;
  // state evolution
  let st = s.plain.slice(), round = 0, step = "";
  const done = Math.min(rounds, Math.max(0, Math.floor((lt - start) / roundT)));
  for (let r = 1; r <= done; r++) st = st.map((v, i) => sbox(v ^ ((r * 53 + i * 11) & 255), r));
  if (lt >= start && lt < end) { round = done + 1; step = ["SubBytes", "ShiftRows", "MixColumns", "AddRoundKey"][Math.floor(((lt - start) % roundT) / roundT * 4)]; }
  const cell = Math.min(34, (h - 90) / 4.4), gx = w / 2 - cell * 2, gy = 48;
  // left: plaintext + password -> key
  label(ctx, "PLAINTEXT", 14, 18, C.dim);
  label(ctx, String.fromCharCode(...s.plain), 14, 36, C.ink, "500 13px 'JetBrains Mono', monospace");
  label(ctx, "PBKDF2-SHA256 · 600k", 14, 62, C.dim);
  const kp = clamp01(lt / start);
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(14, 72, Math.min(150, gx - 30), 6);
  ctx.fillStyle = C.violet; ctx.fillRect(14, 72, Math.min(150, gx - 30) * kp, 6);
  label(ctx, kp < 1 ? "deriving key…" : "256-bit key ✓", 14, 90, kp < 1 ? C.dim : C.violet);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = kp * 8 > i ? C.violet + "cc" : "rgba(255,255,255,0.08)"; ctx.fillRect(14 + i * 13, 102, 10, 10); }
  // state grid
  const shiftRow = step === "ShiftRows" ? ((lt - start) % roundT) / roundT * 4 - 1 : 0;
  for (let i = 0; i < 16; i++) {
    const r = i % 4, c = Math.floor(i / 4);
    let x = gx + c * cell, y = gy + r * cell;
    if (step === "ShiftRows") x -= r * cell * 0.25 * Math.sin(shiftRow * Math.PI);
    const hl = (step === "MixColumns" && c === Math.floor(((lt * 8) % 4))) || step === "SubBytes" || (step === "AddRoundKey" && (i + round) % 3 === 0);
    ctx.fillStyle = hl ? (step === "AddRoundKey" ? "rgba(167,139,250,0.35)" : "rgba(94,234,212,0.22)") : "rgba(255,255,255,0.05)";
    ctx.strokeStyle = "rgba(160,190,230,0.3)";
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, cell - 4, cell - 4, 5); ctx.fill(); ctx.stroke();
    label(ctx, hex(st[i]), x + cell / 2, y + cell / 2, round ? C.ink : C.dim, MONO, "center");
  }
  label(ctx, round ? `round ${round}/14 · ${step}` : lt < start ? "AES-256-GCM · state" : "rounds complete", gx + cell * 2, gy + cell * 4 + 16, round ? C.cyan : C.dim, MONO, "center");
  // right: ciphertext stream
  const cx = gx + cell * 4 + 26;
  label(ctx, "CIPHERTEXT", cx, 18, C.dim);
  if (lt >= end) {
    const shown = Math.min(16, Math.floor((lt - end) * 14));
    for (let i = 0; i < shown; i++) label(ctx, hex(st[i]), cx + (i % 4) * 24, 40 + Math.floor(i / 4) * 18, C.amber);
    if (shown >= 16) { label(ctx, "GCM tag", cx, 124, C.dim); label(ctx, "9F·2C·E1·07…", cx, 140, C.green); }
  } else {
    for (let i = 0; i < 16; i++) { ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(cx + (i % 4) * 24 - 2, 33 + Math.floor(i / 4) * 18, 18, 12); }
  }
  // flow arrows
  ctx.strokeStyle = "rgba(160,190,230,0.35)"; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(Math.min(170, gx - 14), 75); ctx.lineTo(gx - 4, gy + cell * 2); ctx.moveTo(gx + cell * 4 + 4, gy + cell * 2); ctx.lineTo(cx - 6, 70); ctx.stroke(); ctx.setLineDash([]);
}

/* ---------------- 6. Face recognition ---------------- */
const faceInit = () => {
  const jaw = Array.from({ length: 17 }, (_, i) => [-Math.cos(Math.PI * (0.05 + 0.9 * i / 16)) * 0.78, 0.05 + Math.sin(Math.PI * (0.05 + 0.9 * i / 16)) * 0.95]);
  const brow = (s) => [0, 1, 2, 3, 4].map((k) => [s * (0.18 + k * 0.1), -0.32 - Math.sin((k / 4) * Math.PI) * 0.08]);
  const eye = (s) => [0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * 6.28; return [s * 0.36 + Math.cos(a) * 0.13, -0.15 + Math.sin(a) * 0.055]; });
  const nose = [[0, -0.12], [0, 0], [0, 0.12], [0, 0.24], [-0.1, 0.3], [-0.05, 0.32], [0, 0.33], [0.05, 0.32], [0.1, 0.3]];
  const mouth = Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * 6.28; return [Math.cos(a) * 0.26, 0.55 + Math.sin(a) * (a < Math.PI ? 0.09 : 0.05)]; });
  const forehead = [-0.5, -0.25, 0, 0.25, 0.5].map((x) => [x, -0.62 + Math.abs(x) * 0.25]);
  const pts = [...jaw, ...brow(-1), ...brow(1), ...nose, ...eye(-1), ...eye(1), ...mouth, ...forehead];
  // mesh edges: connect each point to its 3 nearest neighbours
  const edges = new Set();
  pts.forEach((a, i) => pts.map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1])]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 3).forEach(([j]) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`)));
  const r = rand(11);
  return { pts, edges: [...edges].map((e) => e.split("-").map(Number)), emb: Array.from({ length: 24 }, () => r()) };
}
function drawFace(ctx, w, h, t, s) {
  const cyc = 9, lt = t % cyc;
  const fw = Math.min(w * 0.42, h * 0.54), cx = w * 0.32, cy = h * 0.55;
  const yaw = Math.sin(t * 0.6) * 0.18, pitch = Math.sin(t * 0.45) * 0.06;
  const P = s.pts.map(([x, y]) => [cx + (x * Math.cos(yaw) + 0.15 * Math.sin(yaw) * (1 - x * x)) * fw * 0.5, cy + (y + pitch * (1 - y)) * fw * 0.55]);
  const scanY = cy - fw * 0.42 + ((lt / 2.2) % 1) * fw * 1.0;
  const detect = clamp01((lt - 0.4) / 0.8), lm = clamp01((lt - 1.3) / 1.6), mesh = clamp01((lt - 2.6) / 1.2), embT = clamp01((lt - 3.6) / 1.4), match = clamp01((lt - 5.2) / 1.0);
  // silhouette
  ctx.fillStyle = "rgba(96,165,250,0.06)"; ctx.beginPath(); ctx.ellipse(cx, cy, fw * 0.42, fw * 0.6, 0, 0, 6.28); ctx.fill();
  // scan line
  if (lt < 5.2) { const g = ctx.createLinearGradient(0, scanY - 20, 0, scanY); g.addColorStop(0, "rgba(94,234,212,0)"); g.addColorStop(1, "rgba(94,234,212,0.35)"); ctx.fillStyle = g; ctx.fillRect(cx - fw * 0.6, scanY - 20, fw * 1.2, 20); ctx.fillStyle = C.cyan; ctx.fillRect(cx - fw * 0.6, scanY, fw * 1.2, 1); }
  // detection box
  if (detect > 0) {
    const bw = fw * (1.5 - 0.4 * ease(detect)), bh = fw * (1.75 - 0.4 * ease(detect));
    brackets(ctx, cx - bw / 2, cy - bh / 2 - fw * 0.05, bw, bh, 14, match >= 1 ? C.green : C.cyan);
    label(ctx, match >= 1 ? "ID verified" : "face 0.99", cx - bw / 2, cy - bh / 2 - fw * 0.05 - 10, match >= 1 ? C.green : C.cyan);
  }
  // mesh
  if (mesh > 0) { ctx.strokeStyle = `rgba(167,139,250,${0.45 * mesh})`; ctx.lineWidth = 0.8; ctx.beginPath(); s.edges.slice(0, Math.floor(s.edges.length * mesh)).forEach(([a, b]) => { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }); ctx.stroke(); }
  // landmarks
  P.slice(0, Math.floor(P.length * lm)).forEach(([x, y]) => { ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.28); ctx.fill(); });
  if (lm > 0) label(ctx, `${Math.floor(P.length * lm)} landmarks`, cx - fw * 0.6, h - 14, C.dim);
  // embedding + gallery
  const ex = w * 0.62, ew = w * 0.34;
  label(ctx, "EMBEDDING · 128-d", ex, 18, C.dim);
  s.emb.forEach((v, i) => {
    const bw = ew / s.emb.length - 2, bh = (v * 0.8 + 0.2) * 34 * clamp01(embT * 1.5 - i / s.emb.length);
    ctx.fillStyle = `hsl(${180 + v * 90},80%,65%)`; ctx.fillRect(ex + i * (bw + 2), 66 - bh, bw, bh);
  });
  label(ctx, "GALLERY MATCH", ex, 90, C.dim);
  [["Enrolled A", 0.984], ["Enrolled B", 0.412], ["Enrolled C", 0.237]].forEach(([n, score], i) => {
    const y = 110 + i * 28, v = score * ease(match);
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(ex, y, ew, 18);
    ctx.fillStyle = i === 0 ? (match >= 1 ? C.green : C.cyan) : "rgba(160,190,230,0.35)"; ctx.fillRect(ex, y, ew * v, 18);
    label(ctx, n, ex + 6, y + 9, C.ink);
    label(ctx, match > 0 ? v.toFixed(3) : "—", ex + ew - 6, y + 9, C.ink, MONO, "right");
  });
  if (match >= 1) label(ctx, "cosine ≥ 0.90 → match", ex, 204, C.green);
}

const SCENES = {
  drones: [drawDrones, droneInit],
  pointcloud: [drawCloud, cloudInit],
  packets: [drawPackets, packetInit],
  handshake: [drawHandshake, null],
  encryption: [drawEncryption, encInit],
  face: [drawFace, faceInit],
};

export default function Animation({ scene, height = 260, className = "" }) {
  const [draw, init] = SCENES[scene] || [];
  const ref = useCanvas(draw, init);
  if (!draw) return null;
  return <canvas ref={ref} className={`anim ${className}`} style={{ height }} aria-hidden="true" />;
}
