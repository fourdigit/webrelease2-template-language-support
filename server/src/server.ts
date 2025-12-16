import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  Hover,
  MarkupKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import {
  TemplateParser,
  TAG_COMPLETIONS,
  FUNCTION_COMPLETIONS,
  Diagnostic as ParserDiagnostic
} from './parser';

// Language Server との接続を作成
const connection = createConnection(ProposedFeatures.all);

// テキストドキュメント管理を作成
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// ホバー用のタグ説明
const TAG_DOCUMENTATION: Record<string, string> = {
  'wr-if': '**wr-if** - 条件分岐（条件付きレンダリング）\n\n属性:\n- `condition`: 評価する式\n\n使用例:\n```html\n<wr-if condition="expression">\n  <wr-then>条件が真のとき</wr-then>\n  <wr-else>条件が偽のとき</wr-else>\n</wr-if>\n```',
  'wr-then': '**wr-then** - wr-if の条件が真のときに出力する内容',
  'wr-else': '**wr-else** - wr-if の条件が偽のときに出力する内容',
  'wr-for': '**wr-for** - ループ（繰り返し）\n\n属性:\n- `list`: 反復するリスト要素\n- `string`: 反復する文字列（1文字ずつ）\n- `times`: 反復回数\n- `variable`: ループ変数名\n- `count`: 総件数を入れる変数名\n- `index`: インデックスを入れる変数名\n\n使用例:\n```html\n<wr-for list="items" variable="item" index="i">\n  %item.name% (index: %i%)\n</wr-for>\n```',
  'wr-switch': '**wr-switch** - switch 構文（多分岐）\n\n属性:\n- `value`: 分岐の判定に使う値\n\n使用例:\n```html\n<wr-switch value="expression">\n  <wr-case value="1">Case 1</wr-case>\n  <wr-case value="2">Case 2</wr-case>\n  <wr-default>Default case</wr-default>\n</wr-switch>\n```',
  'wr-case': '**wr-case** - wr-switch 内の case\n\n属性:\n- `value`: 一致させる値',
  'wr-default': '**wr-default** - wr-switch 内の default（既定）',
  'wr-variable': '**wr-variable** - 変数を定義\n\n属性:\n- `name`: 変数名\n- `value`: 変数の値\n\n使用例:\n```html\n<wr-variable name="myVar" value="expression"></wr-variable>\n```',
  'wr-append': '**wr-append** - 変数に値を追記\n\n属性:\n- `name`: 変数名\n- `value`: 追記する値',
  'wr-clear': '**wr-clear** - 変数をクリア\n\n属性:\n- `name`: クリアする変数名',
  'wr-break': '**wr-break** - ループを抜ける\n\n属性:\n- `condition`: （任意）break する条件',
  'wr-return': '**wr-return** - 値を返す\n\n属性:\n- `value`: 返す値',
  'wr-error': '**wr-error** - エラーを発生させる\n\n属性:\n- `condition`: エラーにする条件\n- `message`: エラーメッセージ',
  'wr-conditional': '**wr-conditional** - 条件ブロック\n\n属性:\n- `condition`: 評価する式',
  'wr-cond': '**wr-cond** - wr-conditional 内の条件\n\n属性:\n- `condition`: 評価する式',
  'wr-comment': '**wr-comment** - コメントブロック（出力には含まれません）'
};

