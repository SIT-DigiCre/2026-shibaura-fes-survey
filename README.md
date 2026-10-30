# デジクリ評価アンケート（芝浦祭 2026）

デジクリのブースに置く縦長タッチサイネージ用アンケート、スマホ版、集計ダッシュボードです。

| URL                  | 内容                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `/`                  | アンケート（サイネージ 540×1920）                                |
| `/?m=phone`          | アンケート（スマホ版。QR コードから開く）                        |
| `/dashboard/`        | 集計ダッシュボード（検索避け済み。アンケートからはリンクしない） |
| `/dashboard/?demo=1` | ダッシュボードをサンプルデータで表示                             |

回答は Google スプレッドシートに保存します（Apps Script 経由）。公開は Cloudflare Pages です。

## 開発

```sh
npm install
npx playwright install chromium   # 初回だけ
cp .env.example .env              # VITE_GAS_URL に Apps Script の URL を書く
npm run dev                       # http://localhost:5173/
```

| コマンド         | 内容                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `npm run build`  | 型チェックとビルド（`dist/`。サイネージ用の legacy 版も出力）       |
| `npm run lint`   | ESLint と stylelint（サイネージで使えない CSS もここで検出）        |
| `npm run format` | Prettier                                                            |
| `npm test`       | Playwright（本番ビルドで確認。スクリーンショットは `screenshots/`） |

## 1. スプレッドシートと Apps Script

1. Google ドライブで新しいスプレッドシートを作る（名前は自由。例「デジクリアンケート 2026」）。
2. メニューの **拡張機能 → Apps Script** を開く。
3. `Code.gs` の中身を全部消して、このリポジトリの [gas/Code.gs](gas/Code.gs) を貼り付けて保存する。
4. 上部の関数選択で `setup` を選んで **実行** する。初回は権限の確認が出るので、自分のアカウントで許可する。
   スプレッドシートに「回答」シートと見出し行ができる。
5. 左の **プロジェクトの設定（歯車）→ スクリプト プロパティ** で、次を追加する。
   - プロパティ `DASH_KEY`、値はダッシュボードの合言葉（部員だけに共有する）。
   - 未設定のあいだは、ダッシュボードで自由コメントと CSV を誰も見られない。
6. 右上の **デプロイ → 新しいデプロイ**。
   - 種類: **ウェブアプリ**
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
7. **デプロイ** を押し、表示された **ウェブアプリの URL**（`https://script.google.com/macros/s/…/exec`）を控える。これが `VITE_GAS_URL`。

確認: ブラウザで `<URL>?count=1` を開いて `{"ok":true,"count":0}` が返れば準備完了。

**コードを直したとき**は「デプロイ → デプロイを管理 → 編集（鉛筆）→ バージョン: 新バージョン → デプロイ」で更新します。
「新しいデプロイ」にすると URL が変わり、サイトの設定も変えることになります。

### データの扱い

- 1 回答が 1 行。複数選択は `/` 区切り。列は ID・回答日時・回答元・端末・各設問・自由コメント・受信日時。
- 同じ ID は 2 回目以降無視します（端末は送れたか分からない回答を何度でも送り直すため）。
- `=` `+` `-` `@` で始まる入力は、数式にならないよう先頭に `'` を付けて保存します。
- ダッシュボードの取得（`doGet`）は、合言葉なしだと自由コメントの列を除いて返します。

## 2. GitHub Pages で公開

公開先: https://sit-digicre.github.io/2026-shibaura-fes-survey/

GitHub Pages はリポジトリをそのまま配信するだけで、ビルドはしません。
ブランチをそのまま公開すると、ビルド前のファイル（`/src/survey/style.css` や `.ts`）を読みにいくので CSS も JS も効きません。
そこで、[.github/workflows/pages.yml](.github/workflows/pages.yml) でビルドしてから `dist/` を公開します。

初回だけリポジトリの設定が必要です。

