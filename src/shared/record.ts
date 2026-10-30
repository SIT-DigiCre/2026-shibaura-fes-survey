import { GAS_URL as CONFIG_GAS_URL } from '../config';

// 1 件の回答。この形のまま GAS に送り、スプレッドシートの 1 行になる。
// 複数選択は ' / ' 区切りの文字列（スプレッドシートで読めるように）。
export interface SurveyRecord {
  id: string;
  /** 回答日時（端末のローカル時刻、+09:00 付き ISO） */
  at: string;
  src: 'signage' | 'phone';
  device: string;
  /** 例: 'A イラスト / C ゲーム展示' */
  q1: string;
  /** 例: 'C ゲーム展示' */
  best: string;
  q2: string;
  q3: string;
  q4: string;
  q5: string;
  q6: string;
  /** Q7 のタグ（' / ' 区切り） */
  q7: string;
  /** スマホ版の「その他」の記入。例: '良かった理由: ○○ / ひとこと: △△' */
  text: string;
  /** GAS が受け取った日時（GAS 側で付ける） */
  received?: string;
}

/** スプレッドシート・CSV の列順。gas/Code.gs の KEYS と揃えること */
export const COLUMNS: ReadonlyArray<readonly [keyof SurveyRecord, string]> = [
  ['id', 'ID'],
  ['at', '回答日時'],
  ['src', '回答元'],
  ['device', '端末'],
  ['q1', '良いと思った展示'],
  ['best', '特に良かった展示(★BEST)'],
  ['q2', '良かった理由'],
  ['q3', '全体評価'],
  ['q4', '部員の対応'],
  ['q5', '年齢'],
  ['q6', '属性'],
  ['q7', 'ひとこと'],
  ['text', '自由コメント'],
  ['received', '受信日時'],
];

export const SEP = ' / ';
export const split = (s: string | undefined) => (s ? s.split(SEP).filter(Boolean) : []);

export function pad(n: number | string, w = 2): string {
  let s = String(n);
  while (s.length < w) s = '0' + s;
  return s;
}

export function isoLocal(d: Date): string {
  let o = -d.getTimezoneOffset();
  const sign = o >= 0 ? '+' : '-';
  o = Math.abs(o);
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds()) +
    sign +
    pad(Math.floor(o / 60)) +
    ':' +
    pad(o % 60)
  );
}

/** = + - @ で始まる値は Excel で数式になるので ' を付ける（CSV インジェクション対策） */
function csvCell(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(records: SurveyRecord[]): string {
  const lines = [COLUMNS.map((c) => csvCell(c[1])).join(',')];
  for (const r of records) lines.push(COLUMNS.map((c) => csvCell(r[c[0]])).join(','));
  // Excel で文字化けしないよう BOM 付き
  return '﻿' + lines.join('\r\n');
}

export function fileStamp(d = new Date()): string {
  const s = isoLocal(d);
  return s.slice(0, 10).replace(/-/g, '') + '_' + s.slice(11, 16).replace(':', '');
}

export function downloadCsv(records: SurveyRecord[], name = 'デジクリアンケート'): boolean {
  try {
    const blob = new Blob([toCsv(records)], { type: 'text/csv' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name + '_' + fileStamp() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch {
    return false;
  }
}

// 送信先は src/config.ts。ビルド時に VITE_GAS_URL があればそちらを優先する（テストではモックに差し替える）
export const GAS_URL: string = (import.meta.env.VITE_GAS_URL as string | undefined) || CONFIG_GAS_URL;
