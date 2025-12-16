/**
 * WebRelease テンプレート言語パーサー
 */

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Diagnostic {
  range: Range;
  severity: number; // 1=エラー, 2=警告, 3=情報, 4=ヒント
  message: string;
  code?: string;
}

// 単一要素に対してのみ呼び出せる関数（リストには不可）
const SINGLE_ELEMENT_FUNCTIONS = new Set([
  'selectedValue',
  'selectedName',
  'selected'
]);

// 組み込み関数
const BUILT_IN_FUNCTIONS = new Set([
  'pageTitle', 'currentTime', 'formatDate', 'isNull', 'isNotNull', 'isNumber',
  'number', 'string', 'divide', 'setScale', 'length', 'substring', 'indexOf',
  'contains', 'startsWith', 'endsWith', 'toUpperCase', 'toLowerCase', 'trim',
  'replace', 'split', 'join', 'round', 'floor', 'ceil', 'abs', 'min', 'max',
  'unsplit', 'generatePrice', 'generateBenefit', 'generateBakuage',
  'selectedValue', 'selectedName', 'selected'
]);

// 有効な WebRelease タグ
const VALID_TAGS = new Set([
  'wr-if', 'wr-then', 'wr-else', 'wr-switch', 'wr-case', 'wr-default',
  'wr-for', 'wr-break', 'wr-variable', 'wr-append', 'wr-clear',
  'wr-return', 'wr-error', 'wr-conditional', 'wr-cond', 'wr-comment'
]);

// タグの属性
const TAG_ATTRIBUTES: Record<string, string[]> = {
  'wr-if': ['condition'],
  'wr-then': [],
  'wr-else': [],
  'wr-switch': ['value'],
  'wr-case': ['value'],
  'wr-default': [],
  'wr-for': ['list', 'string', 'times', 'variable', 'count', 'index'],
  'wr-break': ['condition'],
  'wr-variable': ['name', 'value'],
  'wr-append': ['name', 'value'],
  'wr-clear': ['name'],
  'wr-return': ['value'],
  'wr-error': ['condition', 'message'],
  'wr-conditional': ['condition'],
  'wr-cond': ['condition'],
  'wr-comment': [],
};

// 閉じタグ（</wr-...>）が不要なタグ
const NO_CLOSE_TAGS = new Set([
  'wr-then', 'wr-else', 'wr-case', 'wr-default',
  'wr-variable', 'wr-append', 'wr-clear', 'wr-break',
  'wr-return', 'wr-error', 'wr-cond'
]);

/**
 * WebRelease テンプレート式のパーサー
 */
class ExpressionParser {
  private expression: string;
  private pos: number = 0;
  private listElements: Set<string>;
  private loopVariables: Set<string>;
  private errors: Array<{ position: number; message: string }> = [];

  constructor(
    expression: string,
    listElements: Set<string> = new Set(),
    loopVariables: Set<string> = new Set()
  ) {
    this.expression = expression.trim();
    this.listElements = listElements;
    this.loopVariables = loopVariables;
  }

  parse(): { isValid: boolean; errorMessage: string | null } {
    if (!this.expression) {
      return { isValid: true, errorMessage: null };
    }

    try {
      this.parseExpression();
      if (this.errors.length > 0) {
        return { isValid: false, errorMessage: this.errors[0].message };
      }
      return { isValid: true, errorMessage: null };
    } catch (e) {
      return { isValid: false, errorMessage: (e as Error).message };
    }
  }

  getErrors(): Array<{ position: number; message: string }> {
    return this.errors;
  }

  private parseExpression(): void {
    this.parseOrExpression();
  }

  private parseOrExpression(): void {
    this.parseAndExpression();
    while (this.matchOperator('||')) {
      this.parseAndExpression();
    }
  }

  private parseAndExpression(): void {
    this.parseComparisonExpression();
    while (this.matchOperator('&&')) {
      this.parseComparisonExpression();
    }
  }

