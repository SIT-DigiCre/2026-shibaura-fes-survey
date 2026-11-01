// ?demo=1 のサンプルデータ（毎回同じ結果になるよう疑似乱数を固定）
import { GENRES, QUESTIONS, genreLabel } from '../shared/questions';
import { SEP, isoLocal, pad, type SurveyRecord } from '../shared/record';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// 日付は芝浦祭の 2 日間に固定（「今日の回答」は 2 日目として表示する）
export const DEMO_DAYS = ['2026-10-31', '2026-11-01'];

export function demoRows(): SurveyRecord[] {
  const r = rng(2026);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  // 人気の偏り（ゲーム展示・イラスト・VTuber が多め）
  const gw = [61, 38, 72, 55, 49, 33, 18, 41, 27, 22, 14];
  const hw = [5, 12, 19, 24, 28, 21, 14, 5];
  const rows: SurveyRecord[] = [];
  const days = DEMO_DAYS.map((s) => new Date(s + 'T00:00:00'));
  let seq = 0;
  for (let d = 0; d < days.length; d++) {
    const n = d === 0 ? 54 : 74;
    for (let i = 0; i < n; i++) {
      // 時間帯の重みで時刻を決める
      let x = r() * hw.reduce((a, b) => a + b, 0);
      let h = 0;
      while (x > hw[h]) x -= hw[h++];
      const t = new Date(days[d]);
      t.setHours(10 + h, Math.floor(r() * 60), Math.floor(r() * 60), 0);

      const q1 = GENRES.map((g) => g[0]).filter((_, j) => r() < gw[j] / 128);
      if (!q1.length) q1.push(pick(['A', 'C', 'D']));
      const best = r() < 0.9 ? q1[Math.floor(r() * q1.length)] : '';
      const opts = (k: number) => QUESTIONS[k].opts.map((o) => o.v);
      const multi = (k: number, p: number) => opts(k).filter(() => r() < p);
      const phone = r() < 0.29;
      const tags = opts(6).filter(() => r() < 0.18);
      const rating = pick(['大変良かった', '大変良かった', '大変良かった', '良いと思う', '良いと思う', '普通', '微妙']);
      seq++;
      rows.push({
        id: phone ? 'DC-P-DEMO' + pad(seq, 4) : 'DC-S1-' + pad(seq, 4),
        at: isoLocal(t),
        src: phone ? 'phone' : 'signage',
        device: phone ? 'phone' : 'S1',
        q1: q1.map(genreLabel).join(SEP),
        best: best ? genreLabel(best) : '',
        q2: multi(1, 0.4).join(SEP),
        q3: rating,
        q4: multi(3, 0.38).join(SEP),
        q5: pick(['10代', '10代', '20代', '20代', '20代', '30代', '40代', '50代', '10代未満', '60代以上']),
        q6: pick(opts(5)),
        q7: tags.join(SEP),
        text: '',
        received: isoLocal(t),
      });
    }
  }
  return rows.sort((a, b) => (a.at < b.at ? -1 : 1));
}
