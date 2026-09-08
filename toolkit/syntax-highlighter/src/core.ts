import type { Category, Rule } from './types.ts';
import { ts } from './languages/ts.ts';
import { json } from './languages/json.ts';
import { shell } from './languages/shell.ts';
import { html } from './languages/html.ts';
import { autoTheme } from './themes/default.ts';

const sheet = new CSSStyleSheet();
sheet.replaceSync(autoTheme);

/** One `Highlight` object per token category, registered in `CSS.highlights` as `hl-<category>`. */
export const categories: Record<Category, Highlight> = {
    keyword: new Highlight(),
    string: new Highlight(),
    comment: new Highlight(),
    type: new Highlight(),
    number: new Highlight(),
    operator: new Highlight(),
    function: new Highlight(),
    property: new Highlight(),
    variable: new Highlight(),
    argument: new Highlight(),
    constant: new Highlight(),
    boolean: new Highlight()
};

if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
    for (const k in categories) CSS.highlights.set('hl-' + k, categories[k as Category]);
}

const languages: Record<string, Rule[]> = { ts, json, shell, html };

/**
 * Registers a language grammar at runtime.
 * @param name - Language identifier matched against `lang-<name>` class names.
 * @param rules - Tokenization rules applied in order; earlier rules win on overlap.
 */
export function registerLanguage(name: string, rules: Rule[]): void {
    languages[name] = rules;
}

/**
 * Internal worker to highlight a single <pre> element.
 * Returns the number of lines found (used to populate data-linenumbers).
 */
function highlightPre(el: HTMLPreElement): number {
    const langMatch = el.className.match(/lang-(\w+)/);
    const lang = langMatch ? langMatch[1] : null;
    if (!lang || !languages[lang]) return 0;

    const rules = languages[lang];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    let lines = 1;

    while (node = walker.nextNode() as Text | null) {
        const text = node.textContent || "";
        lines += (text.match(/\n/g)?.length ?? 0);
        let index = 0;

        while (index < text.length) {
            let matched = false;

            if (lang === 'html') {
                const subLangs = [
                    { pattern: /<style\b[^>]*>([\s\S]*?)<\/style>/gi, lang: 'ts' },
                    { pattern: /<script\b[^>]*>([\s\S]*?)<\/script>/gi, lang: 'ts' }
                ];

                for (const { pattern, lang: subLangName } of subLangs) {
                    pattern.lastIndex = index;
                    const m = pattern.exec(text);
                    if (m && m.index === index) {
                        const content = m[1];
                        const contentStart = m[0].indexOf(content);
                        const subRules = languages[subLangName];
                        if (subRules) {
                            subRules.forEach(({ category, pattern: p }) => {
                                p.lastIndex = 0;
                                let sm: RegExpExecArray | null;
                                while (sm = p.exec(content)) {
                                    try {
                                        const range = new Range();
                                        range.setStart(node!, index + contentStart + sm.index);
                                        range.setEnd(node!, index + contentStart + sm.index + sm[0].length);
                                        categories[category].add(range);
                                    } catch (e) {}
                                }
                            });
                        }
                        index += m[0].length;
                        matched = true;
                        break;
                    }
                }
            }

            if (matched) continue;

            for (const { category, pattern } of rules) {
                pattern.lastIndex = index;
                const m = pattern.exec(text);

                if (m && m.index === index) {
                    try {
                        const range = new Range();
                        range.setStart(node, index);
                        range.setEnd(node, index + m[0].length);
                        categories[category].add(range);
                        index += m[0].length;
                        matched = true;
                        break;
                    } catch (e) {}
                }
            }

            if (!matched) index++;
        }
    }

    return lines;
}

/**
 * Ensures the highlight stylesheet is adopted by the document or shadow root.
 */
function applySheet(root: Document | Element): void {
    const doc = root instanceof Document ? root : root.ownerDocument;
    if (doc && !doc.adoptedStyleSheets.includes(sheet)) {
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    }
    const rootNode = root.getRootNode();
    if (rootNode instanceof ShadowRoot && !rootNode.adoptedStyleSheets.includes(sheet)) {
        rootNode.adoptedStyleSheets = [...rootNode.adoptedStyleSheets, sheet];
    }
}

/**
 * Applies syntax highlighting to all `<pre class="lang-*">` elements inside `root`,
 * or to `root` itself if it is a matching `<pre>`. Adds the default stylesheet to
 * `root.ownerDocument.adoptedStyleSheets` on first call.
 *
 * @param root - The root element (Document, Element, or ShadowRoot) to search.
 */
export function highlight(root: Document | Element): void {
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;

    if (root instanceof Document) {
        Object.values(categories).forEach(h => h.clear());
    }

    applySheet(root);

    const blocks = root instanceof Element && root.matches('pre[class*="lang-"]')
        ? [root as HTMLPreElement]
        : [...root.querySelectorAll<HTMLPreElement>('pre[class*="lang-"]')];

    for (const pre of blocks) {
        const lines = highlightPre(pre);
        if ('linenumbers' in pre.dataset)
            pre.dataset.linenumbers = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    }
}

/**
 * Sets CSS custom properties on `document.documentElement` to override individual token colors.
 * Property names map to `--hl-<key>` (e.g. `{ keyword: "#ff0" }` sets `--hl-keyword: #ff0`).
 */
export function applyTheme(theme: Partial<Record<Category | 'comment-style', string>>): void {
    for (const [prop, val] of Object.entries(theme)) {
        if (val) document.documentElement.style.setProperty('--hl-' + prop, val);
    }
}

/**
 * Replaces the active theme stylesheet. Pass any theme string from the `themes/*` exports,
 * or supply raw `::highlight()` CSS rules to define a fully custom theme.
 */
export function setHighlightSheet(css: string): void {
    sheet.replaceSync(css);
}
