// 集計ダッシュボード（/dashboard/。?demo=1 でサンプルデータ）
import './style.css';
import { GAS_URL, downloadCsv, fileStamp, isoLocal, type SurveyRecord } from '../shared/record';
import { aggregate, type Count } from './aggregate';
import { DEMO_DAYS, demoRows } from './demo';

const DEMO = /[?&]demo=1(&|$)/.test(location.search);
const REFRESH_MS = 60000;
const COMMENTS_STEP = 20;
const KEY_STORE = 'digicre_dash_key';
const FILE_NAME = 'デジクリアンケート集計';
const PNG_WIDTH = 1440;

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const pct = (n: number, max: number) => (max ? Math.round((n / max) * 100) : 0);

let rows: SurveyRecord[] = [];
let auth = false;
let commentsShown = COMMENTS_STEP;
let printing = false;
let key = '';
try {
  key = sessionStorage.getItem(KEY_STORE) || '';
} catch {
  /* noop */
}

function notice(msg: string) {
  const el = $('notice');
  el.textContent = msg;
  el.hidden = !msg;
}

async function load(): Promise<void> {
  if (DEMO) {
    rows = demoRows();
    auth = !!key;
    $('updated').textContent = new Date().toLocaleTimeString('ja-JP');
    render();
    return;
  }
  if (!GAS_URL) {
    notice('送信先（VITE_GAS_URL）が未設定です。?demo=1 を付けるとサンプルデータで表示できます。');
    render();
    return;
  }
  try {
    const url =
      GAS_URL + (GAS_URL.indexOf('?') >= 0 ? '&' : '?') + (key ? 'key=' + encodeURIComponent(key) : 't=' + Date.now());
    const res = await fetch(url, { cache: 'no-store' });
    const data = (await res.json()) as { ok: boolean; auth: boolean; rows: SurveyRecord[]; updated: string };
    if (!data.ok) throw new Error('bad response');
    rows = data.rows;
    if (key && !data.auth) {
      setKey('');
      $('keyErr').textContent = '合言葉が違います';
    }
    auth = data.auth;
    $('updated').textContent = new Date().toLocaleTimeString('ja-JP');
    notice('');
  } catch {
    notice('データを取得できませんでした（前回のデータを表示しています）。60秒後に再試行します。');
  }
  render();
}

function setKey(k: string) {
  key = k;
  try {
    if (k) sessionStorage.setItem(KEY_STORE, k);
    else sessionStorage.removeItem(KEY_STORE);
  } catch {
    /* noop */
  }
}

/* ================= 描画 ================= */
function barRows(list: Count[], cls: string, labelW: string) {
  const max = Math.max(1, ...list.map((x) => x.n));
  return list
    .map(
      (x) =>
        '<div class="bar-row ' +
        cls +
        '"><span class="bar-l" style="flex-basis:' +
        labelW +
        '" title="' +
        esc(x.label) +
        '">' +
        esc(x.label) +
        '</span><div class="track"><div class="fill" style="width:' +
        pct(x.n, max) +
        '%"></div></div><span class="bar-n hud">' +
        x.n +
        '</span></div>',
    )
    .join('');
}

