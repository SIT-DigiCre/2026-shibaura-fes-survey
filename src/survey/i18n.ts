// 英語表示。日本語は index.html と shared/questions.ts が元で、ここには英語だけを置く。
// 表示を変えるだけで、送信する値（Option.v）は日本語のまま（集計とスプレッドシートを言語で分けないため）。
export type Lang = 'ja' | 'en';

export let lang: Lang = 'ja';

/** 設問・選択肢・ボタンなど、JS で描く文字。キーは日本語の文字列そのもの */
const EN: Record<string, string> = {
  // Q1
  '良いと思った展示・体験は？': 'Which exhibits or activities did you like?',
  'いくつでも選べます。特に良かったもの1つは<br>右の <b>☆BEST</b> をタッチ':
    'Choose as many as you like. Tap <b>☆BEST</b> on your one favorite',
  イラスト: 'Illustration',
  MV: 'Music videos',
  ゲーム展示: 'Games',
  DTM体験: 'DTM Experiment',
  '楽曲・映像視聴': 'Music & video',
  文字書き: 'Creative writing',
  物販: 'Merchandise',
  ライブ創作: 'Live creation',
  企画うちよそ: 'OC crossover project',
  // Q2
  '良かった理由は？': 'What did you like about it?',
  いくつでも選べます: 'Choose as many as you like',
  感動した: 'It moved me',
  体験できるのが良かった: 'Hands-on experience',
  面白かった: 'It was fun',
  目新しさがあった: 'It felt fresh',
  スタッフの対応が良かった: 'Helpful staff',
  // Q3
  'ブース全体の評価は？': 'How was the booth overall?',
  ひとつ選んでください: 'Choose one',
  大変良かった: 'Excellent',
  良いと思う: 'Good',
  普通: 'Average',
  微妙: 'Not great',
  要改善: 'Needs improvement',
  評価: 'Rating',
  // Q4
  '部員の対応はどうでしたか？': 'How were our club members?',
  フレンドリー: 'Friendly',
  説明が分かりやすい: 'Clear explanations',
  丁寧な対応: 'Courteous',
  ためになった: 'I learned something',
  技量を感じる: 'Skilled',
  // Q5
  年齢を教えてください: 'How old are you?',
  '10代未満': 'Under 10',
  '10代': '10–19',
  '20代': '20–29',
  '30代': '30–39',
  '40代': '40–49',
  '50代': '50–59',
  '60代以上': '60 or over',
  // Q6
  '職業・属性を教えてください': 'Which best describes you?',
  中学生: 'Junior high student',
  高校生: 'High school student',
  '芝浦工大生(現役)': 'Shibaura Tech student',
  他大学の学生: 'Other university student',
  '芝浦工大 OB・OG': 'Shibaura Tech alum',
  デジクリ部員: 'Digicre member',
  'デジクリ OB・OG': 'Digicre alum',
  部員の保護者: "Member's family",
  '一般(中学・高校生を除く)': 'General public',
  // Q7
  '改善点・コメント（任意）': 'Feedback (optional)',
  あてはまるものをいくつでも: 'Choose any that apply',
  展示が見やすかった: 'Easy-to-see exhibits',
  曲がカッコいい: 'Cool music',
  ゲームが面白い: 'Fun games',
  もっと体験したい: 'I want to try more',
  少し混んでた: 'A bit crowded',
  'また来たい！': "I'd come again!",
  // その他
  その他: 'Other',
  'その他：': 'Other: ',
  'その他の内容（任意）': 'Details (optional)',
  自由に書いてください: 'Write anything you like',
  // ボタン
  送信する: 'Submit',
  Q1に答えてね: 'Please answer Q1',
  えらんでね: 'Choose at least one',
  'つぎへ ▶': 'Next ▶',
  'スキップ ▶': 'Skip ▶',
  '保存エラー：スタッフへ': 'Error: please ask staff',
  進捗: 'Progress',
};

/** index.html の data-t の要素の中身 */
const EN_STATIC: Record<string, string> = {
  present: 'Free<br />illustration card',
  subTitle: 'Shibaura Festival 2026 / Booth Survey',
  subCount: 'Responses <b class="js-total">0</b>',
  back: '◀ Back',
  stockN: 'Tap to edit',
  stockEmpty: 'Your answers turn into chips<br />and drop down here',
  tyMsg: 'Thank you for<br />your answers!',
  tyGift: 'Choose one free<br />illustration card!',
  warnT: 'Still answering?',
  warnS: 'Back to start in <b id="wc">20</b> seconds',
  keep: 'Keep answering',
};

const jaStatic: Record<string, string> = {};

export function tr(s: string): string {
  return (lang === 'en' && EN[s]) || s;
}

export function quote(s: string): string {
  return lang === 'en' ? '“' + s + '”' : '「' + s + '」';
}

/** 選択肢の文字を小さくする長さ（英語は 1 文字の幅が狭い） */
export function longLabel(s: string, hasKey: boolean): boolean {
  return lang === 'en' ? s.length > (hasKey ? 8 : 15) : s.length > (hasKey ? 5 : 8);
}

/** 画面に書いてある文字を差し替える。中の .js-total は作り直すので、呼んだ側で描き直す */
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.setAttribute('lang', l);
  const els = document.querySelectorAll('[data-t]');
  for (let i = 0; i < els.length; i++) {
    const k = els[i].getAttribute('data-t') as string;
    if (!(k in jaStatic)) jaStatic[k] = els[i].innerHTML;
    els[i].innerHTML = l === 'en' ? EN_STATIC[k] : jaStatic[k];
  }
  const btns = document.querySelectorAll('.lang-b');
  for (let i = 0; i < btns.length; i++) {
    const on = btns[i].getAttribute('data-l') === l;
    btns[i].classList.toggle('on', on);
    btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  (document.getElementById('steps') as HTMLElement).setAttribute('aria-label', tr('進捗'));
}
