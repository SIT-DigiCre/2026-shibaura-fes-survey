// サイネージ版かスマホ版か。
// ?m=phone / ?m=signage で明示できる（?m=signage はその端末に記憶する）。
// 指定がなければ、スマホの OS で指で操作する端末のうち、画面が小さく、縦横比がサイネージ（540×1920 = 約 3.6:1）ほど細長くなければスマホ版。
// 縦横比で見るのは、端末の画素密度に左右されないため。
import { pref, setPref } from './store';

/** スマホの OS で、主な操作が指か。PC（Windows / Mac / Linux）はタッチ対応でも false */
function touchFirst() {
  if (!/Android|iPhone|iPod/.test(navigator.userAgent)) return false;
  return !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

/** 管理画面で設定したり回答を受け付けたりしたことがある端末はサイネージ */
function usedAsSignage() {
  return (
    pref('mode', '') === 'signage' || pref('device', '') !== '' || pref('seq', '') !== '' || pref('rot', '') !== ''
  );
}

export function detectPhone(search: string): boolean {
  const m = /[?&]m=(phone|signage)(&|$)/.exec(search);
  if (m && m[1] === 'phone') return true;
  if (m && m[1] === 'signage') {
    setPref('mode', 'signage');
    return false;
  }
  if (usedAsSignage() || !touchFirst()) return false;
  const a = screen.width;
  const b = screen.height;
  const short = Math.min(a, b);
  const long = Math.max(a, b);
  return short > 0 && short <= 600 && long / short < 3;
}