  private parseComparisonExpression(): void {
    this.parseAdditiveExpression();
    while (this.matchAnyOperator(['==', '!=', '<=', '>=', '<', '>'])) {
      this.parseAdditiveExpression();
    }
  }

  private parseAdditiveExpression(): void {
    this.parseMultiplicativeExpression();
    while (this.matchAnyOperator(['+', '-'])) {
      this.parseMultiplicativeExpression();
    }
  }

  private parseMultiplicativeExpression(): void {
    this.parseUnaryExpression();
    while (this.matchAnyOperator(['*', '/', '%'])) {
      this.parseUnaryExpression();
    }
  }

  private parseUnaryExpression(): void {
    if (this.matchOperator('!')) {
      this.parseUnaryExpression();
    } else {
      this.parsePostfixExpression();
    }
  }

  private parsePostfixExpression(): void {
    const baseElement = this.parsePrimaryExpression();
    const elementChain: string[] = baseElement ? [baseElement] : [];

    while (true) {
      if (this.match('(')) {
        // 関数呼び出し
        const funcName = elementChain.length > 0 ? elementChain[elementChain.length - 1] : null;
        this.parseFunctionArguments();
        this.expect(')');

        // リスト要素に対して単一要素向け関数を呼んでいないかチェック
        if (funcName && SINGLE_ELEMENT_FUNCTIONS.has(funcName)) {
          if (elementChain.length > 1) {
            const elementPath = elementChain.slice(0, -1).join('.');
            this.checkListFunctionCall(elementPath, funcName);
          }
        }

        elementChain.length = 0; // 関数呼び出し後はチェーンをリセット
      } else if (this.match('[')) {
        // 配列アクセス
        this.parseExpression();
        this.expect(']');
        elementChain.length = 0; // 配列アクセスの結果は単一要素になる
      } else if (this.match('.')) {
        // メンバーアクセス
        const member = this.parseIdentifier();
        if (member) {
          elementChain.push(member);
        }
      } else {
        break;
      }
    }
  }

