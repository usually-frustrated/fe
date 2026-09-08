# ⚯ devtools/ · agent-ref
↑ /AGENTS.md for repo-wide context

## identity
```
name:    @fe/fe-devtools
version: 1.0.0
module:  src/index.tsx
types:   src/index.tsx
MFE-deps: ∅  (no cross-MFE imports)
dependencies:
  "solid-js": "^1.9.0"  (bundled into output, NOT external)
devDependencies:
  "@fe/jit-plugin-solid": "workspace:*"  (used by build:options waterfall)
```

## purpose
Developer overlay MFE. Renders a floating panel for managing per-tab import map overrides.
Loaded by shell via `loadDevtools()` when `config.devtools` is set in platform.json.
Not in routes; activated by pointing the `devtools` key in platform.json to its artifact URL.

## tsconfig
target=ES2022 module=ESNext moduleResolution=bundler strict=true lib=[ES2022,DOM] include=[src]
jsx=react-jsx jsxImportSource=solid-js (standard Solid.js tsconfig; `@fe/jit-plugin-solid` handles the transform)

## files
```
src/index.tsx   DevTools Solid.js component + render() MFE export
src/styles.ts   static CSS-in-JS style objects (panelStyle, headerStyle, etc.)
dist/           build output (gitignored)
  index.js      bundled devtools (includes solid-js)
```

## src/index.tsx: full behaviour
```ts
export function render(container: HTMLElement, _props): () => void
  mounts <DevTools /> via solid-js · returns unmount fn

DevTools:
  toggle button (fixed, bottom-right) · badge shows active override count
  panel with:
    - list of active sessionStorage overrides (spec → url)
    - remove individual override · clear all
    - add override form (spec + url inputs)
    - share URL (encodes overrides as ?platform:overrides= param)
```

## override mechanism
```
sessionStorage key: "platform:overrides"
format: Record<specifier, url>

overrides are applied by packages/runtime/src/platform.ts:applyOverridesAndInject()
  → replaces resolved URL for a specifier before import map injection
  → active on next page load (reload triggered by devtools after write)

share URL: ?platform:overrides=<JSON>
  → processed by packages/runtime/src/overrides.ts:processUrlParams() on load
  → merged into sessionStorage overrides · URL param stripped
```

## build
```
# from repo root (preferred):
fe build toolkit/devtools
  → reads @fe/jit-plugin-solid from devDependencies via build:options waterfall
  → Bun.build(src/index.tsx → dist/index.js, esm, browser, external=[])
  → solid-js is bundled (not external)

# from toolkit/devtools/:
bun run build   (calls fe build toolkit/devtools via package.json script)

output: toolkit/devtools/dist/index.js
```

`fe build` checks for `src/index.tsx` first; devtools uses `.tsx` so this works correctly.
`solid-js` is listed in `dependencies` (not devDependencies), so it is bundled into the output.

## upload + activation (legacy artifact path)
Devtools uses the artifact upload path (`fe admin upload`) rather than JIT publish,
because the sandbox does not configure `jitPlugins` in `fe.config.json`.

```
# 1. Build
fe build toolkit/devtools

# 2. Upload artifact
fe admin upload toolkit/devtools
  copies dist/ → uploads/devtools/1.0.0/
  registers in platform.json packages section

# 3. Activate: add to platform.json manually:
{
  "devtools": "@fe/fe-devtools@1.0.0",
  "routes": { ... },
  "packages": { ... }
}

# 4. Rebuild shell to embed updated config:
fe build shell
```

## ✗ invariants
- solid-js goes in dependencies (not devDependencies); it must be bundled into dist/index.js
- @fe/jit-plugin-solid goes in devDependencies; it is used at build time only
- devtools is activated via platform.json "devtools" key, not via "routes"
- admin upload writes to packages only, never routes
