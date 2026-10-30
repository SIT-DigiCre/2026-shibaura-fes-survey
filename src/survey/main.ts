// アンケート本体。流れ: 待ち受け → Q1〜Q7 → 送信 → お礼 5 秒 → 待ち受け
import './style.css';
import { QUESTIONS, GENRES, genreLabel, type Question } from '../shared/questions';
import { SEP, isoLocal, pad, type SurveyRecord } from '../shared/record';
import { fit, H0, W0 } from './fit';
import { burst, clearFlyers, fly, initFx, reducedMotion, sizeCanvas } from './fx';
import { installTouch } from './touch';
import { sBest, sClick, sErr, sOut, sThanks, tone, unlockAudio } from './sound';
import { deviceName, fetchCount, flush, newId, saveRecord, totalCount } from './store';
import { initAdmin, openPin, pinKey, adminAct } from './admin';
import { installAutoFullscreen } from './fullscreen';

const CFG = {
  THANKS_MS: 5000, // お礼画面の表示時間
  IDLE_MS: 60000, // 回答途中の放置で警告を出すまで
  WARN_SEC: 20, // 警告から待ち受けに戻るまで
  RESEND_MS: 90000, // 待ち受け中の再送間隔
  LONGPRESS_MS: 480, // 長押しで★BEST
  DOUBLETAP_MS: 350, // 2回タップで★BEST
};

const PHONE = /[?&]m=phone(&|$)/.test(location.search);
if (PHONE) {
  document.documentElement.className += ' is-phone';
  // スマホでは拡大を許可する
  const vp = document.querySelector('meta[name=viewport]');
  if (vp) vp.setAttribute('content', 'width=device-width,initial-scale=1');
}

const Q = QUESTIONS;
const LAST = Q.length - 1;

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const app = $('app');
const qbody = $('qbody');
const chipsEl = $('chips');
const stockEl = $('stock');
const nextEl = $('next');
const backEl = $('back');

export type Mode = 'idle' | 'survey' | 'sending' | 'thanks' | 'warn' | 'pin' | 'admin';

interface Answers {
  q1: string[];
  best: string | null;
  q2: string[];
  q3: string | null;
  q4: string[];
  q5: string | null;
  q6: string | null;
  q7: string[];
}
const freshAns = (): Answers => ({
  q1: [],
  best: null,
  q2: [],
  q3: null,
  q4: [],
  q5: null,
  q6: null,
  q7: [],
});

const st = {
  mode: 'idle' as Mode,
  step: 0,
  reached: 0,
  ans: freshAns(),
  lastActive: Date.now(),
  warnLeft: 0,
  lastTapEl: null as HTMLElement | null,
  lastTapT: 0,
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
}

/* ================= 画面切り替え ================= */
function show(id: 'idle' | 'main') {
  $('idle').className = 'screen' + (id === 'idle' ? ' show' : '');
  $('main').className = 'screen' + (id === 'main' ? ' show' : '');
  if (PHONE) window.scrollTo(0, 0);
  layout();
}

export function renderTotal() {
  const n = String(totalCount());
  const els = document.querySelectorAll('.js-total');
  for (let i = 0; i < els.length; i++) els[i].textContent = n;
}

function startSurvey() {
  st.mode = 'survey';
  st.lastActive = Date.now();
  show('main');
  render();
}

/* ================= 設問の描画 ================= */
function arr(key: keyof Answers): string[] | null {
  const a = st.ans[key];
  return Array.isArray(a) ? a : null;
}
function isOn(q: Question, v: string) {
  const a = arr(q.key);
  return a ? a.indexOf(v) >= 0 : st.ans[q.key] === v;
}
function answered(q: Question) {
  const a = arr(q.key);
  return a ? a.length > 0 : !!st.ans[q.key];
}

(function buildStatic() {
  let h = '';
  for (let i = 0; i <= LAST; i++) h += '<li>Q' + (i + 1) + '</li>';
  $('steps').innerHTML = h;
})();

