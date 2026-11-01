// 設問の定義。アンケート・ダッシュボード・CSV で共通に使う。
export const GENRES: ReadonlyArray<readonly [code: string, label: string]> = [
  ['A', 'イラスト'],
  ['B', 'MV'],
  ['C', 'ゲーム展示'],
  ['D', 'VTuber'],
  ['E', 'DTM体験'],
  ['F', '楽曲・映像視聴'],
  ['G', '文字書き'],
  ['H', '物販'],
  ['I', 'ライブ創作'],
  ['J', '企画うちよそ'],
  ['K', 'システム'],
];

export function genreName(code: string): string {
  const g = GENRES.find((x) => x[0] === code);
  return g ? g[1] : code;
}
export const genreLabel = (code: string) => code + ' ' + genreName(code);

export type QType = 'multi' | 'single' | 'tags';
export type AnswerKey = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7';

export interface Option {
  v: string;
  l: string;
  /** Q1 の A〜K */
  k?: string;
  /** Q3 の 5 段階 */
  lv?: number;
}

export interface Question {
  key: AnswerKey;
  type: QType;
  title: string;
  hint: string;
  opts: Option[];
  required?: boolean;
  /** ★BEST を選べる */
  best?: boolean;
  /** 1 列で並べる */
  one?: boolean;
  /** スマホ版だけ「その他」と記入欄を出す（サイネージは日本語入力ができないので出さない） */
  other?: boolean;
  /** ダッシュボードの見出し */
  short: string;
}

/** 「その他」の値。記入した内容は SurveyRecord.text に入る */
export const OTHER = 'その他';

const plain = (a: string[]): Option[] => a.map((v) => ({ v, l: v }));

export const QUESTIONS: Question[] = [
  {
    key: 'q1',
    type: 'multi',
    best: true,
    required: true,
    title: '良いと思った展示・体験は？',
    hint: 'いくつでも選べます。特に良かったもの1つは<br>右の <b>☆BEST</b> をタッチ',
    opts: GENRES.map(([k, l]) => ({ v: k, l, k })),
    short: '良いと思った展示・体験',
  },
  {
    key: 'q2',
    other: true,
    type: 'multi',
    title: '良かった理由は？',
    hint: 'いくつでも選べます',
    opts: plain(['感動した', '体験できるのが良かった', '面白かった', '目新しさがあった', 'スタッフの対応が良かった']),
    short: '良かった理由',
  },
  {
    key: 'q3',
    type: 'single',
    one: true,
    title: 'ブース全体の評価は？',
    hint: 'ひとつ選んでください',
    opts: [
      { v: '大変良かった', l: '大変良かった', lv: 5 },
      { v: '良いと思う', l: '良いと思う', lv: 4 },
      { v: '普通', l: '普通', lv: 3 },
      { v: '微妙', l: '微妙', lv: 2 },
      { v: '要改善', l: '要改善', lv: 1 },
    ],
    short: 'ブース全体の評価',
  },
  {
    key: 'q4',
    other: true,
    type: 'multi',
    title: '部員の対応はどうでしたか？',
    hint: 'いくつでも選べます',
    opts: plain(['フレンドリー', '説明が分かりやすい', '丁寧な対応', 'ためになった', '技量を感じる']),
    short: '部員の対応',
  },
  {
    key: 'q5',
    type: 'single',
    title: '年齢を教えてください',
    hint: 'ひとつ選んでください',
    opts: plain(['10代未満', '10代', '20代', '30代', '40代', '50代', '60代以上']),
    short: '年齢',
  },
  {
    key: 'q6',
    other: true,
    type: 'single',
    title: '職業・属性を教えてください',
    // 重なる属性は、より狭い方（デジクリ）を選んでもらう。二重に数えないようひとつだけ
    hint: 'ひとつ選んでください。<br /><b>デジクリの方</b>はデジクリの項目を',
    opts: plain([
      '中学生',
      '高校生',
      'デジクリ部員',
      'デジクリ OB・OG',
      '芝浦工大生(現役)',
      '芝浦工大 OB・OG',
      '他大学の学生',
      '部員の保護者',
      '一般(中学・高校生を除く)',
    ]),
    short: '職業・属性',
  },
  {
    key: 'q7',
    other: true,
    type: 'tags',
    title: '改善点・コメント（任意）',
    hint: 'あてはまるものをいくつでも',
    opts: plain([
      '展示が見やすかった',
      '曲がカッコいい',
      'ゲームが面白い',
      'もっと体験したい',
      '少し混んでた',
      'また来たい！',
    ]),
    short: 'ひとこと',
  },
];

/** Q3 の点数（大変良かった=5 〜 要改善=1） */
export function ratingScore(v: string): number {
  const o = QUESTIONS[2].opts.find((x) => x.v === v);
  return o && o.lv ? o.lv : 0;
}
