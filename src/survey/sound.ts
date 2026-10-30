// 効果音（WebAudio で合成。音声ファイルは持たない）
import { pref } from './store';

type Ctx = AudioContext;
let actx: Ctx | null = null;
export let soundOn = pref('sound', '1') === '1';

export function setSound(on: boolean) {
  soundOn = on;
  unlockAudio();
}

/** 最初のタッチで作る（自動再生の制限のため） */
export function unlockAudio() {
  if (actx || !soundOn) return;
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const C = w.AudioContext || w.webkitAudioContext;
    if (C) actx = new C();
  } catch {
    /* 音が出なくても動作は続ける */
  }
}

export function tone(f: number, dur: number, vol = 0.05, type: OscillatorType = 'square', f2?: number) {
  if (!actx || !soundOn) return;
  try {
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* noop */
  }
}

export const sClick = () => tone(1400, 0.04, 0.04);
export function sKaran(i: number) {
  const b = 1800 + (i % 6) * 160;
  tone(b, 0.09, 0.05, 'triangle');
  setTimeout(() => tone(b * 1.34, 0.14, 0.035, 'triangle'), 55);
}
export function sBest() {
  tone(880, 0.08);
  setTimeout(() => tone(1320, 0.08), 70);
  setTimeout(() => tone(1760, 0.16), 140);
}
export const sOut = () => tone(600, 0.1, 0.04, 'square', 200);
export const sErr = () => tone(160, 0.18, 0.06);
export function sThanks() {
  [988, 1319, 1568, 1976].forEach((f, i) => setTimeout(() => tone(f, 0.18), i * 90));
}