  private checkListFunctionCall(elementPath: string, funcName: string): void {
    // パス自体がリスト要素かどうか
    if (this.listElements.has(elementPath)) {
      this.errors.push({
        position: this.pos,
        message: `リスト要素 '${elementPath}' に対して '${funcName}()' は呼び出せません。代わりにループ変数を使用してください。`
      });
      return;
    }

    // パスの途中（プレフィックス）がリスト要素になっていないか
    const parts = elementPath.split('.');
    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.slice(0, i + 1).join('.');
      if (this.listElements.has(prefix)) {
        this.errors.push({
          position: this.pos,
          message: `リスト要素 '${prefix}' に対して '${funcName}()' は呼び出せません。先にループ変数でリストを反復してください。`
        });
        return;
      }
    }
  }

  private parsePrimaryExpression(): string | null {
    this.skipWhitespace();

    if (this.pos >= this.expression.length) {
      throw new Error('式の末尾に到達しました（式が途中で終わっています）');
    }

    // 文字列リテラル
    if (this.expression[this.pos] === '"') {
      this.parseStringLiteral();
      return null;
    }
    // 数値リテラル
    if (/\d/.test(this.expression[this.pos])) {
      this.parseNumberLiteral();
      return null;
    }
    // 括弧で囲まれた式
    if (this.expression[this.pos] === '(') {
      this.match('(');
      this.parseExpression();
      this.expect(')');
      return null;
    }
    // 識別子
    return this.parseIdentifier();
  }

  private parseIdentifier(): string | null {
    this.skipWhitespace();

    if (this.pos >= this.expression.length) {
      return null;
    }

    if (!/[a-zA-Z_]/.test(this.expression[this.pos])) {
      return null;
    }

    const start = this.pos;
    while (this.pos < this.expression.length && /[a-zA-Z0-9_]/.test(this.expression[this.pos])) {
      this.pos++;
    }

    return this.expression.slice(start, this.pos);
  }

  private parseFunctionArguments(): void {
    this.skipWhitespace();

    if (this.pos < this.expression.length && this.expression[this.pos] !== ')') {
      this.parseExpression();

      while (this.match(',')) {
        this.parseExpression();
      }
    }
  }

  private parseStringLiteral(): void {
    this.expect('"');

    while (this.pos < this.expression.length && this.expression[this.pos] !== '"') {
      if (this.expression[this.pos] === '\\' && this.pos + 1 < this.expression.length) {
        this.pos += 2; // エスケープされた文字をスキップ
      } else {
        this.pos++;
      }
    }

    this.expect('"');
  }

  private parseNumberLiteral(): void {
    while (this.pos < this.expression.length && /[\d.]/.test(this.expression[this.pos])) {
      this.pos++;
    }
  }

  private match(ch: string): boolean {
    this.skipWhitespace();
    if (this.pos < this.expression.length && this.expression[this.pos] === ch) {
      this.pos++;
      return true;
    }
    return false;
  }

  private matchOperator(op: string): boolean {
    this.skipWhitespace();
    if (this.expression.slice(this.pos, this.pos + op.length) === op) {
      this.pos += op.length;
      return true;
    }
    return false;
  }

  private matchAnyOperator(ops: string[]): boolean {
    // 長い演算子を優先してマッチさせるため、長さの降順に並べる
    const sortedOps = [...ops].sort((a, b) => b.length - a.length);
    for (const op of sortedOps) {
      if (this.matchOperator(op)) {
        return true;
      }
    }
    return false;
  }

  private expect(ch: string): void {
    this.skipWhitespace();
    if (this.pos >= this.expression.length || this.expression[this.pos] !== ch) {
      throw new Error(`位置 ${this.pos} で '${ch}' が必要です`);
    }
    this.pos++;
  }

  private skipWhitespace(): void {
    while (this.pos < this.expression.length && /\s/.test(this.expression[this.pos])) {
      this.pos++;
    }
  }
}

/**
 * Main Template Parser
 */
export class TemplateParser {
  private content: string;
  private diagnostics: Diagnostic[] = [];
  private listElements: Set<string> = new Set();
  private loopVariables: Map<string, string> = new Map();

  constructor(content: string) {
    this.content = content;
  }

  parse(): Diagnostic[] {
    this.diagnostics = [];
    this.listElements = new Set();
    this.loopVariables = new Map();

    // 1回目の走査: wr-for からリスト要素を収集
    this.collectListElements();

    // 式の検証
    this.validateExpressions();

    // タグの検証
    this.validateTags();

    // 閉じタグの検証
    this.validateTagClosures();

    return this.diagnostics;
  }

  getListElements(): Set<string> {
    return this.listElements;
  }

  getLoopVariables(): Map<string, string> {
    return this.loopVariables;
  }

  private collectListElements(): void {
    const pattern = /<wr-for\s+([^>]*)>/g;
    let match;

    while ((match = pattern.exec(this.content)) !== null) {
      const attributesStr = match[1];

      // Extract list attribute
      const listMatch = /list=['"]([^'"]+)['"]/.exec(attributesStr);
      if (listMatch) {
        const listElement = listMatch[1];
        this.listElements.add(listElement);

        // Extract variable attribute
        const varMatch = /variable=['"]([^'"]+)['"]/.exec(attributesStr);
        if (varMatch) {
          this.loopVariables.set(varMatch[1], listElement);
        }
      }
    }
  }

