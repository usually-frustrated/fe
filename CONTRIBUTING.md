# Contributing

## Toolchain

**Bun only.** No Node, npm, webpack, Vite, or Rollup. Install [Bun](https://bun.sh) before anything else.

## Setup

```bash
# Install all workspace dependencies from repo root
bun install
```

## Building and serving the full stack

> Note: For the following examples, assume you work for the **Conqueso** company/org.

```bash
fe publish sandbox/mfe-a
fe publish sandbox/mfe-b
fe build toolkit/devtools
fe admin upload toolkit/devtools
# edit sandbox/configs/platform.json "routes" if needed
fe build shell
fe serve
```

`fe publish` uploads raw source and `package.json` and registers a JIT bundle URL. `fe build` is not required
before `fe publish`; the pre-flight check inside `publish` is sufficient.

Devtools uses the legacy artifact path (`fe build + fe admin upload`) because the sandbox
`fe.config.json` does not configure `jitPlugins` for Solid.js JIT compilation.

## Developing an MFE in isolation

```bash
fe dev sandbox/mfe-a     # sandbox at http://localhost:3000
```

Edit `src/`: Bun rebuilds, SSE notifies the browser, module swaps in-place. No page reload.

> **Note:** `dev` mode only maps the target MFE in its import map. If the MFE imports other MFE packages (e.g. `mfe-b` importing `mfe-a`), those deps won't resolve in the sandbox. Build and upload them first, then use `serve` instead.

## Publishing a new MFE version

```bash
# 1. Build
fe build sandbox/mfe-a

# 2. Publish: uploads source for JIT and registers entry in sandbox/configs/platform.json
fe publish sandbox/mfe-a
# → Registered @conqueso/fe-mfe-a@1.0.0

# 3. Activate: edit sandbox/configs/platform.json "routes" to point to the new version
#    "routes": { "/": "@conqueso/fe-mfe-b@1.0.0" }

# 4. Rebuild shell to embed the updated config
fe build shell && fe serve
```

`admin upload` writes to `packages` only; it never touches `routes`. Artifact publishing and version activation are distinct steps with different access requirements.

## Linking a new MFE dependency

The `link` command adds the dep as a `devDependency` with a `file:` URI and runs `bun install`, so TypeScript resolves the import directly via `node_modules` without any `tsconfig` path config:

```bash
fe link sandbox/mfe-b sandbox/mfe-a
```

For packages in separate repositories, replace `file:../mfe-a` with a git URI manually; nothing else changes:

```json
"@conqueso/fe-mfe-a": "git+https://github.com/org/mfe-a#v1.0.0"
```

## CLI config (`sandbox/configs/fe.config.json`)

The CLI reads its own config through the `ConfigProvider` adapter (`ctx.adapters.config`). The default implementation reads `configs/fe.config.json` relative to the workspace root. All fields are optional:

```json
{
  "plugins":      [],
  "manifestPath": "configs/platform.json",
  "uploadsDir":   "uploads",
  "shellDir":     "host-app"
}
```

To extend the CLI (e.g. swap local artifact storage for S3), add a plugin package name to `plugins` and install it. Plugins swap `ctx.adapters.*` in their `setup()` function. Inside a plugin, always read config via `ctx.adapters.config.get()`; never read the file directly.

## How MFE externalization works

`helpers.ts:readFeDepKeys` reads `devDependencies` from the target's `package.json` and passes any key matching `isMfeSpecifier(key)` to `Bun.build`'s `external` option. The naming convention itself is the build signal; no extra config needed.

## Hot reload internals

1. Bun file watcher detects a change in `src/`
2. Bun rebuilds (typically <100ms)
3. SSE (`/__dev`) pushes `{ t: timestamp }`
4. Browser: `unmount()` tears down the current render; `import("/index.js?t=<timestamp>")` loads the fresh module under a new URL (bypasses native module registry cache); `render()` mounts the new version

`pendingTs` on the server holds the latest completed rebuild timestamp. New SSE connections drain it immediately — reconnecting tabs never miss a build.

## Code guidelines

- Source files: max 180 lines, split immediately when exceeded
- No comments unless logic is genuinely non-obvious; no section headers or doc comments
- Prefer functions over classes
- No stubs, mocks, or temporary workarounds: production-ready code only
- MFE packages must go in `devDependencies`, not `dependencies`: `helpers.ts:readFeDepKeys` filters on devDeps using `isMfeSpecifier`
- CLI plugins access config via `ctx.adapters.config.get()`; never import from CLI internals directly

## Pre-PR checklist

Before opening a pull request, update all of the following to reflect the current state:

- [ ] All affected `AGENTS.md` files
- [ ] All affected `README.md` files (root and any relevant subpackage)
- [ ] `CONTRIBUTING.md`: if any workflow, setup step, or development pattern changed
- [ ] [Documentation wiki](https://deepwiki.com/fe-platform/fe): verify any affected concepts are still accurate
