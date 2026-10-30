/**
 * デジクリ評価アンケート（芝浦祭 2026）受け口
 *
 * スプレッドシートの「拡張機能 > Apps Script」に貼り付け、ウェブアプリとしてデプロイする（README 参照）。
 *
 *   doPost … 回答を追記する。本文は 1 件のレコード、または { records: [...] }。
 *            同じ ID はすでにあれば無視する（端末は「送れたか分からないもの」を何度でも送り直すため）。
 *            返り値 { ok: true, ids: [受け付けた ID], added: 新しく書いた件数 }
 *   doGet  … 全件を JSON で返す { ok, auth, updated, rows: [...] }。
 *            ?count=1 なら件数だけ { ok, count }。
 *            ?key=合言葉 がスクリプトプロパティ DASH_KEY と一致したときだけ自由コメント（text）を含める。
 *
 * 列の並びは src/shared/record.ts の COLUMNS と揃えること。
 */
var SHEET_NAME = '回答';
var KEYS = ['id', 'at', 'src', 'device', 'q1', 'best', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'text', 'received'];
var HEAD = [
  'ID',
  '回答日時',
  '回答元',
  '端末',
  '良いと思った展示',
  '特に良かった展示(★BEST)',
  '良かった理由',
  '全体評価',
  '部員の対応',
  '年齢',
  '属性',
  'ひとこと',
  '自由コメント',
  '受信日時',
];
/** 鍵がないと返さない列 */
var PRIVATE_KEYS = ['text'];
var MAX_LEN = 500;
var MAX_RECORDS = 200;

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var recs = body && Object.prototype.toString.call(body.records) === '[object Array]' ? body.records : [body];
    if (recs.length > MAX_RECORDS) return json_({ ok: false, error: 'too many records' });

    var sh = sheet_();
    var seen = existingIds_(sh);
    var received = Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss'+09:00'");
    var rows = [];
    var ids = [];
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (!r || typeof r.id !== 'string' || !/^DC-[A-Za-z0-9-]{1,40}$/.test(r.id)) continue;
      ids.push(r.id);
      if (seen[r.id]) continue; // 重複は無視（でも受け付けた扱いにして、端末側の再送を止める）
      seen[r.id] = true;
      var row = [];
      for (var k = 0; k < KEYS.length; k++) row.push(KEYS[k] === 'received' ? received : clean_(r[KEYS[k]]));
      rows.push(row);
    }
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, KEYS.length).setValues(rows);
    return json_({ ok: true, ids: ids, added: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var sh = sheet_();
  var n = Math.max(0, sh.getLastRow() - 1);
  if (p.count) return json_({ ok: true, count: n });

  var auth = isAuthorized_(p.key);
  var values = n ? sh.getRange(2, 1, n, KEYS.length).getDisplayValues() : [];
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var o = {};
    for (var k = 0; k < KEYS.length; k++) {
      if (!auth && PRIVATE_KEYS.indexOf(KEYS[k]) >= 0) continue;
      o[KEYS[k]] = values[i][k];
    }
    rows.push(o);
  }
  return json_({
    ok: true,
    auth: auth,
    updated: Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss'+09:00'"),
    rows: rows,
  });
}

/** 初回に一度だけ実行: シートと見出しを作る */
function setup() {
  sheet_();
  if (!PropertiesService.getScriptProperties().getProperty('DASH_KEY')) {
    Logger.log('スクリプトプロパティ DASH_KEY（ダッシュボードの合言葉）を設定してください');
  }
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    // 日付や数値に勝手に変換されないよう、全部プレーンテキストにする
    sh.getRange(1, 1, sh.getMaxRows(), KEYS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function existingIds_(sh) {
  var seen = {};
  var n = sh.getLastRow() - 1;
  if (n <= 0) return seen;
  var col = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < col.length; i++) seen[String(col[i][0])] = true;
  return seen;
}

/** 文字列にして長さを抑え、= + - @ で始まるものは数式にならないよう ' を付ける */
function clean_(v) {
  var s = v === undefined || v === null ? '' : String(v);
  if (s.length > MAX_LEN) s = s.slice(0, MAX_LEN);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function isAuthorized_(key) {
  var want = PropertiesService.getScriptProperties().getProperty('DASH_KEY');
  return !!want && typeof key === 'string' && key === want;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
