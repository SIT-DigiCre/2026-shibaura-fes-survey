// 管理: ロゴを 5 回連続タップ → PIN → 管理画面
import { GAS_URL, downloadCsv } from '../shared/record';
import { sErr, setSound, soundOn } from './sound';
import {
  clearAll,
  deviceName,
  flush,
  lastSend,
  loadAll,
  pref,
  setDeviceName,
  setPref,
  unsent,
  fetchCount,
} from './store';
import type { Mode } from './main';

const PIN = '2026';

interface Ctx {
  getMode: () => Mode;
  setMode: (m: Mode) => void;
  closeWarn: () => void;
  onClose: () => void;
  layout: () => void;
}
let ctx: Ctx;
let from: Mode = 'idle';
let pinBuf = '';
let clearArmed = 0;
let clearT = 0;

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export function initAdmin(c: Ctx) {
  ctx = c;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '取消', '0', '←'];
  $('pkeys').innerHTML = keys
    .map(
      (k) =>
        '<button type="button" class="pk' +
        (k.length > 1 ? ' sm' : '') +
        '" data-act="pk" data-k="' +
        k +
        '">' +
        k +
        '</button>',
    )
    .join('');
}

export function openPin() {
  const m = ctx.getMode();
  if (m !== 'idle' && m !== 'survey' && m !== 'warn') return;
  const cm = document.getElementById('cm');
  if (cm) cm.blur();
  ctx.closeWarn();
  from = ctx.getMode();
  ctx.setMode('pin');
  pinBuf = '';
  drawPin();
  $('pin').className = 'ov show';
}

function close() {
  $('pin').className = 'ov';
  $('admin').className = 'ov';
  ctx.setMode(from);
  ctx.onClose();
}

function drawPin() {
  const d = $('pdots').children;
  for (let i = 0; i < d.length; i++) d[i].className = i < pinBuf.length ? 'f' : '';
}

export function pinKey(k: string) {
  if (ctx.getMode() !== 'pin') return;
  if (k === '取消') return close();
  if (k === '←') pinBuf = pinBuf.slice(0, -1);
  else if (pinBuf.length < 4) pinBuf += k;
  drawPin();
  if (pinBuf.length < 4) return;
  if (pinBuf === PIN) {
    setTimeout(() => {
      $('pin').className = 'ov';
      clearArmed = 0;
      ctx.setMode('admin');
      draw('');
      $('admin').className = 'ov show';
    }, 120);
  } else {
    sErr();
    const d = $('pdots');
    d.classList.remove('shake');
    void d.offsetWidth;
    d.classList.add('shake');
    setTimeout(() => {
      pinBuf = '';
      drawPin();
    }, 350);
  }
}

function draw(msg: string) {
  const all = loadAll();
  const un = unsent().length;
  const rot = pref('rot', '0');
  const rb = (v: string, l: string) =>
    '<button type="button" class="ab' +
    (rot === v ? ' sel' : '') +
    '" data-act="ad-rot" data-r="' +
    v +
    '">' +
    l +
    '</button>';
  $('adBody').innerHTML =
    '<p class="dlg-k">ADMIN PANEL</p>' +
    '<div class="ad-row">' +
    '<div class="ad-stat">この端末の回答<b>' +
    all.length +
    '</b>件 ／ 未送信<b>' +
    un +
    '</b>件</div>' +
    '<div class="ad-stat">送信先 ' +
    (GAS_URL ? '設定済み' : '<strong>未設定</strong>') +
    (lastSend.at ? ' ／ ' + lastSend.at + ' ' + lastSend.msg : '') +
    '</div>' +
    '</div>' +
    '<div class="ad-row"><div class="ad-btns">' +
    '<button type="button" class="ab pri" data-act="ad-send">今すぐ再送</button>' +
    '<button type="button" class="ab" data-act="ad-csv">控えを CSV で保存</button>' +
    '</div><div id="adMsg">' +
    msg +
    '</div></div>' +
    '<div class="ad-row"><div class="ad-lab">端末名（回答 ID は DC-端末名-0001 の形になります）</div><div class="ad-btns">' +
    '<input class="ad-input" id="adDev" maxlength="12" value="' +
    deviceName() +
    '" autocomplete="off" />' +
    '<button type="button" class="ab" data-act="ad-dev">保存</button></div></div>' +
    '<div class="ad-row"><div class="ad-lab">画面の向き（OS 側で回転できない場合）</div><div class="ad-btns">' +
    rb('0', '0°') +
    rb('90', '90°') +
    rb('270', '270°') +
    '</div></div>' +
    '<div class="ad-row"><div class="ad-btns">' +
    '<button type="button" class="ab' +
    (soundOn ? ' sel' : '') +
    '" data-act="ad-sound">効果音 ' +
    (soundOn ? 'ON' : 'OFF') +
    '</button>' +
    '<button type="button" class="ab" data-act="ad-fs">全画面表示</button></div></div>' +
    '<div class="ad-row"><div class="ad-btns">' +
    '<button type="button" class="ab w red' +
    (clearArmed ? ' armed' : '') +
    '" data-act="ad-clear">' +
    (clearArmed
      ? 'もう一度押すと端末内の控えを消去' + (un ? '（未送信 ' + un + ' 件も消えます）' : '')
      : '端末内の控えを全消去') +
    '</button>' +
    '<button type="button" class="ab w" data-act="ad-close">閉じてアンケートに戻る</button>' +
    '</div></div>';
}

export function adminAct(a: string, el: HTMLElement) {
  if (ctx.getMode() !== 'admin') return;
  if (a === 'ad-close') return close();
  if (a === 'ad-send') {
    draw('送信中…');
    flush(() => fetchCount(() => draw(lastSend.msg || '未送信はありません')));
    return;
  }
  if (a === 'ad-csv') {
    const ok = downloadCsv(
      loadAll().map((s) => s.rec),
      'デジクリアンケート_' + deviceName(),
    );
    return draw(ok ? 'CSV を保存しました' : 'CSV を保存できませんでした');
  }
  if (a === 'ad-dev') {
    const inp = document.getElementById('adDev') as HTMLInputElement;
    const v = inp.value.replace(/\s+/g, '');
    inp.blur();
    if (!/^[A-Za-z0-9-]{1,12}$/.test(v)) return draw('端末名は英数字と - で 12 文字まで');
    setDeviceName(v);
    return draw('端末名を「' + v + '」にしました');
  }
  if (a === 'ad-rot') {
    setPref('rot', el.getAttribute('data-r') as string);
    ctx.layout();
    return draw('');
  }
  if (a === 'ad-sound') {
    setSound(!soundOn);
    setPref('sound', soundOn ? '1' : '0');
    return draw('');
  }
  if (a === 'ad-fs') {
    const d = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const f = d.requestFullscreen || d.webkitRequestFullscreen;
    if (f) {
      try {
        const p = f.call(d) as unknown as Promise<void> | undefined;
        if (p && p.catch) p.catch(() => undefined);
      } catch {
        /* noop */
      }
    }
    return;
  }
  if (a === 'ad-clear') {
    clearTimeout(clearT);
    if (clearArmed && Date.now() - clearArmed < 5000) {
      clearArmed = 0;
      return draw(clearAll() ? '端末内の控えを消去しました' : '消去に失敗しました');
    }
    clearArmed = Date.now();
    draw('');
    clearT = window.setTimeout(() => {
      if (clearArmed && ctx.getMode() === 'admin') {
        clearArmed = 0;
        draw('');
      }
    }, 5000);
  }
}