function render() {
  const q = Q[st.step];
  const typ = q.type === 'single' ? 'SINGLE' : q.type === 'tags' ? 'OPTIONAL' : 'MULTI';
  let h =
    '<div class="q-head"><div class="q-num">Q' +
    (st.step + 1) +
    '</div><div class="q-type' +
    (q.type === 'tags' ? ' opt' : '') +
    '">' +
    typ +
    '</div></div>' +
    '<h1 class="q-title">' +
    q.title +
    '</h1><p class="q-hint">' +
    q.hint +
    '</p><div class="opts' +
    (q.one ? ' one' : '') +
    '">';
  for (const o of q.opts) {
    h +=
      '<button type="button" class="o" data-act="opt" data-v="' +
      esc(o.v) +
      '"><span class="o-in">' +
      (o.k ? '<span class="key">' + o.k + '</span>' : '') +
      '<span class="lb' +
      (o.l.length > (o.k ? 6 : 8) ? ' s' : '') +
      '">' +
      esc(o.l) +
      '</span>';
    if (o.lv) {
      h += '<span class="lv" aria-hidden="true">';
      for (let k = 1; k <= 5; k++) h += '<i' + (k <= o.lv ? ' class="f"' : '') + '></i>';
      h += '</span>';
    }
    if (q.best) h += '<span class="bt">★BEST</span>';
    h += '</span></button>';
  }
  h += '</div>';
  qbody.innerHTML = h;
  qbody.className = '';
  void qbody.offsetWidth;
  qbody.className = 'enter';
  syncOpts();
  renderNav();
}

function syncOpts() {
  const q = Q[st.step];
  const els = qbody.querySelectorAll('.o');
  for (let i = 0; i < els.length; i++) {
    const v = els[i].getAttribute('data-v') as string;
    const best = !!(q.best && st.ans.best === v);
    els[i].classList.toggle('on', isOn(q, v) && !best);
    els[i].classList.toggle('best', best);
    els[i].setAttribute('aria-pressed', isOn(q, v) ? 'true' : 'false');
  }
}

const canSend = () => st.reached >= LAST && st.ans.q1.length > 0 && st.mode === 'survey';

function renderNav() {
  const q = Q[st.step];
  backEl.classList.toggle('gone', st.step === 0);
  let cls = 'btn-next';
  let label: string;
  if (st.step === LAST) {
    if (canSend()) {
      cls += ' go';
      label = '送信する';
    } else {
      cls += ' dis';
      label = 'Q1に答えてね';
    }
  } else if (q.required && !answered(q)) {
    cls += ' dis';
    label = 'えらんでね';
  } else if (answered(q)) label = 'つぎへ ▶';
  else {
    cls += ' skip';
    label = 'スキップ ▶';
  }
  nextEl.className = cls;
  nextEl.textContent = label;
  const segs = $('steps').children;
  for (let i = 0; i < segs.length; i++) {
    segs[i].className = i === st.step ? 'cur' : answered(Q[i]) ? 'ok' : '';
    if (i === st.step) segs[i].setAttribute('aria-current', 'step');
    else segs[i].removeAttribute('aria-current');
  }
}

/* ================= 回答操作 ================= */
function tapOpt(el: HTMLElement) {
  const q = Q[st.step];
  const v = el.getAttribute('data-v') as string;
  const now = Date.now();
  // 2回タップ → ★BEST
  if (q.best && st.lastTapEl === el && now - st.lastTapT < CFG.DOUBLETAP_MS) {
    st.lastTapEl = null;
    ensureOn(v, el);
    setBest(v);
    return;
  }
  st.lastTapEl = el;
  st.lastTapT = now;
  if (q.type === 'single') {
    const cur = st.ans[q.key] as string | null;
    if (cur !== v) {
      if (cur) removeChip(q.key, cur);
      (st.ans[q.key] as string | null) = v;
      addChip(q.key, v, el);
    }
    syncOpts();
    renderNav();
    return;
  }
  const a = arr(q.key) as string[];
  const idx = a.indexOf(v);
  if (idx >= 0) {
    a.splice(idx, 1);
    if (q.best && st.ans.best === v) st.ans.best = null;
    removeChip(q.key, v);
    sOut();
  } else {
    a.push(v);
    addChip(q.key, v, el);
  }
  syncOpts();
  renderNav();
}