  private validateExpressions(): void {
    const pattern = /%([^%]*)%/g;
    let match;

    while ((match = pattern.exec(this.content)) !== null) {
      const expression = match[1];
      const startPos = match.index;

      // %%（% のエスケープ）は式として扱わない
      if (expression === '') {
        continue;
      }

      // リスト要素の文脈を考慮して式を解析
      const parser = new ExpressionParser(
        expression,
        this.listElements,
        new Set(this.loopVariables.keys())
      );
      const result = parser.parse();

      if (!result.isValid) {
        const { line, character } = this.getLineColumn(startPos);
        this.diagnostics.push({
          range: {
            start: { line, character },
            end: { line, character: character + expression.length + 2 }
          },
          severity: 1,
          message: `式のエラー: ${result.errorMessage}`,
          code: 'expr-error'
        });
      }

      // パーサーが追加で検出したエラー（例: リスト要素に対する関数呼び出し）も拾う
      for (const error of parser.getErrors()) {
        const { line, character } = this.getLineColumn(startPos);
        this.diagnostics.push({
          range: {
            start: { line, character },
            end: { line, character: character + expression.length + 2 }
          },
          severity: 1,
          message: error.message,
          code: 'list-function-error'
        });
      }
    }
  }

  private validateTags(): void {
    const pattern = /<wr-(\w+)([^>]*)>/g;
    let match;

    while ((match = pattern.exec(this.content)) !== null) {
      const tagName = 'wr-' + match[1];
      const attributesStr = match[2];
      const startPos = match.index;

      if (!VALID_TAGS.has(tagName)) {
        const { line, character } = this.getLineColumn(startPos);
        this.diagnostics.push({
          range: {
            start: { line, character },
            end: { line, character: character + tagName.length + 2 }
          },
          severity: 1,
          message: `不明なタグ: ${tagName}`,
          code: 'unknown-tag'
        });
        continue;
      }

      // 属性の検証
      this.validateTagAttributes(tagName, attributesStr, startPos);
    }
  }

  private validateTagAttributes(tagName: string, attributesStr: string, startPos: number): void {
    // シングル/ダブルクォート両方の属性に対応
    const attrPattern = /(\w+)='([^']*)'|(\w+)="([^"]*)"/g;
    let match;

    while ((match = attrPattern.exec(attributesStr)) !== null) {
      const attrName = match[1] || match[3];
      const attrValue = match[2] || match[4];

      // そのタグで使用可能な属性かチェック
      const validAttrs = TAG_ATTRIBUTES[tagName] || [];
      if (!validAttrs.includes(attrName)) {
        const { line, character } = this.getLineColumn(startPos + match.index);
        this.diagnostics.push({
          range: {
            start: { line, character },
            end: { line, character: character + attrName.length }
          },
          severity: 2,
          message: `タグ '${tagName}' に不明な属性 '${attrName}' があります`,
          code: 'unknown-attribute'
        });
      }

      // condition 属性の式を検証
      if (attrName === 'condition' && attrValue) {
        const parser = new ExpressionParser(
          attrValue,
          this.listElements,
          new Set(this.loopVariables.keys())
        );
        const result = parser.parse();

        if (!result.isValid) {
          const { line, character } = this.getLineColumn(startPos);
          this.diagnostics.push({
            range: {
              start: { line, character },
              end: { line, character: character + attrValue.length }
            },
            severity: 1,
            message: `condition の構文エラー: ${result.errorMessage}`,
            code: 'condition-syntax-error'
          });
        }

        // リスト要素に対する関数呼び出しなどのエラーも拾う
        for (const error of parser.getErrors()) {
          const { line, character } = this.getLineColumn(startPos);
          this.diagnostics.push({
            range: {
              start: { line, character },
              end: { line, character: character + attrValue.length }
            },
            severity: 1,
            message: error.message,
            code: 'list-function-error'
          });
        }
      }
    }
  }

  private validateTagClosures(): void {
    const openPattern = /<wr-(\w+)(?:\s|>)/g;
    const closePattern = /<\/wr-(\w+)>/g;

    // すべてのタグイベント（開始/終了）を位置付きで収集
    const events: Array<{ type: 'open' | 'close'; tagName: string; pos: number }> = [];

    let match;
    while ((match = openPattern.exec(this.content)) !== null) {
      events.push({ type: 'open', tagName: 'wr-' + match[1], pos: match.index });
    }

    while ((match = closePattern.exec(this.content)) !== null) {
      events.push({ type: 'close', tagName: 'wr-' + match[1], pos: match.index });
    }

    // 位置順にソート
    events.sort((a, b) => a.pos - b.pos);

    // スタックで整合性を検証
    const tagStack: Array<{ tagName: string; pos: number }> = [];

    for (const event of events) {
      if (event.type === 'open') {
        if (!NO_CLOSE_TAGS.has(event.tagName)) {
          tagStack.push({ tagName: event.tagName, pos: event.pos });
        }
      } else {
        if (NO_CLOSE_TAGS.has(event.tagName)) {
          continue;
        }

        // スタックから対応する開始タグを探す
        let found = false;
        for (let i = tagStack.length - 1; i >= 0; i--) {
          if (tagStack[i].tagName === event.tagName) {
            tagStack.splice(i, 1);
            found = true;
            break;
          }
        }

        if (!found) {
          const { line, character } = this.getLineColumn(event.pos);
          this.diagnostics.push({
            range: {
              start: { line, character },
              end: { line, character: character + event.tagName.length + 3 }
            },
            severity: 1,
            message: `閉じタグ '${event.tagName}' に対応する開始タグがありません`,
            code: 'unmatched-closing-tag'
          });
        }
      }
    }

    // 閉じられていないタグを検出
    for (const { tagName, pos } of tagStack) {
      const { line, character } = this.getLineColumn(pos);
      this.diagnostics.push({
        range: {
          start: { line, character },
          end: { line, character: character + tagName.length + 2 }
        },
        severity: 1,
        message: `タグ '${tagName}' が閉じられていません`,
        code: 'unclosed-tag'
      });
    }
  }

  private getLineColumn(pos: number): { line: number; character: number } {
    let line = 0;
    let character = 0;

    for (let i = 0; i < Math.min(pos, this.content.length); i++) {
      if (this.content[i] === '\n') {
        line++;
        character = 0;
      } else {
        character++;
      }
    }

    return { line, character };
  }
}

