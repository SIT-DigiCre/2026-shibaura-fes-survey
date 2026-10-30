// 540x1920 の画面を transform で実画面に合わせる（回転 0/90/270 は管理画面から）
import { pref } from './store';

export const W0 = 540;
export const H0 = 1920;

export function fit(app: HTMLElement, onScale: (s: number) => void) {
  // ソフトキーボード表示中は動かさない
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const rot = pref('rot', '0');
  const rotated = rot === '90' || rot === '270';
  const aw = rotated ? H : W;
  const ah = rotated ? W : H;
  const s = Math.min(aw / W0, ah / H0);
  let tr: string;
  if (rot === '90')
    tr = 'translate(' + (W + H0 * s) / 2 + 'px,' + (H - W0 * s) / 2 + 'px) rotate(90deg) scale(' + s + ')';
  else if (rot === '270')
    tr = 'translate(' + (W - H0 * s) / 2 + 'px,' + (H + W0 * s) / 2 + 'px) rotate(-90deg) scale(' + s + ')';
  else tr = 'translate(' + (W - W0 * s) / 2 + 'px,' + (H - H0 * s) / 2 + 'px) scale(' + s + ')';
  app.style.webkitTransform = app.style.transform = tr;
  onScale(s);
}