function ensureOn(v: string, el: HTMLElement) {
  if (st.ans.q1.indexOf(v) < 0) {
    st.ans.q1.push(v);
    addChip('q1', v, el);
  }
}
function setBest(v: string) {
  const prev = st.ans.best;
  st.ans.best = prev === v ? null : v;
  if (prev) updateChip('q1', prev);
  if (st.ans.best) updateChip('q1', st.ans.best, true);
  sBest();
  syncOpts();
  renderNav();
}
function longPressOpt(el: HTMLElement) {
  ensureOn(el.getAttribute('data-v') as string, el);
  setBest(el.getAttribute('data-v') as string);
  if (navigator.vibrate) {
    try {
      navigator.vibrate(30);
    } catch {
      /* noop */
    }
  }
}

function go(d: number) {
  const q = Q[st.step];
  if (d > 0 && st.step === LAST) return;
  if (d > 0 && q.required && !answered(q)) {
    shake(nextEl);
    shake(qbody.querySelector('.opts'));
    sErr();
    return;
  }
  st.step = Math.max(0, Math.min(LAST, st.step + d));
  if (st.step > st.reached) st.reached = st.step;
  st.lastTapEl = null;
  sClick();
  render();
}
function jump(s: number) {
  st.step = s;
  st.lastTapEl = null;
  render();
}
function shake(el: Element | null) {
  if (!el) return;
  el.classList.remove('shake');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('shake');
}

/* ================= チップ（STOCK） ================= */
type ChipKey = keyof Answers;
function chipText(key: ChipKey, v: string) {
  if (key === 'q1') return esc(genreLabel(v)) + (st.ans.best === v ? ' ★BEST' : '');
  if (key === 'q3') return '評価 ' + esc(v);
  if (key === 'q7') return '「' + esc(v) + '」';
  return esc(v);
}
const chipTag = (key: ChipKey) => key.toUpperCase();
const chipStep = (key: ChipKey) => parseInt(key.slice(1), 10) - 1;

function findChip(key: ChipKey, v: string): HTMLElement | null {
  const cs = chipsEl.children;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i] as HTMLElement;
    if (c.getAttribute('data-k') === key && c.getAttribute('data-v') === v && !c.classList.contains('out')) return c;
  }
  return null;
}
function fillChip(c: HTMLElement, key: ChipKey, v: string) {
  c.classList.remove('fill', 'best');
  if (key === 'q1') c.classList.add(st.ans.best === v ? 'best' : 'fill');
  (c.querySelector('.cb') as HTMLElement).innerHTML = '<span class="tg">' + chipTag(key) + '</span>' + chipText(key, v);
}
function addChip(key: ChipKey, v: string, fromEl: HTMLElement | null) {
  const c = document.createElement('div');
  c.className = 'chip wait';
  c.setAttribute('data-act', 'chip');
  c.setAttribute('data-k', key);
  c.setAttribute('data-v', v);
  c.setAttribute('data-step', String(chipStep(key)));
  c.innerHTML = '<div class="cb"></div>';
  fillChip(c, key, v);
  const tilt = (Math.random() * 6 - 3).toFixed(1);
  c.style.webkitTransform = c.style.transform = 'rotate(' + tilt + 'deg)';
  chipsEl.appendChild(c);
  updateStock();
  fly(fromEl, c);
}
function updateChip(key: ChipKey, v: string, flash?: boolean) {
  const c = findChip(key, v);
  if (!c) return;
  fillChip(c, key, v);
  if (flash) {
    c.classList.remove('flash');
    void c.offsetWidth;
    c.classList.add('flash');
  }
}
function removeChip(key: ChipKey, v: string) {
  const c = findChip(key, v);
  if (!c) return;
  c.removeAttribute('data-act');
  c.classList.add('out');
  setTimeout(() => {
    if (c.parentNode) c.parentNode.removeChild(c);
    updateStock();
  }, 230);
  updateStock();
}
function liveChips(): HTMLElement[] {
  const r: HTMLElement[] = [];
  const cs = chipsEl.children;
  for (let i = 0; i < cs.length; i++) if (!cs[i].classList.contains('out')) r.push(cs[i] as HTMLElement);
  return r;
}
function updateStock() {
  const n = liveChips().length;
  $('scount').textContent = pad(n);
  stockEl.classList.toggle('has', n > 0);
  chipsEl.classList.toggle('dense', n > 22);
}

