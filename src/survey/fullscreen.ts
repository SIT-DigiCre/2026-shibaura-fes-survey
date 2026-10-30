// 全画面表示。ブラウザはタッチやクリックの直後しか全画面にさせないので、指を離したときに試す。
import { pref, setPref } from './store';

type FsDoc = Document & { webkitFullscreenElement?: Element | null };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

export const isFullscreen = () => !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement);

export function enterFullscreen() {
  if (isFullscreen()) return;
  const d = document.documentElement as FsEl;
  const f = d.requestFullscreen || d.webkitRequestFullscreen;
  if (!f) return;
  try {
    const p = f.call(d) as unknown as Promise<void> | undefined;
    if (p && p.catch) p.catch(() => undefined);
  } catch {
    /* 全画面にできなくても動作は続ける */
  }
}

/** 自動で全画面にするか（管理画面で切り替え。初期値 ON） */
export const autoFullscreen = () => pref('autofs', '1') === '1';
export const setAutoFullscreen = (on: boolean) => setPref('autofs', on ? '1' : '0');

/** 全画面でないときにタッチされたら全画面に戻す（戻るキー等で抜けても次のタッチで戻る） */
export function installAutoFullscreen(enabled: () => boolean) {
  const tryEnter = () => {
    if (enabled() && autoFullscreen()) enterFullscreen();
  };
  document.addEventListener('touchend', tryEnter, true);
  document.addEventListener('mouseup', tryEnter, true);
}