// ホバー用の関数説明
const FUNCTION_DOCUMENTATION: Record<string, string> = {
  'selectedValue': '**selectedValue()** - select 要素の選択値を取得\n\n現在選択されている option の value を返します。',
  'selectedName': '**selectedName()** - select 要素の表示名を取得\n\n現在選択されている option の名前/ラベルを返します。',
  'selected': '**selected()** - チェック状態を判定（checkbox / radio）\n\n要素が選択されていれば true を返します。',
  'isNull': '**isNull(value)** - null 判定\n\nvalue が null または undefined のとき true を返します。',
  'isNotNull': '**isNotNull(value)** - 非 null 判定\n\nvalue が null でないとき true を返します。',
  'length': '**length(value)** - 長さを取得（文字列/配列）\n\n文字数または要素数を返します。',
  'substring': '**substring(str, start, end)** - 部分文字列の抽出\n\n文字列の一部を返します。',
  'contains': '**contains(str, search)** - 部分一致判定\n\nstr が search を含むとき true を返します。',
  'replace': '**replace(str, search, replacement)** - 文字列置換\n\n置換後の文字列を返します。',
  'trim': '**trim(str)** - 前後の空白を削除\n\nトリム後の文字列を返します。',
  'toUpperCase': '**toUpperCase(str)** - 大文字化\n\n大文字に変換した文字列を返します。',
  'toLowerCase': '**toLowerCase(str)** - 小文字化\n\n小文字に変換した文字列を返します。'
};

connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['<', '%', '.']
      },
      hoverProvider: true
    }
  };
});

// ドキュメントのオープン/変更時に検証
documents.onDidChangeContent((change: { document: TextDocument }) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const parser = new TemplateParser(text);
  const parserDiagnostics = parser.parse();

  const diagnostics: Diagnostic[] = parserDiagnostics.map((d: ParserDiagnostic) => ({
    severity: d.severity === 1 ? DiagnosticSeverity.Error :
              d.severity === 2 ? DiagnosticSeverity.Warning :
              d.severity === 3 ? DiagnosticSeverity.Information :
              DiagnosticSeverity.Hint,
    range: {
      start: { line: d.range.start.line, character: d.range.start.character },
      end: { line: d.range.end.line, character: d.range.end.character }
    },
    message: d.message,
    source: 'webrelease',
    code: d.code
  }));

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// 補完を提供
connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  
  // カーソル前のテキストを取得
  const textBefore = text.slice(0, offset);
  
  // タグ入力中かどうか
  if (textBefore.match(/<wr-\w*$/)) {
    // タグ名の補完
    return TAG_COMPLETIONS.map(item => ({
      label: item.label,
      kind: CompletionItemKind.Keyword,
      detail: item.detail,
      documentation: item.documentation
    }));
  }
  
  // 式（%...%）の途中かどうか
  if (textBefore.match(/%[^%]*$/)) {
    // 関数補完
    return FUNCTION_COMPLETIONS.map(item => ({
      label: item.label,
      kind: CompletionItemKind.Function,
      detail: item.detail,
      insertText: item.insertText
    }));
  }
  
  // ドット直後（メンバーアクセス）かどうか
  if (textBefore.match(/\.\w*$/)) {
    // メソッド呼び出し向けの補完
    return FUNCTION_COMPLETIONS.map(item => ({
      label: item.label,
      kind: CompletionItemKind.Method,
      detail: item.detail,
      insertText: item.insertText
    }));
  }

  return [];
});

// ホバー情報を提供
connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  
  // 現在位置の単語範囲を取得
  const wordRange = getWordRangeAtPosition(text, offset);
  if (!wordRange) {
    return null;
  }
  
  const word = text.slice(wordRange.start, wordRange.end);
  
  // タグかどうか
  if (TAG_DOCUMENTATION[word]) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: TAG_DOCUMENTATION[word]
      }
    };
  }
  
  // 関数かどうか
  if (FUNCTION_DOCUMENTATION[word]) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: FUNCTION_DOCUMENTATION[word]
      }
    };
  }

  return null;
});

function getWordRangeAtPosition(text: string, offset: number): { start: number; end: number } | null {
  // 単語境界を探索
  let start = offset;
  let end = offset;
  
  // start を後ろへ
  while (start > 0 && /[\w-]/.test(text[start - 1])) {
    start--;
  }
  
  // end を前へ
  while (end < text.length && /[\w-]/.test(text[end])) {
    end++;
  }
  
  if (start === end) {
    return null;
  }
  
  return { start, end };
}

// TextDocuments を接続に紐付けて監視開始
documents.listen(connection);

// 接続の待ち受け開始
connection.listen();