/* ================= 送信 ================= */
function buildRecord(id: string): SurveyRecord {
  const a = st.ans;
  const q1 = GENRES.filter((g) => a.q1.indexOf(g[0]) >= 0).map((g) => genreLabel(g[0]));
  return {
    id,
    at: isoLocal(new Date()),
    src: PHONE ? 'phone' : 'signage',
    device: PHONE ? 'phone' : deviceName(),
    q1: q1.join(SEP),
    best: a.best ? genreLabel(a.best) : '',
    q2: a.q2.join(SEP),
    q3: a.q3 || '',
    q4: a.q4.join(SEP),
    q5: a.q5 || '',
    q6: a.q6 || '',
    q7: a.q7.join(SEP),
    // 自由入力欄はやめた（サイネージで日本語入力ができないため）。列は互換のため残す
    text: '',
  };
}

function submit() {
  if (!canSend()) {
    if (st.mode === 'survey') {
      shake(nextEl);
      sErr();
    }
    return;
  }
  const rec = buildRecord(newId(PHONE));
  if (!saveRecord(rec)) {
    // 保存できなかったときはお礼を出さない（回答はそのまま残す）
    nextEl.className = 'btn-next dis';
    nextEl.textContent = '保存エラー：スタッフへ';
    shake(nextEl);
    sErr();
    return;
  }
  st.mode = 'sending';
  nextEl.classList.add('fired');
  // 受付 ID はスマホ版だけ（スタッフに見せる用）。サイネージには出さない
  $('tyId').textContent = PHONE ? rec.id : '';
  flush(renderTotal);
  renderTotal();

  // チップを下から順にはじけさせる
  const cs = liveChips();
  cs.sort((p, q) => q.offsetTop - p.offsetTop);
  const gap = Math.max(25, Math.min(70, 900 / Math.max(cs.length, 1)));
  const per = cs.length > 20 ? 24 : 34;
  const scan = $('scan');
  scan.className = '';
  void scan.offsetWidth;
  scan.className = 'go';
  tone(200, 0.3, 0.06, 'sawtooth', 1600);
  cs.forEach((c, i) => {
    setTimeout(
      () => {
        burst(c, per);
        c.classList.add('gone');
        tone(700 + (i % 8) * 140, 0.07, 0.04);
      },
      120 + i * gap,
    );
  });
  setTimeout(showThanks, reducedMotion ? 300 : 120 + cs.length * gap + 700);
}

function showThanks() {
  st.mode = 'thanks';
  const bar = $('tyBar');
  bar.className = '';
  void bar.offsetWidth;
  bar.style.webkitAnimationDuration = bar.style.animationDuration = CFG.THANKS_MS + 'ms';
  bar.className = 'run';
  $('thanks').className = 'ov show';
  if (PHONE) window.scrollTo(0, 0);
  sThanks();
  // スマホ版はスタッフに見せるため、お礼画面のまま止める
  if (!PHONE) setTimeout(resetAll, CFG.THANKS_MS);
}

function resetAll() {
  st.mode = 'idle';
  st.ans = freshAns();
  st.step = 0;
  st.reached = 0;
  st.lastTapEl = null;
  chipsEl.innerHTML = '';
  clearFlyers();
  $('thanks').className = 'ov';
  $('warn').className = 'ov';
  $('scan').className = '';
  const ae = document.activeElement as HTMLElement | null;
  if (ae && ae.blur) ae.blur();
  updateStock();
  renderTotal();
  show('idle');
  // 待ち受けに戻ったら未送信を送る
  flush(() => fetchCount(renderTotal));
}

