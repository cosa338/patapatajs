# patapata.js

パタパタするあれです。  
Demo: [https://cosa338.github.io/patapatajs/](https://cosa338.github.io/patapatajs/)

[English](#english) · [日本語](#日本語)

## English

A Web Components (Custom Elements) library that displays text and dates/times with a "patapata" flip animation.

- No dependencies (Vanilla JS / CSS)
- Grapheme-aware when supported (emoji / combining marks via `Intl.Segmenter`; falls back to code points)
- With the `atomic` option the whole string can be treated as a single panel, enabling flap-style signboard displays

### What you can do

- Core features
  - Customize panel size, color, font, and font weight
    - Default values are responsive (sizes adjust to the element/container)
  - Control flip interval and animation duration (slow flips, continuous flips, etc.)
  - Choose per-character panels or treat the whole string as one panel
  - Render some panels smaller than others

- Text display
  - Fixed text
  - Random (rand): shows random characters for a while, then settles to the target text
  - Sequence: step through items at `interval` (optionally `repeat`)
  - Shuffle (time-limited): randomly switches among candidates for a set duration (`shuffle-time`)
  - Coordinated multi-line displays (JSON + `stack`)
  - Looping

- Date / Time
  - Custom formats (e.g. YYYYMMDD)
  - Current date/time
  - Countdown to a specified time
  - Day-of-week and AM/PM labels in Japanese/English

- Timer
  - Stopwatch
  - Countdown timer
  - Timer controls that can be placed anywhere (e.g. via `patapata-control`, freely styleable with CSS)

### Usage

Load [patapata.js](patapata.js) (or [patapata.min.js](patapata.min.js)) in HTML and place the elements.

```html
<script src="./patapata.min.js" defer></script>

<patapata-clock format="HH:mm:ss"></patapata-clock>
```

Using CDN:

```html
<script src="https://cdn.jsdelivr.net/gh/cosa338/patapatajs/patapata.min.js" defer></script>

<patapata-clock format="HH:mm:ss"></patapata-clock>
```

### Docs / Demo

- [index.html](index.html) is the documentation + demo page (live demo, copy/paste HTML generator, etc.).
- Or visit: [https://cosa338.github.io/patapatajs/](https://cosa338.github.io/patapatajs/)

### Accessibility (aria-label)

- If `aria-label` is not specified, the elements automatically reflect the currently displayed value to `aria-label`.
- If you specify `aria-label`, the components will not overwrite it (so it becomes a fixed label).
- If the display is purely decorative, set `aria-hidden="true"`.

Note: For very fast-changing displays (e.g. text shuffle/rand, timers showing milliseconds), continuously changing `aria-label` may be less practical. In such cases, consider `aria-hidden="true"` or provide a stable `aria-label`.

### Smoke Test (debug)

[index.html](index.html) includes a simple developer-oriented check (Smoke Test). It is hidden by default.

- Enable it by opening with `?ppdebug=1` (or `?patapataDebug=1`)
- Or set `localStorage.patapataDebug = '1'` in Console and reload

When debug is enabled, [patapata.js](patapata.js) exposes `window.__patapataRuntime` (cache stats / clear caches, etc.).

#### What “Run” does

Smoke Test “Run” creates a temporary offscreen host and roughly checks:

- `patapata-text` renders (a canvas is created in Shadow DOM and has a positive size)
- `patapata-text` auto-updates `aria-label` (and does not overwrite a manual `aria-label`)
- Toggling core attributes like `atomic/light/stack/align-width` does not throw
- `patapata-clock` renders and still renders when `diff` is changed
- `patapata-clock` has a non-empty `aria-label` (and does not overwrite a manual `aria-label`)
- `patapata-timer` renders and still renders when `autostart` is toggled
- `patapata-timer` has a non-empty `aria-label` (and does not overwrite a manual `aria-label`)

Finally it removes the host element and shows cache stats if requested.

#### cache stats fields

Example shown in Smoke Test: `cache: {"cardHits":..., "cardMisses":..., ...}`

- `cardHits` / `cardMisses`: card background (full) cache hit/miss counts
- `halfHits` / `halfMisses`: flap background (top/bottom halves) cache hit/miss counts
- `cardSize`: current card cache size
- `halfSize`: current flap cache size
- `limit`: cache limit (evicts oldest when exceeded)
- `evictions`: eviction count
- `clears`: times cleared via `clearCaches()`

### Dev notes

- No dependencies (Vanilla JS / CSS) - uses only standard browser APIs (Canvas 2D, IntersectionObserver, Page Visibility, etc.)
- Canvas-based rendering — uses Canvas 2D and caches some parts using offscreen canvases
- Provided as Web Components (Custom Elements): `patapata-text`, `patapata-clock`, `patapata-timer`, `patapata-control`
- Single-file library, so it can be a handy Canvas implementation reference as well

### License

MIT License. See [LICENSE](LICENSE) for the full text.

## 日本語

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
  - 固定表示
  - ランダム表示の後に決まったテキストを表示（`rand`）
  - テキストを順番に表示（JSON + `interval`、必要なら `repeat`）
  - 候補をシャッフルして表示（`shuffle-time`）
  - 複数行の連携（JSON + `stack`）
  - ループ
  
- 日時の表示
  - YYYYMMDD形式でフォーマット指定
  - 現在の日時
  - 指定した日時までの残り時間
  - 曜日や午前午後などを日本語/英語で表示
  
- タイマー
  - ストップウォッチ
  - カウントダウン
  - どこにでも置けるタイマーの操作ボタン（`patapata-control` など、CSSで自由にカスタマイズ）
  
### 使い方

HTML で [patapata.js](patapata.js) ( または [patapata.min.js](patapata.min.js) ) を読み込み、要素を置くだけで動きます。

```html
<script src="./patapata.min.js" defer></script>

<patapata-clock format="HH:mm:ss"></patapata-clock>
```

CDNの利用であればこちら。

```html
<script src="https://cdn.jsdelivr.net/gh/cosa338/patapatajs/patapata.min.js" defer></script>

<patapata-clock format="HH:mm:ss"></patapata-clock>
```

### ドキュメント / デモ

- [index.html](index.html) がドキュメント兼デモページです (動作デモ、貼り付け用HTML生成など) 。
- またはこちら [https://cosa338.github.io/patapatajs/](https://cosa338.github.io/patapatajs/)

### Accessibility (aria-label)

- `aria-label` が未指定のとき、要素が現在表示している値を `aria-label` に自動反映します。
- `aria-label` を指定した場合、要素はそれを上書きしません（固定ラベルになります）。
- 表示が完全に装飾用途であれば `aria-hidden="true"` を指定してください。

注意: テキストの高速シャッフル表示や、タイマー/日時でミリ秒まで表示している場合など、値の変化が非常に速いケースでは `aria-label` が頻繁に変化し実用的でない場合があります。その場合は `aria-hidden="true"` や、安定した `aria-label` の指定を検討してください。

### Smoke Test (デバッグ用)

[index.html](index.html) には開発用の簡易チェック (Smoke Test) がありますが、通常利用者向けではないためデフォルトでは非表示です。

- 有効化: URL に `?ppdebug=1` (または `?patapataDebug=1`) を付けて開く
- もしくは Console で `localStorage.patapataDebug = '1'` を設定してリロード

デバッグ有効時のみ、 [patapata.js](patapata.js) は `window.__patapataRuntime` を公開します（キャッシュ統計表示/キャッシュクリアなど）。

#### Run を押すと何をするか

Smoke Test の Run は、画面外 (offscreen) に一時的なホスト要素を作り、以下をざっくり確認します。

- `patapata-text` を生成して描画できること（Shadow DOM 内の canvas が作られ、サイズが正であること）
- `patapata-text` の `aria-label` が自動反映されること（また、ユーザーが `aria-label` を指定した場合は上書きされないこと）
- `atomic/light/stack/align-width` など主要属性をトグルしても例外が出ないこと
- `patapata-clock` を生成し、`diff` を変更しても描画できること
- `patapata-clock` の `aria-label` が空でないこと（また、ユーザーが `aria-label` を指定した場合は上書きされないこと）
- `patapata-timer` を生成し、`autostart` をトグルしても描画できること
- `patapata-timer` の `aria-label` が空でないこと（また、ユーザーが `aria-label` を指定した場合は上書きされないこと）

最後にホスト要素を削除し、必要に応じてキャッシュ統計を表示します。

#### cache stats の意味

Smoke Test に表示される例: `cache: {"cardHits":..., "cardMisses":..., ...}`

- `cardHits` / `cardMisses`: カード背景 (全面) のキャッシュ hit/miss 回数
- `halfHits` / `halfMisses`: フラップ背景 (上半分/下半分) のキャッシュ hit/miss 回数
- `cardSize`: カード背景キャッシュの現在サイズ
- `halfSize`: フラップ背景キャッシュの現在サイズ
- `limit`: キャッシュ上限（超えると古いものから捨てます）
- `evictions`: 上限超過などで捨てた回数
- `clears`: `clearCaches()` で全消去した回数

### 開発メモ

- 依存関係はありません (Vanilla JS / CSS) - ブラウザ標準の API のみを使用しています (Canvas 2D, IntersectionObserver, Page Visibility など)
- Canvas 利用 - 描画は Canvas 2D API を中心に行い、オフスクリーン Canvas を生成して一部をキャッシュします
- Web Components (Custom Elements): `patapata-text`, `patapata-clock`, `patapata-timer`, `patapata-control`
- 1ファイルで完結しているので、Canvasの実装サンプルとしてもお手軽かなと思います

### ライセンス

MIT License. 詳細は [LICENSE](LICENSE) を参照してください。