1. **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする（「Deploy from a branch」のままだと、ビルド前のファイルが公開されます）。
2. **Settings → Secrets and variables → Actions → Variables** に `VITE_GAS_URL`（1-7 で控えた URL）を登録する。
3. `master` に push すると Actions が動いて公開されます（**Actions** タブの「Deploy to GitHub Pages」から手動でも実行できます）。

- サイトは `/<リポジトリ名>/` の下で配信されるので、ワークフローはビルド時に `BASE_PATH=/<リポジトリ名>/` を渡します（[vite.config.ts](vite.config.ts) の `base`）。手元の `npm run dev` / `npm run build` ではルート（`/`）のままです。
- `VITE_GAS_URL` はビルド時に埋め込まれます。変えたときはワークフローを再実行してください。
- ダッシュボードの検索避けは、GitHub Pages では `<meta name="robots" content="noindex">` だけが効きます（`public/_headers` は Cloudflare Pages 用です。`robots.txt` もドメイン直下ではないので効きません）。

### Cloudflare Pages を使う場合

ビルド コマンドは `npm run build`、出力ディレクトリは `dist`。環境変数に `VITE_GAS_URL` と `NODE_VERSION=22` を設定します。`BASE_PATH` は不要です。

## 3. スマホ用 QR コード

QR コードにする URL:

```
https://sit-digicre.github.io/2026-shibaura-fes-survey/?m=phone
```

`?m=phone` を付け忘れるとサイネージ用の画面（540×1920 を縮小）になるので、QR を印刷する前にスマホで読み取って確認してください。

スマホ版はお礼画面に「この画面をスタッフに見せてください」と回答 ID（`DC-P-XXXXXXXX`）を出し、そのまま止まります。

## 4. サイネージの設置

- 端末: LG in-TOUCH Stretch 29"（540×1920 縦置き）の内蔵ブラウザで `https://sit-digicre.github.io/2026-shibaura-fes-survey/` を開き、全画面にする。
- **管理画面**: 画面上部のロゴを 5 回続けてタップ → PIN `2026`。
  - **端末名**: 回答 ID が `DC-<端末名>-0001` になります。端末を 2 台以上置くときは必ず別の名前（`S1`, `S2` …）にする。
  - **画面の向き**: OS 側で回転できないときに 0° / 90° / 270° を選ぶ。
  - **今すぐ再送** / **控えを CSV で保存**: 回答は端末内にも残っているので、回線トラブル時の控えに使える。
  - 効果音 ON/OFF、全画面表示、端末内の控えの消去（2 回押し）。
- 回答は端末に保存してから送信します。送れなかった分は、起動時と待ち受け中 90 秒ごとに自動で再送します（来場者には失敗を見せません）。
- 回答途中で 60 秒操作がないと「まだ回答中ですか？」を表示し、さらに 20 秒で待ち受けに戻ります（「回答をつづける」で延長）。何も選ばずに離れた場合は黙って待ち受けに戻ります。

## 5. ダッシュボード

- `/dashboard/` を開くと 60 秒ごとに更新します。
- 自由コメントと CSV ダウンロードは、合言葉（`DASH_KEY`）を入れると表示されます。合言葉はブラウザのタブを閉じると忘れます。
- `?demo=1` はサンプルデータです（合言葉は何でも解除できます）。

## 構成

```
index.html             アンケート（サイネージ / ?m=phone）
dashboard/index.html   ダッシュボード
src/shared/            設問定義・回答レコード・CSV（両ページ共通）
src/survey/            アンケートの処理（main, admin, store=保存と送信, touch, fx, fit, sound）
src/dashboard/         ダッシュボード（main, aggregate=集計, demo=サンプルデータ）
gas/Code.gs            Apps Script（doPost / doGet）
public/                ロゴ、_headers、robots.txt
tests/                 Playwright（survey / phone / dashboard / gas）
reference/             旧版とデザイン（参照用。ビルドには含めない）
```

サイネージ（Android 7.1・Chromium 53〜58 相当）の制約は [CLAUDE.md](CLAUDE.md) を参照してください。
