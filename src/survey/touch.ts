// タッチ（マルチタッチ・指がずれたら取り消し）。
// data-act の付いた要素を押して、同じ要素の上で離したときだけ onTap を呼ぶ。
export interface TouchHandlers {
  onDown: () => void;
  onTap: (el: HTMLElement) => void;
  /** スマホ版はスクロールを止めない */
  scrollable: boolean;
}

interface Press {
  el: HTMLElement;
  x: number;
  y: number;
  cancel?: boolean;
}

export function findAct(t: EventTarget | null): HTMLElement | null {
  let el = t as HTMLElement | null;
  while (el && el.getAttribute) {
    if (el.getAttribute('data-act')) return el;
    el = el.parentNode as HTMLElement | null;
  }
  return null;
}
const isText = (el: Element | null) => !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');

export function installTouch(h: TouchHandlers) {
  const presses: Record<string, Press> = {};
  let lastTouchEv = 0;
  const slop = h.scrollable ? 12 : 24;

  function start(id: string, target: EventTarget | null, x: number, y: number) {
    h.onDown();
    const ae = document.activeElement;
    if (isText(ae) && ae !== target) (ae as HTMLElement).blur();
    const el = findAct(target);
    if (!el) return;
    presses[id] = { el, x, y };
    el.classList.add('pressing');
  }
  function move(id: string, x: number, y: number) {
    const r = presses[id];
    if (!r || r.cancel) return;
    if (Math.abs(x - r.x) > slop || Math.abs(y - r.y) > slop) {
      r.cancel = true;
      r.el.classList.remove('pressing');
    }
  }
  function end(id: string, x: number, y: number) {
    const r = presses[id];
    delete presses[id];
    if (!r) return;
    r.el.classList.remove('pressing');
    if (r.cancel) return;
    if (findAct(document.elementFromPoint(x, y)) === r.el) h.onTap(r.el);
  }

  const opt = { passive: false } as AddEventListenerOptions;
  document.addEventListener(
    'touchstart',
    (e) => {
      lastTouchEv = Date.now();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        start('t' + t.identifier, t.target, t.clientX, t.clientY);
      }
      if (!h.scrollable && !isText(e.target as Element)) e.preventDefault();
    },
    opt,
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        move('t' + t.identifier, t.clientX, t.clientY);
      }
      if (!h.scrollable && !isText(e.target as Element)) e.preventDefault();
    },
    opt,
  );
  document.addEventListener(
    'touchend',
    (e) => {
      lastTouchEv = Date.now();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        end('t' + t.identifier, t.clientX, t.clientY);
      }
      // 疑似クリック（ダブルタップズーム含む）を止める
      if (!isText(e.target as Element) && e.cancelable) e.preventDefault();
    },
    opt,
  );
  document.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const id = 't' + e.changedTouches[i].identifier;
      const r = presses[id];
      if (r) r.el.classList.remove('pressing');
      delete presses[id];
    }
  });
  // PC 確認用（タッチ直後の疑似マウスイベントは無視）
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && Date.now() - lastTouchEv > 800) start('m', e.target, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (presses.m) move('m', e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', (e) => {
    if (Date.now() - lastTouchEv > 800) end('m', e.clientX, e.clientY);
  });
  // キーボード（Enter / Space）で押されたボタン。マウス・タッチ由来のクリックは detail > 0 なので無視
  document.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const el = findAct(e.target);
    if (el) h.onTap(el);
  });
  // 長押しメニューは出さない
  document.addEventListener('contextmenu', (e) => {
    if (!h.scrollable || findAct(e.target)) e.preventDefault();
  });
  if (!h.scrollable) document.addEventListener('gesturestart', (e) => e.preventDefault());
}
