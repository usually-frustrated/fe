# Changelog

## 0.3.0

### Added

- **Line numbers** via `data-linenumbers` boolean attribute. Add the attribute to any `<textarea lang>` or `<pre class="lang-*">` block to display a number column on the left. The count is computed as a by-product of the tokenizer pass — no second DOM traversal. Numbers are rendered entirely by CSS (`::before { content: attr(data-linenumbers) }`) with zero new DOM nodes injected into the code content. Blocks with line numbers scroll horizontally rather than wrap, keeping numbers aligned. Four custom properties control the appearance: `--ln-width`, `--ln-color`, `--ln-opacity`, `--ln-border`.

## 0.2.3

Initial public release. Syntax highlighting via the CSS Custom Highlight API for TypeScript, JSON, Shell, and HTML. Five built-in themes. Auto-observer entry point and manual `core` entry point. Runtime language registration via `registerLanguage`.