/* ================= 放置対策（サイネージのみ） ================= */
function dirty() {
  return st.step > 0 || liveChips().length > 0;
}
if (!PHONE) {
  setInterval(() => {
    if (st.mode === 'survey' && Date.now() - st.lastActive > CFG.IDLE_MS) {
      if (!dirty()) {
        resetAll(); // 何も選ばずに離れた人は黙って待ち受けへ
        return;
      }
      st.mode = 'warn';
      st.warnLeft = CFG.WARN_SEC;
      $('wc').textContent = String(st.warnLeft);
      $('warn').className = 'ov show';
    } else if (st.mode === 'warn') {
      st.warnLeft--;
      $('wc').textContent = String(st.warnLeft);
      if (st.warnLeft <= 0) resetAll();
    }
  }, 1000);
}
setInterval(() => {
  if (st.mode === 'idle' || st.mode === 'thanks') flush(() => fetchCount(renderTotal));
}, CFG.RESEND_MS);

/* ================= 画面フィット ================= */
let layoutT = 0;
export function layout() {
  const cv = $('fx') as HTMLCanvasElement;
  if (PHONE) {
    sizeCanvas(app.offsetWidth, app.offsetHeight, window.devicePixelRatio || 1);
    cv.style.width = app.offsetWidth + 'px';
    cv.style.height = app.offsetHeight + 'px';
    return;
  }
  fit(app, (s) => sizeCanvas(W0, H0, s * (window.devicePixelRatio || 1)));
}
window.addEventListener('resize', () => {
  clearTimeout(layoutT);
  layoutT = window.setTimeout(layout, 120);
});
document.addEventListener('focusout', () => setTimeout(layout, 300));

/* ================= タッチ ================= */
function dispatch(el: HTMLElement) {
  const a = el.getAttribute('data-act') as string;
  if (a === 'logo') {
    if (!PHONE) logoTap();
    return;
  }
  if (a === 'pk') return pinKey(el.getAttribute('data-k') as string);
  if (a.indexOf('ad-') === 0) return adminAct(a, el);
  if (a === 'keep') {
    st.mode = 'survey';
    $('warn').className = 'ov';
    st.lastActive = Date.now();
    return;
  }
  if (a === 'start' && st.mode === 'idle') return startSurvey();
  if (st.mode !== 'survey') return;
  if (a === 'opt') tapOpt(el);
  else if (a === 'next') {
    if (st.step === LAST) submit();
    else go(1);
  } else if (a === 'back') go(-1);
  else if (a === 'chip') jump(parseInt(el.getAttribute('data-step') as string, 10));
}

let logoTaps: number[] = [];
function logoTap() {
  const now = Date.now();
  if (logoTaps.length && now - logoTaps[logoTaps.length - 1] > 600) logoTaps = [];
  logoTaps.push(now);
  if (logoTaps.length >= 5) {
    logoTaps = [];
    openPin();
  }
}

installTouch({
  onDown: () => {
    st.lastActive = Date.now();
    unlockAudio();
  },
  onTap: dispatch,
  longPress: (el) =>
    el.getAttribute('data-act') === 'opt' && Q[st.step].best && st.mode === 'survey' ? () => longPressOpt(el) : null,
  longPressMs: CFG.LONGPRESS_MS,
  scrollable: PHONE,
});

// サイネージはタッチで全画面に（スマホ版はしない。PIN・管理画面の操作中もしない）
if (!PHONE) installAutoFullscreen(() => st.mode !== 'pin' && st.mode !== 'admin');

/* ================= 管理画面とのつなぎ ================= */
initAdmin({
  getMode: () => st.mode,
  setMode: (m) => {
    st.mode = m;
    st.lastActive = Date.now();
  },
  // PIN を開くと放置警告は閉じる（裏で警告が進んで回答がリセットされないように）
  closeWarn: () => {
    $('warn').className = 'ov';
    if (st.mode === 'warn') st.mode = 'survey';
  },
  onClose: () => {
    renderTotal();
    if (st.mode === 'survey') renderNav();
  },
  layout,
});

/* ================= 起動 ================= */
initFx(app, $('fly'), $('fx') as HTMLCanvasElement);
updateStock();
renderTotal();
show('idle');
flush(() => fetchCount(renderTotal));
const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
if (fonts && fonts.ready) fonts.ready.then(layout);