function render() {
  const d = DEMO ? new Date(DEMO_DAYS[DEMO_DAYS.length - 1] + 'T12:00:00') : new Date();
  const a = aggregate(rows, isoLocal(d).slice(0, 10));
  const wd = '日月火水木金土'.charAt(d.getDay());

  const kpi = (label: string, value: string, unit: string, note: string) =>
    '<div class="panel kpi"><div class="kpi-l">' +
    label +
    '</div><div class="kpi-v"><span class="kpi-n hud">' +
    esc(value) +
    '</span><span class="kpi-u">' +
    esc(unit) +
    '</span></div><div class="kpi-note">' +
    esc(note) +
    '</div></div>';
  $('kpis').innerHTML =
    kpi('総回答数', String(a.total), '件', 'サイネージ ' + a.signage + ' ／ スマホ ' + a.phone) +
    kpi('今日の回答', String(a.todayN), '件', d.getMonth() + 1 + '/' + d.getDate() + '（' + wd + '）') +
    kpi('ブース全体の評価', a.rated ? a.avg.toFixed(2) : '-', '/ 5', '大変良かった=5 〜 要改善=1') +
    (a.top
      ? kpi('★BEST 1位', a.top.code, a.top.label, a.top.b + '票（BEST全体の' + pct(a.top.b, a.bestTotal) + '%）')
      : kpi('★BEST 1位', '-', '', 'まだありません'));

  const gmax = Math.max(1, ...a.genres.map((g) => g.n));
  $('genres').innerHTML = a.genres
    .map(
      (g) =>
        '<div class="genre"><div class="genre-l"><span class="key hud">' +
        g.code +
        '</span>' +
        esc(g.label) +
        '</div>' +
        '<div class="genre-bars">' +
        '<div class="gb"><div class="gb-fill deep" style="width:' +
        Math.round((g.n / gmax) * 92) +
        '%"></div><span class="hud">' +
        g.n +
        '</span></div>' +
        '<div class="gb best"><div class="gb-fill cyan" style="width:' +
        Math.round((g.b / gmax) * 92) +
        '%"></div><span class="hud sub">★' +
        g.b +
        '</span></div>' +
        '</div></div>',
    )
    .join('');

  $('rating').innerHTML = barRows(a.rating, 'lg', '100px');

  const hmax = Math.max(1, ...a.hours.map((h) => h.n));
  const peak = a.hours.reduce((p, h) => (h.n > p.n ? h : p), a.hours[0]);
  $('hours').innerHTML = a.hours
    .map(
      (h) =>
        '<div class="hcol"><span class="hud">' +
        h.n +
        '</span><div class="hbar' +
        (h === peak && h.n ? ' peak' : '') +
        '" style="height:' +
        Math.round((h.n / hmax) * (printing ? 96 : 150)) +
        'px"></div></div>',
    )
    .join('');
  // 列が多いときはラベルを間引く（重ならないように）
  const hstep = Math.ceil(a.hours.length / 8);
  $('hoursX').innerHTML = a.hours.map((h, i) => '<span class="hud">' + (i % hstep ? '' : h.label) + '</span>').join('');

  $('panels').innerHTML = a.panels
    .map(
      (p) =>
        '<div class="panel panel-in small"><h2>' +
        p.title +
        '</h2><div class="bars">' +
        barRows(p.rows, '', '132px') +
        '</div></div>',
    )
    .join('');

  // コメント・CSV は合言葉で解除したときだけ
  $('export').hidden = !auth;
  $('locked').hidden = auth;
  if (auth) {
    $('csv').textContent = 'CSVをダウンロード（全' + rows.length + '件）';
    const rest = a.comments.length - commentsShown;
    $('comments').innerHTML = a.comments.length
      ? a.comments
          .slice(0, commentsShown)
          .map(
            (c) =>
              '<div class="cm"><span class="cm-t hud">' +
              esc(c.at.slice(5, 16).replace('-', '/').replace('T', ' ')) +
              '</span><span class="cm-src">' +
              c.src +
              '</span><span class="cm-x">' +
              esc(c.text) +
              '</span></div>',
          )
          .join('') +
        (rest > 0
          ? '<button type="button" class="btn ghost more" id="more">もっと見る（残り' + rest + '件）</button>'
          : '')
      : '<p class="muted cm-empty">まだコメントはありません</p>';
  }
}

/* ================= PNG 保存 ================= */
/**
 * 画面を PNG にして保存する。どの端末でも同じ幅の横長レイアウトで、載せるものは印刷と同じ（操作部・コメントは載せない）。
 * html2canvas は押したときにだけ読み込む。
 */
async function savePng() {
  const btn = $('png') as HTMLButtonElement;
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '作成中…';
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(document.documentElement, {
      backgroundColor: '#fff',
      scale: 2,
      windowWidth: PNG_WIDTH,
      windowHeight: 800,
      scrollX: 0,
      scrollY: 0,
      logging: false,
      ignoreElements: (el) => el.classList.contains('no-print'),
      onclone: (doc) => {
        const at = doc.getElementById('printedAt') as HTMLElement;
        at.textContent = new Date().toLocaleString('ja-JP');
        (at.parentElement as HTMLElement).style.display = 'inline';
        // 画像ではホバーで全文を読めないので、項目名は省略せず折り返す
        const style = doc.createElement('style');
        style.textContent = '.bar-l { overflow: visible; white-space: normal; }';
        doc.head.appendChild(style);
      },
    });
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    if (!blob) throw new Error('toBlob');
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = FILE_NAME + '_' + fileStamp() + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    notice('PNGを保存できませんでした。もう一度お試しください。');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ================= 操作 ================= */
$('locked').addEventListener('submit', (e) => {
  e.preventDefault();
  const inp = $('dash-key') as HTMLInputElement;
  const k = inp.value.trim();
  $('keyErr').textContent = '';
  if (!k) {
    $('keyErr').textContent = '合言葉を入れてください';
    return;
  }
  inp.value = '';
  setKey(k);
  load();
});
$('lock').addEventListener('click', () => {
  setKey('');
  auth = false;
  // 次の取得までコメントを手元に残さない
  rows = rows.map((r) => ({ ...r, text: '' }));
  if (!DEMO) load();
  else render();
});
$('comments').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id !== 'more') return;
  commentsShown += 50;
  render();
});
$('csv').addEventListener('click', () => {
  if (auth) downloadCsv(rows);
});
$('png').addEventListener('click', savePng);
// Ctrl+P でも同じ内容になるよう beforeprint で整える。title は PDF の既定のファイル名になる
const pageTitle = document.title;
window.addEventListener('beforeprint', () => {
  printing = true;
  document.title = FILE_NAME + '_' + fileStamp();
  $('printedAt').textContent = new Date().toLocaleString('ja-JP');
  render();
});
window.addEventListener('afterprint', () => {
  printing = false;
  document.title = pageTitle;
  render();
});
$('fs').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => undefined);
});

if (DEMO) {
  $('demoBadge').hidden = false;
  notice('サンプルデータを表示しています（デモでは任意の合言葉で解除できます）。');
}
load();
setInterval(load, REFRESH_MS);
