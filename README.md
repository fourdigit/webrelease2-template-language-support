# WebRelease2 Template Language Support

VS Code extension providing language support for WebRelease2 template language with syntax highlighting, validation, and code completion.

**No external dependencies required** - Just install the extension and start using it!

## Features

### Syntax Highlighting

Full syntax highlighting for WebRelease2 template files including:
- Expression highlighting (`%...%`)
- Tag highlighting (`<wr-*>`)
- Comment highlighting
- Attribute highlighting

### Validation

Real-time syntax checking and error detection:
- Expression syntax validation
- Tag validation
- Attribute validation
- Tag closure validation
- **List element function call validation**

### List Element Validation

The extension detects when `selectedValue()`, `selectedName()`, or `selected()` functions are incorrectly called on list elements:

```html
<!-- ❌ Error: Cannot call 'selectedValue()' on list element -->
<wr-for list='card.selectPriceInfo' variable="info">
    %card.selectPriceInfo.selectedValue().txtHtml%
</wr-for>

<!-- ✓ Correct: Use loop variable instead -->
<wr-for list='card.selectPriceInfo' variable="info">
    %info.selectedValue().txtHtml%
</wr-for>
```

### Code Completion

Intelligent completion for:
- Tags (`<wr-if`, `<wr-for`, etc.)
- Attributes (`condition=`, `list=`, `variable=`, etc.)
- Functions (`pageTitle()`, `isNotNull()`, etc.)

### Hover Information

Documentation on hover for:
- Tags
- Functions

## Installation

### From VSIX File

1. Download the `.vsix` file from the [Releases](https://github.com/fourdigit/webrelease2-template-language-support/releases) page
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type `Extensions: Install from VSIX...`
5. Select the downloaded `.vsix` file

### From Command Line

```bash
code --install-extension webrelease2-template-lsp-0.6.0.vsix
```

## Supported File Extensions

- `.wr2`
- `.wrt`

## Supported Tags

| Tag | Description |
|-----|-------------|
| `wr-if` | Conditional rendering |
| `wr-then` | Content when condition is true |
| `wr-else` | Content when condition is false |
| `wr-for` | Loop construct |
| `wr-switch` | Switch statement |
| `wr-case` | Case within switch |
| `wr-default` | Default case |
| `wr-variable` | Define a variable |
| `wr-append` | Append to a variable |
| `wr-clear` | Clear a variable |
| `wr-break` | Break from loop |
| `wr-return` | Return a value |
| `wr-error` | Raise an error |
| `wr-conditional` | Conditional block |
| `wr-cond` | Condition within conditional |
| `wr-comment` | Comment block |

## Supported Functions

### Selection Functions
- `selectedValue()` - Get selected value from select element
- `selectedName()` - Get selected name from select element
- `selected()` - Check if checkbox/radio is selected

### Null Check Functions
- `isNull(value)` - Check if value is null
- `isNotNull(value)` - Check if value is not null
- `isNumber(value)` - Check if value is a number

### String Functions
- `length(str)` - Get string/array length
- `substring(str, start, end)` - Extract substring
- `indexOf(str, substr)` - Find substring position
- `contains(str, substr)` - Check if string contains substring
- `startsWith(str, prefix)` - Check if string starts with prefix
- `endsWith(str, suffix)` - Check if string ends with suffix
- `toUpperCase(str)` - Convert to uppercase
- `toLowerCase(str)` - Convert to lowercase
- `trim(str)` - Remove whitespace
- `replace(str, from, to)` - Replace text
- `split(str, delimiter)` - Split string
- `join(array, delimiter)` - Join array

### Math Functions
- `round(num)` - Round number
- `floor(num)` - Floor function
- `ceil(num)` - Ceiling function
- `abs(num)` - Absolute value
- `min(a, b)` - Minimum value
- `max(a, b)` - Maximum value
- `divide(a, b, scale, mode)` - Division
- `setScale(num, scale)` - Set decimal places

### Other Functions
- `pageTitle()` - Get page title
- `currentTime()` - Get current time
- `formatDate(time, format)` - Format date
- `number(value)` - Convert to number
- `string(value)` - Convert to string

## Development

### Prerequisites

- Node.js 18+
- npm

### Build

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

### Project Structure

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

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [WebRelease Documentation](https://www.frameworks.co.jp/support/manual/2.8/nkus7r000001ybbg.html)
- [GitHub Repository](https://github.com/fourdigit/webrelease2-template-language-support)
