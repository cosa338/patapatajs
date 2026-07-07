# patapata.js

![patapata.js のフリップアニメーション](docs/hero.gif)

パタパタするあれです。  
Demo: [https://cosa338.github.io/patapatajs/](https://cosa338.github.io/patapatajs/)

日本語 [English](README.en.md)

テキストや日時を「パタパタ」アニメーションで表示する Web Components (Custom Elements) ライブラリです。

- 依存関係はありません (Vanilla JS / CSS)
- マルチバイト対応で絵文字も使えます（対応環境では `Intl.Segmenter` によりグラフェム単位、未対応環境ではコードポイント単位にフォールバック）
- 文字列を1パネルとして扱うことで、反転フラップ式案内表示機のような表示もできます

### できること

- 基本機能
  - パネルのサイズ、色、フォント、フォントの太さなどを細かくカスタマイズ
  - 初期値はレスポンシブにサイズが変化
  - フリップ間隔や、フリップアニメーション時間の指定
  - ゆっくりパタパタしたり、連続でパタパタしたり
  - 1文字1パネル、文字列を1パネル等の指定
  - 一部のパネルを小さく表示

- テキスト表示
  - 固定表示(`value` を後から変更するとフリップして切り替わります)
  - ランダム表示の後に決まったテキストを表示（`rand`）
  - テキストを順番に表示（JSON + `interval`、必要なら `repeat`）
  - 候補をシャッフルして表示（`shuffle-time`）
  - 複数行の連携（JSON + `stack`）
  - ループ

- 日時の表示
  - `YYYYMMDD` 形式でフォーマット指定
  - 現在の日時
  - 指定した日時までの残り時間
  - 曜日や午前午後などを日本語/英語で表示

- タイマー
  - ストップウォッチ
  - カウントダウン
  - どこにでも置けるタイマーの操作ボタン（`patapata-control` など、CSSで自由にカスタマイズ）

### 使い方

HTML で [patapata.js](patapata.js) (または [patapata.min.js](patapata.min.js)) を読み込み、要素を置くだけで動きます。

```html
<script src="./patapata.min.js" defer></script>

<patapata-clock format="HH:mm:ss"></patapata-clock>
```

GitHub Pages から読み込む場合はこちら。

```html
<script src="https://cosa338.github.io/patapatajs/patapata.min.js" defer></script>

<patapata-clock format="HH:mm:ss"></patapata-clock>
```

jsDelivr を利用する場合はこちら。

```html
<script src="https://cdn.jsdelivr.net/gh/cosa338/patapatajs@v0.1.2/patapata.min.js" defer></script>

<patapata-clock format="HH:mm:ss"></patapata-clock>
```

### ドキュメント / デモ

- [index.html](index.html) がドキュメント兼デモページです (動作デモ、貼り付け用HTML生成など) 。
- またはこちら [https://cosa338.github.io/patapatajs/](https://cosa338.github.io/patapatajs/)

### 挙動の補足

- `patapata-text` の `value` 属性を後から変更すると、現在の表示からフリップして新しいテキストに切り替わります(`rand` 指定時や JSON 値の場合は表示の再スタートになります)。
- `patapata-clock` の `diff` で指定時刻を過ぎた場合、`-` 符号が付くのは `DDD` / `HHH` / `mmm` / `sss` の合計系トークンのみです。`HH:mm:ss` のようなフォーマットでは超過が判別できないため、超過後も表示する場合は合計系トークンを含めてください。
- `patapata-control` の `for` は `document.getElementById()` で対象を解決します。Shadow DOM 内の要素は対象にできません。

### 開発

```sh
npm install
npm run check
npm run test
npm run build
npm run smoke
```

- `npm run check` は配布ファイルの構文チェック、[index.html](index.html) / [display.html](display.html) の inline script チェック、TypeScript の型チェック(`noImplicitAny`)を実行します。
- `npm run test` は Node.js 組み込みテストランナーで [tests/](tests/) の単体テストを実行します(TypeScript を直接実行するため Node.js 23.6 以降、推奨は 24)。
- `npm run build` は [src/patapata.ts](src/patapata.ts) から [patapata.js](patapata.js) と [patapata.min.js](patapata.min.js) を生成します。
- `npm run smoke` は Playwright でブラウザ Smoke Test を実行します。

### Accessibility (aria-label)

- `aria-label` が未指定のとき、要素が現在表示している値を `aria-label` に自動反映します。
- `aria-label` を指定した場合、要素はそれを上書きしません（固定ラベルになります）。
- 表示が完全に装飾用途であれば `aria-hidden="true"` を指定してください。

注意: テキストの高速シャッフル表示や、タイマー/日時でミリ秒まで表示している場合など、値の変化が非常に速いケースでは `aria-label` が頻繁に変化し実用的でない場合があります。その場合は `aria-hidden="true"` や、安定した `aria-label` の指定を検討してください。

### 開発メモ

- 依存関係はありません (Vanilla JS / CSS) - ブラウザ標準の API のみを使用しています (Canvas 2D, IntersectionObserver, Page Visibility など)
- Canvas 利用 - 描画は Canvas 2D API を中心に行い、オフスクリーン Canvas を生成して一部をキャッシュします
- Web Components (Custom Elements): `patapata-text`, `patapata-clock`, `patapata-timer`, `patapata-control`
- 1ファイルで完結しているので、Canvas の実装サンプルとしてもお手軽かなと思います

### ライセンス

MIT License. 詳細は [LICENSE](LICENSE) を参照してください。