// 補完アイテムをエクスポート
export const TAG_COMPLETIONS = Array.from(VALID_TAGS).map(tag => ({
  label: tag,
  kind: 14, // Keyword
  detail: `WebRelease タグ: ${tag}`,
  documentation: getTagDocumentation(tag)
}));

export const FUNCTION_COMPLETIONS = Array.from(BUILT_IN_FUNCTIONS).map(func => ({
  label: func,
  kind: 3, // Function
  detail: `WebRelease 関数: ${func}()`,
  insertText: `${func}()`
}));

function getTagDocumentation(tag: string): string {
  const docs: Record<string, string> = {
    'wr-if': '条件分岐（条件付きレンダリング）。wr-then / wr-else と組み合わせて使います。',
    'wr-then': 'wr-if の条件が真のときに出力する内容です。',
    'wr-else': 'wr-if の条件が偽のときに出力する内容です。',
    'wr-for': 'リスト/文字列/回数（times）で繰り返します。',
    'wr-switch': '複数の分岐を扱う switch 構文です。',
    'wr-case': 'wr-switch ブロック内の case です。',
    'wr-default': 'wr-switch ブロック内の default（既定）です。',
    'wr-variable': '変数を定義します。',
    'wr-append': '変数に値を追記します。',
    'wr-clear': '変数をクリアします。',
    'wr-break': 'ループを抜けます。',
    'wr-return': '値を返します。',
    'wr-error': 'エラーを発生させます。',
    'wr-conditional': '条件ブロックです。',
    'wr-cond': 'wr-conditional 内の条件です。',
    'wr-comment': 'コメントブロック（出力には含まれません）。'
  };
  return docs[tag] || '';
}
