// チップの飛行と、ドットのパーティクル（Canvas）
import { sKaran } from './sound';

let RM = false;
try {
  RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
} catch {
  /* noop */
}
export const reducedMotion = RM;

let app: HTMLElement;
let flyLayer: HTMLElement;
let cv: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D | null;
let CW = 540;
let CH = 1920;
let CK = 1;

export function initFx(appEl: HTMLElement, fly: HTMLElement, canvas: HTMLCanvasElement) {
  app = appEl;
  flyLayer = fly;
  cv = canvas;
  ctx = cv.getContext('2d');
}

/** 論理サイズ w x h のキャンバスを k 倍の解像度にする */
export function sizeCanvas(w: number, h: number, k: number) {
  k = Math.max(0.5, Math.min(2, k));
  if (w === CW && h === CH && Math.abs(k - CK) < 0.01) return;
  CW = w;
  CH = h;
  CK = k;
  cv.width = Math.round(w * k);
  cv.height = Math.round(h * k);
}

/** アプリ内座標（transform の影響を受けない offset 系で計算） */
export function local(el: HTMLElement) {
  let x = 0;
  let y = 0;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let e: HTMLElement | null = el;
  while (e && e !== app) {
    x += e.offsetLeft;
    y += e.offsetTop;
    e = e.offsetParent as HTMLElement | null;
  }
  return { x, y, w, h };
}

interface Flyer {
  el: HTMLElement;
  chip: HTMLElement;
  dx: number;
  dy: number;
  vy0: number;
  g: number;
  T: number;
  t: number;
  spin: number;
}
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s: number;
  c: string;
  g: number;
  line?: boolean;
}

const flyers: Flyer[] = [];
const parts: Part[] = [];
let running = false;
let lastT = 0;
let landCount = 0;

export function land(c: HTMLElement) {
  c.classList.remove('land');
  void c.offsetWidth;
  c.classList.add('land');
}

/** fromEl の位置から STOCK のチップ位置へ放物線で落とす */
export function fly(fromEl: HTMLElement | null, chip: HTMLElement) {
  if (!fromEl || RM) {
    chip.classList.remove('wait');
    land(chip);
    if (fromEl) sKaran(landCount++);
    return;
  }
  const a = local(fromEl);
  const b = local(chip);
  const f = chip.cloneNode(true) as HTMLElement;
  f.removeAttribute('data-act');
  f.className = chip.className.replace('wait', '');
  f.style.left = b.x + 'px';
  f.style.top = b.y + 'px';
  flyLayer.appendChild(f);
  const dx = a.x + a.w / 2 - (b.x + b.w / 2);
  const dy = a.y + a.h / 2 - (b.y + b.h / 2);
  const vy0 = -520;
  const g = 4200;
  const T = dy < 0 ? (-vy0 + Math.sqrt(vy0 * vy0 - 2 * g * dy)) / g : 0.3;
  flyers.push({
    el: f,
    chip,
    dx,
    dy,
    vy0,
    g,
    T,
    t: 0,
    spin: (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 200),
  });
  wake();
}

export function clearFlyers() {
  flyers.length = 0;
  flyLayer.innerHTML = '';
}

function stepFlyers(dt: number) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    f.t += dt;
    const t = Math.min(f.t, f.T);
    const k = t / f.T;
    const x = f.dx * (1 - k) * (1 - k * 0.3);
    const y = f.dy + f.vy0 * t + 0.5 * f.g * t * t;
    const r = f.spin * t * (1 - k);
    const s = 1.25 - 0.25 * k;
    const tr =
      'translate(' +
      x.toFixed(1) +
      'px,' +
      y.toFixed(1) +
      'px) rotate(' +
      r.toFixed(1) +
      'deg) scale(' +
      s.toFixed(3) +
      ')';
    f.el.style.webkitTransform = f.el.style.transform = tr;
    if (f.t >= f.T) {
      if (f.el.parentNode) f.el.parentNode.removeChild(f.el);
      if (f.chip.parentNode && !f.chip.classList.contains('out')) {
        f.chip.classList.remove('wait');
        land(f.chip);
        sKaran(landCount++);
        sparks(f.chip, 6, 0.35);
      }
      flyers.splice(i, 1);
    }
  }
}

// 白地で見えるよう、シアン系の濃淡を混ぜる
const PCOLS = ['#00B0F0', '#00B0F0', '#0077AA', '#9FDCF5'];
const pcol = () => PCOLS[Math.floor(Math.random() * PCOLS.length)];

function sparks(el: HTMLElement, n: number, life: number) {
  if (RM) return;
  const r = local(el);
  for (let i = 0; i < n; i++) {
    const a = Math.PI + Math.random() * Math.PI;
    const sp = 120 + Math.random() * 220;
    parts.push({
      x: r.x + Math.random() * r.w,
      y: r.y + r.h,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life,
      max: life,
      s: 3 + Math.random() * 3,
      c: pcol(),
      g: 900,
    });
  }
  wake();
}

/** 送信時にチップをはじけさせる */
export function burst(el: HTMLElement, n: number) {
  if (RM) return;
  const r = local(el);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 250 + Math.pow(Math.random(), 0.7) * 1100;
    const life = 0.9 + Math.random() * 1.1;
    const axis = Math.random() < 0.3; // 縦横だけに走る「デジタル」な粒
    let vx = Math.cos(a) * sp;
    let vy = Math.sin(a) * sp - 300;
    if (axis) {
      if (Math.abs(vx) > Math.abs(vy)) vy = 0;
      else vx = 0;
    }
    parts.push({
      x: cx + (Math.random() - 0.5) * r.w,
      y: cy + (Math.random() - 0.5) * r.h,
      vx,
      vy,
      life,
      max: life,
      s: axis ? 4 : 3 + Math.floor(Math.random() * 3) * 3,
      c: pcol(),
      g: axis ? 0 : 520,
      line: axis,
    });
  }
  wake();
}

function wake() {
  if (running) return;
  running = true;
  lastT = 0;
  requestAnimationFrame(frame);
}

function frame(t: number) {
  const dt = lastT ? Math.min(0.04, (t - lastT) / 1000) : 0.016;
  lastT = t;
  stepFlyers(dt);
  const drag = Math.pow(0.12, dt);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      parts.splice(i, 1);
      continue;
    }
    p.vx *= drag;
    p.vy *= drag;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  if (ctx) {
    ctx.setTransform(CK, 0, 0, CK, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    for (const p of parts) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
      ctx.fillStyle = p.c;
      const x = Math.round(p.x / 3) * 3; // 3px グリッドに吸着
      const y = Math.round(p.y / 3) * 3;
      if (p.line) {
        const len = Math.min(60, (Math.abs(p.vx) + Math.abs(p.vy)) * 0.05 + 4);
        if (p.vx !== 0) ctx.fillRect(x - (p.vx > 0 ? len : 0), y, len, 3);
        else ctx.fillRect(x, y - (p.vy > 0 ? len : 0), 3, len);
      } else ctx.fillRect(x, y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }
  if (parts.length || flyers.length) requestAnimationFrame(frame);
  else {
    running = false;
    if (ctx) ctx.clearRect(0, 0, CW, CH);
  }
}
