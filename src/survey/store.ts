// 端末内の保存と送信。回答は必ず localStorage に保存してから送る。
// 送れなかった分は起動時と待ち受け中 90 秒ごとに再送する（失敗は来場者に見せない）。
// 同じ ID を何度送っても GAS 側で重複を無視するので、送れたか分からないときは送り直してよい。
import { GAS_URL, pad, type SurveyRecord } from '../shared/record';

const NS = 'digicre_survey_2026';
const REC_KEY = NS + '.records';

export function pref(k: string, d: string): string {
  try {
    const v = localStorage.getItem(NS + '.' + k);
    return v === null ? d : v;
  } catch {
    return d;
  }
}
export function setPref(k: string, v: string) {
  try {
    localStorage.setItem(NS + '.' + k, v);
  } catch {
    /* noop */
  }
}

export interface Stored {
  rec: SurveyRecord;
  sent: boolean;
}

export function loadAll(): Stored[] {
  try {
    const a = JSON.parse(localStorage.getItem(REC_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
function saveAll(a: Stored[]): boolean {
  try {
    localStorage.setItem(REC_KEY, JSON.stringify(a));
    return true;
  } catch {
    return false;
  }
}
export const unsent = () => loadAll().filter((s) => !s.sent);

export function clearAll(): boolean {
  return saveAll([]);
}

/** 端末名（ID に入る）。英数字と - のみ */
export const deviceName = () => pref('device', 'S1');
export function setDeviceName(v: string) {
  setPref('device', v);
}

export function newId(phone: boolean): string {
  if (phone) {
    let r = '';
    const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 8; i++) r += cs.charAt(Math.floor(Math.random() * cs.length));
    return 'DC-P-' + r;
  }
  // 連番は消去しても戻さない（書き出したファイルと ID が重ならないように）
  const n = (parseInt(pref('seq', '0'), 10) || 0) + 1;
  setPref('seq', String(n));
  return 'DC-' + deviceName() + '-' + pad(n, 4);
}

/** 保存できなければ false（そのときはお礼を出さない） */
export function saveRecord(rec: SurveyRecord): boolean {
  const all = loadAll();
  all.push({ rec, sent: false });
  if (!saveAll(all)) return false;
  sinceCount++;
  return true;
}

function markSent(ids: string[]) {
  const all = loadAll();
  for (const s of all) if (ids.indexOf(s.rec.id) >= 0) s.sent = true;
  saveAll(all);
}

function xhr(method: 'GET' | 'POST', url: string, body: string | null, cb: (res: unknown) => void) {
  try {
    const x = new XMLHttpRequest();
    x.open(method, url, true);
    x.timeout = 20000;
    // text/plain にするとプリフライトが出ない（GAS は OPTIONS に答えられない）
    if (body !== null) x.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
    x.onload = () => {
      let r: unknown = null;
      if (x.status === 200) {
        try {
          r = JSON.parse(x.responseText);
        } catch {
          r = null;
        }
      }
      cb(r);
    };
    x.onerror = x.ontimeout = () => cb(null);
    x.send(body);
  } catch {
    cb(null);
  }
}

let busy = false;
export const lastSend = { at: '', ok: false, msg: '' };

/** 未送信をまとめて送る */
export function flush(done?: () => void) {
  const list = unsent();
  if (!GAS_URL || busy || !list.length) {
    if (!GAS_URL && list.length) lastSend.msg = '送信先が未設定（VITE_GAS_URL）';
    if (done) done();
    return;
  }
  busy = true;
  xhr('POST', GAS_URL, JSON.stringify({ records: list.map((s) => s.rec) }), (r) => {
    busy = false;
    const res = r as { ok?: boolean; ids?: string[] } | null;
    lastSend.at = new Date().toLocaleTimeString('ja-JP');
    if (res && res.ok && Array.isArray(res.ids)) {
      markSent(res.ids);
      lastSend.ok = true;
      lastSend.msg = res.ids.length + ' 件送信';
    } else {
      lastSend.ok = false;
      lastSend.msg = '送信失敗（あとで再送）';
    }
    if (done) done();
  });
}

// 表示する回答数: サーバーの件数（最後に取れた値）＋ それ以降にこの端末で増えた分。
// 一度も取れていなければ端末内の件数。
let remote = parseInt(pref('remoteCount', '-1'), 10);
let sinceCount = 0;
export function totalCount(): number {
  if (remote >= 0) return remote + sinceCount;
  return loadAll().length;
}
export function fetchCount(done?: () => void) {
  if (!GAS_URL) {
    if (done) done();
    return;
  }
  xhr('GET', GAS_URL + (GAS_URL.indexOf('?') >= 0 ? '&' : '?') + 'count=1', null, (r) => {
    const res = r as { ok?: boolean; count?: number } | null;
    if (res && res.ok && typeof res.count === 'number') {
      // 自端末の未送信分はまだサーバーにないので足す
      remote = res.count;
      sinceCount = unsent().length;
      setPref('remoteCount', String(remote));
    }
    if (done) done();
  });
}
