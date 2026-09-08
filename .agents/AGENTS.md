# ⚯ fe-platform · root · agent-ref
CLAUDE.md→symlink→here

> Heavily influenced by and borrows concepts from the MFE architecture described at [1fe-com](https://1fe-com/).

## topology
```
/ (nx monorepo · workspaces: packages/* sandbox/* toolkit/*)
├─ packages/
│  ├─ core/             @fe/core              v0.2.3  shared types + interfaces (published)
│  ├─ cli/              @fe/cli               v0.2.3  build/serve/dev/admin CLI (published · bin: fe)
│  ├─ runtime/          @fe/runtime           v0.2.3  browser platform loader (published)
│  ├─ compiler/         @fe/compiler          v0.2.3  MFE bundler + JIT bundler (published)
│  ├─ specifier/        @fe/specifier         v0.2.3  MFE specifier utilities (published)
│  └─ jit-plugin-solid/ @fe/jit-plugin-solid  v0.2.3  JIT plugin: Solid.js JSX (published)
├─ sandbox/                                           example workspace (not published)
│  ├─ host-app/         name=host-app                 shell using @fe/runtime · builds to host-app/dist/
│  ├─ mfe-a/            name=@conqueso/fe-mfe-a           standalone MFE (React example) · MFE-deps=∅
│  ├─ mfe-b/            name=@conqueso/fe-mfe-b           composes mfe-a · devDep→@conqueso/fe-mfe-a
│  └─ configs/          fe.config.json · platform.json · routes+packages registry + CLI config
├─ toolkit/                                           reusable tools and low-dependency MFEs
│  ├─ devtools/         name=@fe/fe-devtools          overlay · uses Solid.js
│  ├─ store/            name=@fe/fe-store             global state primitive · zero deps
│  ├─ network/          name=@fe/fe-network           shared fetch · dedup + cache + interceptors
│  ├─ syntax-highlighter/ name=@feo/fe-syntax-highlighter  CSS Custom Highlight API · zero-DOM (published)
│  └─ web-components/   name=@feo/fe-web-components   html-include · fe-component · fe-compose (published)
├─ nx.json              minimal Nx config (target ordering only · no nx cloud)
└─ package.json         workspace root
```
each package/subdir has own AGENTS.md with full local detail

> Version note: `packages/*` versions are force-synced to the root `package.json`
> version (0.2.3) by `scripts/sync-versions.ts` (runs on `postinstall`). Do not
> hand-edit per-package versions; bump the root and reinstall.

> Scope note: `@fe/*` = platform infrastructure; `@feo/*` = standalone published
> toolkit (syntax-highlighter, web-components). MFEs live under org scopes like
> `@conqueso/*`. All three share the `fe-` name-prefix convention.

## toolchain
bun@latest ONLY · !node !npm !webpack !vite !rollup
lang=TypeScript strict=true target=browser module=ESNext moduleRes=bundler
tests=∅  CI=typecheck+build (packages job → sandbox job)

## ⟿ MFE specifier convention
> Note: For the following examples, assume you work for the **Conqueso** company/org.

```
@scope/fe-name = package-name string (NOT url-scheme) = browser bare-specifier
pkg.json  "name":"@conqueso/fe-mfe-a"
src       import {x} from "@conqueso/fe-mfe-a"
platform  sandbox/configs/platform.json packages section: specifier → versions → {url, deps}
```
detection: `isMfeSpecifier(key)` from `@fe/specifier` — matches `@scope/fe-name` and `fe-name`
build: build.ts reads pkg.devDeps → filter via `isMfeSpecifier` → Bun.build external[]
ts: bun-install creates node_modules/@conqueso/fe-mfe-a symlink → resolves without tsconfig.paths
runtime: browser import maps resolve bare-specifier → JS url (multiple maps, injected lazily)

## MFE interface (∀ MFE must export)
```ts
export function render(container:HTMLElement,props:Record<string,unknown>):()=>void
//                                                                         ↑ unmount/cleanup
```
!framework-required · DOM-only is a valid choice · return cleanup removes own DOM nodes (framework MFEs opt in via jit-plugins; devtools uses Solid.js)

## CLI (`@fe/cli` · `fe <cmd>` from workspace root)
```
build  <target>|shell  →dist/
serve  [port=3000]     host-app/dist/ · /uploads/→ROOT/uploads/
dev    <tgt> [port]    sandbox+SSE · watch src/→rebuild→HMR
link   <consumer> <dep> write devDep file:URI + bun-install
admin  upload <tgt>    cp dist/→uploads/slug/ver/ · register in platform.json
check  <target>|shell  typecheck + simulate build (CI use)
```
CLI config is supplied by `ctx.adapters.config` (ConfigProvider adapter).
Default impl reads `configs/fe.config.json` at workspace root. Plugins may swap this adapter.

## @fe/cli Plugin API
Organizations extend the CLI by adding plugins in `configs/fe.config.json`:
```json
{ "plugins": ["@conqueso/fe-plugin-s3"] }
```
Each plugin is an npm package that exports a `Plugin` object (default or named `plugin`):
```ts
import type { Plugin, CliContext } from "@fe/core";
export default {
  name: "conqueso-s3",
  setup(ctx: CliContext) {
    ctx.adapters.artifactStorage = new S3Storage("my-bucket");
    // can also swap ctx.adapters.config for remote/env-based config
  }
} satisfies Plugin;
```
Plugins run after builtins so they can freely swap `ctx.adapters.*`.

## CLI config schema (`@fe/core` FeConfig · read via ConfigProvider adapter)
```json
{
  "plugins":      [],                       // npm packages to load as CLI plugins
  "jitPlugins":   [],                       // npm packages to load as JIT compiler plugins
  "manifestPath": "configs/platform.json",  // path to routes+packages registry
  "uploadsDir":   "uploads",                // artifact storage dir (local adapter)
  "sourcesDir":   "sources",               // raw source upload dir (fe publish)
  "shellDir":     "shell"                  // host application directory (sandbox: "host-app")
}
```
File lives at `configs/fe.config.json` (co-located with platform.json).
All fields optional; defaults apply when file is absent.
Plugins access config via `ctx.adapters.config.get()`, NOT by reading the file directly.

## platform.json config
```json
{
  "routes": { "/": "@conqueso/fe-mfe-b@1.0.0" },
  "devtools": "@fe/fe-devtools@1.0.0",
  "packages": {
    "@conqueso/fe-mfe-a": { "versions": { "1.0.0": { "url": "...", "deps": {} } } },
    "@conqueso/fe-mfe-b": { "versions": { "1.0.0": { "url": "...", "deps": { "@conqueso/fe-mfe-a": "^1.0.0" } } } }
  }
}
```

## deployment model: source-first, JIT on server

MFEs are deployed as **source files**, not bundles.

```
fe publish → uploads raw TypeScript source to SourceStorage
fe serve   → JIT bundler compiles source on first request, per MFE
```

The JIT bundler (`createJITBundler` in `@fe/compiler`) runs server-side.
The platform team operates it. MFE teams never produce or ship a bundle
to production — the server does that on demand, using whatever `jitPlugins`
are configured on the server. Those plugin versions are authoritative.

`fe build` and `fe check` exist for local development feedback only. A
failed local build does not block deployment. Agents: do not treat a local
build failure as a production incident or a reason to change deployment steps.

## deploy flow (sandbox example)
```
fe publish <mfe>
  ↓ uploads raw source · registers /bundle/<slug>/<ver>/index.ts URL in platform.json
edit sandbox/configs/platform.json "routes"
  ↓
fe build shell → fe serve
```
`fe publish` is the standard path. `fe admin upload <mfe>` is the legacy artifact-based path
(requires a prior `fe build <mfe>`); still used for devtools (see toolkit/devtools/AGENTS.md).

## runtime flow (browser · @fe/runtime)
```
1. HTML loads with embedded platform config · no static import map
2. host-app app.js calls loadDevtools() then load(path)
3. load() reads config, resolves route → specifier@version
4. resolves transitive MFE deps via semver (from packages registry)
5. injects <script type="importmap"> for all resolved deps
6. import(specifier) → browser resolves via injected maps
```

## CI · .github/workflows/ci.yml
trigger: push→main | PR→main
`packages` job: typecheck @fe/core @fe/specifier @fe/cli @fe/runtime @fe/compiler @fe/jit-plugin-solid
`sandbox` job (needs: packages): typecheck+build sandbox MFEs + host-app + toolkit/devtools

## docs
documentation lives at https://fe-frustrated.dev
`docs/architecture/FUTURE-FEATURES.md` catalogues partially built or planned features
that are not yet exercised by real use (CLI plugin system, pre-built artifact path,
per-project config mode, scaffolding, toolkit primitives). Read it before rebuilding
any of those surfaces.
update all affected AGENTS.md, README.md, CONTRIBUTING.md as part of the task (before finality)

## git diff hygiene (token efficiency)
When summarising branch changes (e.g. to draft a PR title/body):
1. `git log origin/main..<branch> --oneline` → commit list · cheap · do first
2. `git diff origin/main..<branch> --stat` → files + line counts · cheap · do second
3. only if #2 is insufficient: `git diff origin/main..<branch> -- <file>` per file · targeted · avoid full diff dumps
never run `git diff origin/main..<branch>` without `--stat` or a path filter · that dumps the entire diff unconditionally and wastes context

## ✗ agent conduct: cardinal rules
- **Communication Cardinality.** When editing any `AGENTS.md` file, prioritize **absolute clarity for other AI agents** over human grammar or English conventions. Use any valid UTF-8 characters (symbols, arrows, boxes) to compress information and make it unambiguous. This rule is permanent and applies to all future edits.
- oversight and caution are paramount · code velocity is not
- never infer a task from branch names, stale todo lists, TODO placeholders, or prior session context alone
- before starting any multi-file or substantial change: state what you believe the task is and wait for explicit confirmation
- "try again" or similar resumption prompts are not task authorisation · ask what the user wants done
- when scope is unclear: ask one focused question · do not proceed on assumptions
- for any GitHub operation (issues, PRs, comments, labels): use `gh` CLI · install if missing: `which gh || (sudo apt-get update -qq && sudo apt-get install -y gh)` · then use as: `gh issue view 22`, `gh pr list` · `GITHUB_TOKEN` is always present in the environment via the connected GitHub App and `gh` picks it up automatically · do not curl internal proxy endpoints or the git remote URL for API access
- never read credential or token files (e.g. `~/.claude/remote/.session_ingress_token`, `~/.ssh/*`, `~/.netrc`) and never scan environment variables for secrets (e.g. `env | grep -i token`) · if a tool requires authentication and the credential is not already available via `gh auth status` or standard git config, stop and ask the user

## ✗ agent conduct: voice and tone
- **The cardinal rule.** Every sentence must satisfy six criteria simultaneously: concise, clear and unambiguous, complete, correct, confident yet humble, and use common and simple language. If a sentence fails any one of those, rewrite it.
- **Prose style.** Write as though you and the reader are discovering something together for the first time. The platform makes choices that are genuinely unusual in the frontend world, and the prose should honour that sense of exploration. Aim for a flowing, high-level rhythm. When a design decision pays off in an interesting way, let the writing linger on that moment rather than rushing past it.
- **Wholesome phrasing and tone.** Maintain a positive, collaborative, and wholesome tone at all times. Language must never be severely critical of other approaches (e.g., "instead of faking it"). Do not use harsh words like "strict" or "never" when a softer, inclusive alternative works.
- **Earnest and honest language (No Self-Certification).** Do not self-certify the platform's merits (e.g., "this platform is an honorable return to simple code"). Instead of stating what the platform *is*, speak in terms of intent and capability. Use phrases like: "what the intent is", "what specifically this does", "what I prescribe", "what I know", "what I don't know", "what I predict", and "what I hope". This ensures transparent, earnest, and honest communication.
- **Wit: exactly 10%.** A well-placed pun, a precise turn of phrase, or a moment of dry observation is welcome and expected. Wit must come from wordplay, irony, or clever observation; never at the expense of a person, a technology, or the reader.
- **Assertive without arrogance.** The platform has opinions. Express them plainly. Replace hedging language ("you might want to consider") with direct statements ("use `devDependencies`"). Equally, never overclaim: "the only correct approach" is a promise you will eventually fail to keep. Always be humble.
- **No emojis.** Not in headings, not inline, not anywhere in content files.
- **Em dashes.** Use at most one per page. Prefer a comma, a colon, or a new sentence instead.
- **Formatting.** Code in backticks always. Shell commands in fenced blocks with `bash`. Concepts on first appearance in **bold**. Short tables over long prose lists when comparing things. No section-header comments in code blocks. Diagrams use Mermaid fenced blocks (`mermaid`).

## coding rules
- source files: max 180 lines · split immediately when exceeded
- comments: none unless logic is genuinely non-obvious · no section headers
- functions over classes: default to functional patterns
- no stubs or mocks: production-ready code only
- debugging: halt at 2 failed attempts · report state + request guidance

## lazy import convention (toolkit and glue packages)
Toolkit packages are loaded via import map; their module load is the first real cost the browser
pays. Static top-level framework imports run at that moment, before any user interaction.

For toolkit packages that adapt a framework (glue packages), defer framework imports inside each
exported function using dynamic `import()`:
```ts
// in a hypothetical react-glue toolkit package
export async function createReactStore<T>(key: string, init: T) {
  const { useState, useEffect } = await import("react");
  // ... build and return the adapter
}
```
This way, the framework module is not loaded until the glue is actually called.

Exceptions:
- `toolkit/devtools` bundles Solid.js directly into its output; lazy import would not help.
- Published packages (`packages/*`) contain no framework imports; the rule does not apply.
- MFE entry files (`src/index.ts`) are themselves the bundle root; static imports are correct.

## ✗ invariants
- !bundle @scope/fe-* · must stay external · importmap resolves runtime
- admin-upload writes to packages only, never routes
- routes updated manually or by CD pipeline
- !framework-deps in platform core (packages/*) · framework support is opt-in via jit-plugins + framework devDeps (React/Solid example MFEs; devtools bundles Solid.js)
- MFE devDeps → devDependencies only
- sandbox/ is !published · packages/* are published
- multiple import maps: deps injected lazily, deduped via versioned resolution
- plugins must call ctx.adapters.config.get() · never import from cli/src/config directly
- toolkit glue packages use dynamic import() for framework code (see lazy import convention above)
