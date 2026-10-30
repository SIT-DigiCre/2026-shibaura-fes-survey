// gas/Code.gs を Apps Script のモックの上で動かして確認する（ブラウザは使わない）
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadGas(dashKey: string | null) {
  const cells: string[][] = [];
  const range = (r: number, c: number, nr: number, nc: number) => ({
    setValues(v: string[][]) {
      for (let i = 0; i < nr; i++) cells[r - 1 + i] = v[i].slice(0, nc);
      return this;
    },
    getValues: () => cells.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
    // 表示値では先頭の ' が消える
    getDisplayValues: () =>
      cells.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc).map((s) => s.replace(/^'/, ''))),
    setNumberFormat() {
      return this;
    },
    setFontWeight() {
      return this;
    },
  });
  const sheet = {
    getLastRow: () => cells.length,
    getMaxRows: () => 1000,
    getRange: range,
    setFrozenRows: () => undefined,
  };
  let created = false;
  const ctx = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => (created ? sheet : null),
        insertSheet: () => ((created = true), sheet),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    Utilities: { formatDate: () => '2026-10-31T10:00:00+09:00' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => dashKey }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s: string) => ({ setMimeType: () => ({ body: JSON.parse(s) }) }),
    },
    Logger: { log: () => undefined },
  });
  vm.runInContext(readFileSync('gas/Code.gs', 'utf8'), ctx);
  const g = ctx as unknown as {
    doPost: (e: unknown) => { body: Record<string, unknown> };
    doGet: (e: unknown) => { body: Record<string, unknown> };
  };
  return {
    cells,
    post: (body: unknown) => g.doPost({ postData: { contents: JSON.stringify(body) } }).body,
    get: (parameter: Record<string, string> = {}) => g.doGet({ parameter }).body,
  };
}

const rec = (id: string, extra: Record<string, string> = {}) => ({
  id,
  at: '2026-10-31T10:00:00+09:00',
  src: 'signage',
  device: 'S1',
  q1: 'A イラスト',
  best: '',
  q2: '',
  q3: '大変良かった',
  q4: '',
  q5: '',
  q6: '',
  q7: '',
  text: 'たのしかった',
  ...extra,
});

test('doPost: 追記して、同じ ID は無視する', () => {
  const g = loadGas('secret');
  expect(g.post(rec('DC-S1-0001'))).toEqual({ ok: true, ids: ['DC-S1-0001'], added: 1 });
  expect(g.post({ records: [rec('DC-S1-0001'), rec('DC-S1-0002')] })).toEqual({
    ok: true,
    ids: ['DC-S1-0001', 'DC-S1-0002'],
    added: 1,
  });
  expect(g.cells.length).toBe(3); // 見出し + 2 件
  expect(g.cells[0][0]).toBe('ID');
  expect(g.cells[2][13]).toBe('2026-10-31T10:00:00+09:00');
  expect(g.get({ count: '1' })).toEqual({ ok: true, count: 2 });
});

test('doPost: 不正な ID は捨て、数式になる値は無害化する', () => {
  const g = loadGas('secret');
  const r = g.post({ records: [rec('../etc'), rec('DC-P-ABCD2345', { text: '=HYPERLINK("x")' })] });
  expect(r).toEqual({ ok: true, ids: ['DC-P-ABCD2345'], added: 1 });
  expect(g.cells[1][12]).toBe('\'=HYPERLINK("x")');
});

test('doGet: 合言葉が合うときだけ自由コメントを返す', () => {
  const g = loadGas('secret');
  g.post(rec('DC-S1-0001'));
  const locked = g.get() as { auth: boolean; rows: Record<string, string>[] };
  expect(locked.auth).toBe(false);
  expect(locked.rows[0].text).toBeUndefined();
  expect(locked.rows[0].q1).toBe('A イラスト');
  expect((g.get({ key: 'wrong' }) as { auth: boolean }).auth).toBe(false);
  const open = g.get({ key: 'secret' }) as { auth: boolean; rows: Record<string, string>[] };
  expect(open.auth).toBe(true);
  expect(open.rows[0].text).toBe('たのしかった');
});

test('doGet: DASH_KEY 未設定なら誰にもコメントを返さない', () => {
  const g = loadGas(null);
  g.post(rec('DC-S1-0001'));
  expect((g.get({ key: '' }) as { auth: boolean }).auth).toBe(false);
});
