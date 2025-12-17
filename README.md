# WebRelease2 Template Language Support

VS Code 向けの WebRelease2 テンプレート言語サポート拡張機能です。`.wr2` / `.wr2t` を対象に、構文ハイライト、入力補助、静的な構文チェックを提供します。
WebRelease Version 2.80Mの構文をベースにしてます。

<img width="953" height="681" alt="image" src="https://github.com/user-attachments/assets/877fb7cc-ffed-4276-bf8f-6a89f0589d44" />


## インストール

### VSIX からインストール

1. [Releases](https://github.com/fourdigit/webrelease2-template-language-support/releases) から `.vsix` をダウンロード
2. VS Code で `Extensions: Install from VSIX...` を実行
3. ダウンロードした `.vsix` を選択

### コマンドライン

```bash
code --install-extension webrelease2-template-lsp-0.9.0.vsix
```

## 機能

### 構文ハイライト

- `%...%`（テンプレート式）
- `<wr-*>`（WebRelease2 拡張タグ）
- コメント
- 属性
- HTML / CSS / JavaScript / JSON の埋め込み（基本）



### 入力補助（補完）

- **タグ補完**: `<wr-` から `wr-if` / `wr-for` などを補完
- **関数補完**:
  - `%...%` の内側で組み込み関数を補完
  - `wr-*` の一部属性値（例: `condition` / `value` / `list` など）入力中にも関数補完
- **HTML 補完**: 通常の HTML 編集時は HTML の補完もフォールバックで動作

### ホバー（Hover）

- **タグ**: `wr-if` などにホバーで簡易ドキュメント表示
- **関数**: 一部の関数はホバーで簡易説明を表示
- **HTML**: 通常の HTML 部分は HTML のホバー情報にフォールバック

### 検証（Diagnostics）

保存不要で、編集中にエラー/警告を表示します（静的解析ベース）。

- **テンプレート式 `%...%` の構文チェック**
- **タグ検証**: 不明な `wr-*` タグを検出
- **属性検証**: タグごとに許可されない属性を警告
- **必須属性の検証**（例: `wr-if` の `condition`、`wr-variable` の `name` など）
- **閉じタグの整合**（未閉じ/対応しない閉じタグの検出）
- **`wr-variable` / `wr-append` の文法チェック**
  - `name` 必須
  - `value` 属性と本文（子要素/テキスト）の併用禁止（本文が空白のみは許可）
- **`wr-if` / `wr-switch` / `wr-conditional` の直下要素制約**
  - `wr-if` が `wr-then` / `wr-else` を使う場合の配置制約
  - `wr-switch` 直下は `wr-case` / `wr-default` のみ（`wr-default` は最大1つ、かつ最後）
  - `wr-conditional` 直下は `wr-cond` のみ
- **`wr-break` の使用位置**: `wr-for` の内部でのみ使用可能
- **リスト要素に対する関数呼び出し検出**
  - `selectedValue()` / `selectedName()` / `selected()` をリスト要素に直接呼ぶ誤りを検出

例（リスト要素に対する誤った呼び出し）:

```html
<!-- ❌ NG: list 属性で回している要素に対して直接 selectedValue() を呼んでいる -->
<wr-for list='card.selectPriceInfo' variable="info">
  %card.selectPriceInfo.selectedValue().txtHtml%
</wr-for>

<!-- ✅ OK: ループ変数（info）に対して呼び出す -->
<wr-for list='card.selectPriceInfo' variable="info">
  %info.selectedValue().txtHtml%
</wr-for>
```

## 対応ファイル拡張子

- `.wr2`
- `.wr2t`

## 対応タグ（補完/検証の対象）

- `wr-if`, `wr-then`, `wr-else`
- `wr-for`, `wr-break`
- `wr-switch`, `wr-case`, `wr-default`
- `wr-variable`, `wr-append`, `wr-clear`
- `wr-return`, `wr-error`
- `wr-conditional`, `wr-cond`
- `wr-comment`, `wr--`（コメント）

## 対応関数（補完/検証の対象）

補完の対象になっている主な関数は以下です（実装上の組み込み関数一覧）。

- **選択系**: `selectedValue()`, `selectedName()`, `selected()`
- **Null/型判定**: `isNull(value)`, `isNotNull(value)`, `isNumber(value)`
- **変換**: `number(value)`, `string(value)`
- **文字列/配列**: `length(value)`, `substring(str, start, end)`, `indexOf(str, substr)`, `contains(str, substr)`, `startsWith(str, prefix)`, `endsWith(str, suffix)`, `toUpperCase(str)`, `toLowerCase(str)`, `trim(str)`, `replace(str, from, to)`, `split(str, delimiter)`, `join(array, delimiter)`, `unsplit(...)`
- **数値**: `round(num)`, `floor(num)`, `ceil(num)`, `abs(num)`, `min(a, b)`, `max(a, b)`, `divide(a, b, scale, mode)`, `setScale(num, scale)`
- **その他**: `pageTitle()`, `currentTime()`, `formatDate(time, format)`, `generatePrice(...)`, `generateBenefit(...)`, `generatefoobar(...)`

## 拡張機能開発に関わる場合

### 前提

- Node.js 18+
- npm

### ビルド / パッケージング

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Compile
cd server && npm run compile
cd ../client && npm run compile

# Package
cd client && npx vsce package
```

### 構成

```
webrelease-template-language-support/
├── server/                 # LSP Server (Node.js/TypeScript)
│   ├── src/
│   │   ├── server.ts      # LSP server implementation
│   │   └── parser.ts      # Template parser
│   └── package.json
├── client/                 # VS Code Extension
│   ├── src/
│   │   └── extension.ts   # Extension entry point
│   ├── syntaxes/          # TextMate grammar
│   └── package.json
└── README.md
```

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

## コントリビュート

Pull Request を歓迎します。

## リンク

- [WebRelease マニュアル（テンプレート構文）](https://www.frameworks.co.jp/support/manual/2.8/nkus7r000001ybbg.html)
- [GitHub リポジトリ](https://github.com/fourdigit/webrelease2-template-language-support)
