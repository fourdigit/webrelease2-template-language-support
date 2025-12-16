# WebRelease2 Template Language Support

VS Code向けのWebRelease2テンプレート言語サポート拡張機能です。

## 機能

- **構文ハイライト**: WebRelease2テンプレートの構文をハイライト表示
- **構文チェック**: 式やタグの構文エラーを検出
- **コード補完**: 拡張タグ、属性、関数の補完候補を表示
- **ホバー情報**: 関数やタグのドキュメントを表示

## 対応ファイル

- `.wr2` - WebRelease2テンプレートファイル
- `.wrt` - WebRelease2テンプレートファイル

## 前提条件

- Python 3.11 以上
- pygls パッケージ (`pip install pygls`)

## インストール

1. 拡張機能をインストール
2. Python 3.11 以上をインストール
3. pygls をインストール: `pip install pygls`

## 使用方法

`.wr2` または `.wrt` 拡張子のファイルを開くと、自動的にWebRelease2 Template言語がアクティブになります。

### 構文チェック

エディタを開くと、自動的に構文チェックが実行されます。

### コード補完

- `<wr-` と入力すると拡張タグの補完候補が表示されます
- `%` と入力すると関数の補完候補が表示されます
- `Ctrl+Space` で手動で補完メニューを表示できます

### ホバー情報

関数名やタグ名にマウスをホバーすると、ドキュメント情報が表示されます。

## サポートされるタグ

- `wr-if`, `wr-then`, `wr-else` - 条件分岐
- `wr-for` - ループ
- `wr-switch`, `wr-case`, `wr-default` - switch文
- `wr-variable`, `wr-append`, `wr-clear` - 変数操作
- `wr-break`, `wr-return`, `wr-error` - 制御
- `wr-comment` - コメント

## サポートされる関数

- `pageTitle()`, `currentTime()`, `formatDate()`
- `isNull()`, `isNotNull()`, `isNumber()`
- `length()`, `substring()`, `indexOf()`, `contains()`
- `toUpperCase()`, `toLowerCase()`, `trim()`, `replace()`
- `round()`, `floor()`, `ceil()`, `abs()`, `min()`, `max()`
- その他多数

## 設定

| 設定 | 説明 | デフォルト |
|------|------|----------|
| `webrelease2.lsp.trace.server` | サーバーとの通信トレース | `off` |

## ライセンス

MIT

## 問題報告

問題が発生した場合は、GitHub の issues セクションで報告してください。
