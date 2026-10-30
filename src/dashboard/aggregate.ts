// 回答の集計（ダッシュボード用）
import { GENRES, QUESTIONS, ratingScore } from '../shared/questions';
import { split, type SurveyRecord } from '../shared/record';

export interface Count {
  label: string;
  n: number;
}

const day = (at: string) => (at || '').slice(0, 10);
const hour = (at: string) => parseInt((at || '').slice(11, 13), 10);

export function aggregate(rows: SurveyRecord[], today: string) {
  const total = rows.length;
  const signage = rows.filter((r) => r.src !== 'phone').length;
  const todayN = rows.filter((r) => day(r.at) === today).length;

  const scores = rows.map((r) => ratingScore(r.q3)).filter((s) => s > 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // Q1 は先頭のコード（A〜K）で数える
  const genres = GENRES.map(([code, label]) => {
    let n = 0;
    let b = 0;
    for (const r of rows) {
      if (split(r.q1).some((x) => x.split(' ')[0] === code)) n++;
      if ((r.best || '').split(' ')[0] === code) b++;
    }
    return { code, label, n, b };
  });
  const bestTotal = genres.reduce((a, g) => a + g.b, 0);
  const top = genres.slice().sort((a, b) => b.b - a.b)[0];

  const count = (key: 'q2' | 'q3' | 'q4' | 'q6', sort: boolean): Count[] => {
    const q = QUESTIONS.find((x) => x.key === key)!;
    const list = q.opts.map((o) => ({
      label: o.l,
      n: rows.filter((r) => (q.type === 'multi' ? split(r[key]).indexOf(o.v) >= 0 : r[key] === o.v)).length,
    }));
    return sort ? list.sort((a, b) => b.n - a.n) : list;
  };

  // 時間帯: データのある範囲（最低 10〜17 時）
  const byHour: Record<number, number> = {};
  for (const r of rows) {
    const h = hour(r.at);
    if (!isNaN(h)) byHour[h] = (byHour[h] || 0) + 1;
  }
  const hs = Object.keys(byHour).map(Number);
  const h0 = Math.min(10, ...hs);
  const h1 = Math.max(17, ...hs);
  const hours: Count[] = [];
  for (let h = h0; h <= h1; h++) hours.push({ label: h + '時', n: byHour[h] || 0 });

  const comments = rows
    .filter((r) => r.q7 || r.text)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .map((r) => ({
      at: r.at,
      src: r.src === 'phone' ? 'スマホ' : 'サイネージ',
      text: [
        split(r.q7)
          .map((t) => '「' + t + '」')
          .join(''),
        r.text || '',
      ]
        .filter(Boolean)
        .join(' ／ '),
    }));

  return {
    total,
    signage,
    phone: total - signage,
    todayN,
    avg,
    rated: scores.length,
    genres,
    bestTotal,
    top: top && top.b > 0 ? top : null,
    rating: count('q3', false),
    panels: [
      { title: '良かった理由', rows: count('q2', true) },
      { title: '部員の対応', rows: count('q4', true) },
      { title: '職業・属性', rows: count('q6', true) },
    ],
    hours,
    comments,
  };
}
