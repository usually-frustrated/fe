# @feo/fe-syntax-highlighter

Syntax highlighting via the [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API). Styles text ranges in place rather than wrapping tokens in `<span>` elements, so the DOM stays clean and copy-paste works naturally.

## Credits

Based on techniques from **[Ivo Culic](https://ivoculic.dev/)**: [CSS Custom Highlight API for Syntax Highlighting](https://front-end.tips/css-highlights-api-for-syntax-highlighting/).

## Usage

Import the package once. A MutationObserver activates automatically and processes code blocks as they appear in the DOM — no manual calls needed.

```js
import "@feo/fe-syntax-highlighter";
```

### Authoring code blocks

Use `<textarea lang="...">` for inline code. The browser treats textarea content as raw text, so angle brackets, generics, and HTML-like syntax work without escaping:

```html
<textarea lang="ts">
const items: Array<string> = [];
</textarea>
```

The observer swaps each `<textarea lang>` with a highlighted `<pre><code>` automatically.

For markdown-generated output, `<pre class="lang-*">` is also picked up automatically:

```html
<pre class="lang-ts">const x = 42;</pre>
```

Before the observer runs, `textarea[lang]` elements are hidden via `display: none`. Add the following to your stylesheet so they render as code blocks in no-JS environments or before the module loads:

```css
textarea[lang] {
    display: block;
    width: 100%;
    box-sizing: border-box;
    resize: none;
    overflow: hidden;
    font-family: monospace;
    white-space: pre;
    field-sizing: content;
    /* match your existing <pre> styles: */
    background: #f5f5f5;
    padding: 1.25rem;
    font-size: 85%;
    line-height: 1.55;
    border-radius: 4px;
}
```

### Languages

Built-in: `ts`, `json`, `shell`, `html`. Pass the name as the `lang` attribute on `<textarea>`, or as a `lang-<name>` class on `<pre>`:

```html
<textarea lang="json">{ "key": "value" }</textarea>
<pre class="lang-shell">bun install</pre>
```

Register additional languages at runtime:

```js
import { registerLanguage } from "@feo/fe-syntax-highlighter";

registerLanguage("rust", [
    { category: "keyword", pattern: /\b(fn|let|mut|pub|use|mod)\b/g },
    { category: "comment", pattern: /\/\/.*/g }
]);
```

### Line numbers

Add the `data-linenumbers` boolean attribute to show line numbers:

```html
<textarea lang="ts" data-linenumbers>
const x = 1;
const y = 2;
console.log(x + y);
</textarea>
```

The same attribute works on `<pre class="lang-*">` blocks from markdown generators:

```html
<pre class="lang-ts" data-linenumbers><code>const x = 1;
const y = 2;</code></pre>
```

Line numbers are rendered entirely by CSS via `::before { content: attr(data-linenumbers) }` — no extra DOM nodes are injected into the code. The count is computed as a by-product of the tokenizer pass and written as the attribute value. To keep numbers aligned, blocks with `data-linenumbers` scroll horizontally rather than wrap long lines.

Four CSS custom properties control the appearance:

| Property | Default | Controls |
|---|---|---|
| `--ln-width` | `2ch` | minimum width of the number column |
| `--ln-color` | `currentColor` | color of the numbers |
| `--ln-opacity` | `0.4` | opacity of the numbers |
| `--ln-border` | `currentColor` | color of the divider line |

Copy-pasting a highlighted block omits the line numbers — `user-select: none` on the `::before` pseudo-element prevents them from being selected.

### Themes

Five themes ship as importable CSS strings:

| Export | Path |
|---|---|
| `autoTheme` | `@feo/fe-syntax-highlighter/themes/auto` |
| `lightTheme` | `@feo/fe-syntax-highlighter/themes/light` |
| `darkTheme` | `@feo/fe-syntax-highlighter/themes/dark` |
| `draculaTheme` | `@feo/fe-syntax-highlighter/themes/dracula` |
| `githubLightTheme` | `@feo/fe-syntax-highlighter/themes/github-light` |

The default theme (`autoTheme`) switches between light and dark based on `prefers-color-scheme`.

Switch themes by passing the string to `setHighlightSheet`:

```js
import { setHighlightSheet } from "@feo/fe-syntax-highlighter";
import { draculaTheme } from "@feo/fe-syntax-highlighter/themes/dracula";

setHighlightSheet(draculaTheme);
```

Override individual colors with CSS custom properties:

```css
:root {
    --hl-keyword: #4338ca;
    --hl-string: #10b981;
}
```

Available properties: `--hl-keyword`, `--hl-string`, `--hl-comment`, `--hl-type`, `--hl-number`, `--hl-operator`, `--hl-function`, `--hl-property`, `--hl-variable`, `--hl-argument`, `--hl-constant`, `--hl-boolean`.

### Manual control

If you prefer to manage highlighting yourself, import from the `core` entry point. No observer or side effects:

```js
import { highlight, registerLanguage } from "@feo/fe-syntax-highlighter/core";

highlight(document); // or highlight(myContainer)
```

## Browser support

Requires the CSS Custom Highlight API. Supported in Chrome 105+, Safari 17.2+, Firefox 135+. `highlight()` is a no-op in unsupported browsers.

## License

MIT
