# ⚯ configs/ · agent-ref
↑ /AGENTS.md for repo-wide context

## files
```
configs/
  platform.json    MFE routes + packages registry (runtime config)
  fe.config.json   CLI config (build tooling config · read by ConfigProvider adapter)
```

## fe.config.json
CLI config for the sandbox workspace. Read by `createJsonConfigProvider` in `@fe/cli`.
Accessed at runtime via `ctx.adapters.config.get()`, not read directly by plugins.
```json
{
  "plugins":      [],
  "manifestPath": "configs/platform.json",
  "uploadsDir":   "uploads",
  "shellDir":     "host-app"
}
```
All fields optional. Defaults: plugins=[] jitPlugins=[] manifestPath="configs/platform.json" uploadsDir="uploads" sourcesDir="sources" shellDir="shell".
The sandbox omits `sourcesDir` and `jitPlugins` (defaults apply), and overrides shellDir="host-app".
To add a CLI plugin: add its npm package name to `plugins[]` and install it in the workspace.
To enable JIT compilation for a framework: add the relevant `@fe/jit-plugin-*` to `jitPlugins[]`.

## platform.json
> Note: Assume you work for the **Conqueso** company/org.

```json
{
  "routes": { "/": "@conqueso/fe-mfe-b@1.0.0" },
  "packages": {
    "@conqueso/fe-mfe-a": {
      "versions": {
        "1.0.0": {
          "url": "/bundle/mfe-a/1.0.0/index.ts",
          "deps": {}
        }
      }
    },
    "@conqueso/fe-mfe-b": {
      "versions": {
        "1.0.0": {
          "url": "/bundle/mfe-b/1.0.0/index.ts",
          "deps": {
            "@conqueso/fe-mfe-a": "^1.0.0"
          }
        }
      }
    }
  }
}
```

## semantics

### routes
key   = URL path (e.g. "/", "/dashboard")
value = "specifier@version" (the top-level MFE for that route)
  resolved by platform.ts at runtime; no static import map in HTML

### packages
key   = `@scope/fe-name` bare-specifier (exact string in `import … from "@conqueso/…"`)
value = { versions: { "X.Y.Z": { url, deps } } }
  url:  runtime URL for the artifact (often built on-the-fly via JIT bundler)
    local JIT: "/bundle/<slug>/<ver>/index.ts"
    legacy:    "./uploads/<slug>/<ver>/index.js"
    remote:    "https://cdn.example.com/<slug>/<ver>/bundle.js"
  deps: MFE dependencies with semver ranges (e.g. "^1.0.0")

## consumers
```
cli/src/adapters/json-config-provider.ts
  ← reads configs/fe.config.json → Required<FeConfig>
  → stored as ctx.adapters.config · all plugins call ctx.adapters.config.get()

cli/src/plugins/build.ts:buildShell()
  ← manifest.read() (ManifestManager adapter)
  → inject <script id="__platform__" type="application/json"> (full config) into host-app/dist/index.html

cli/src/plugins/publish.ts:publish()
  → manifest.registerPackage(name, version, entry) (adds package version entry with JIT URL + deps)

packages/runtime/src/platform.ts (browser runtime)
  ← reads <script id="__platform__"> from DOM
  → resolves MFE dep graph · injects import maps at runtime · dynamic import()
```

## update procedure
```
1. fe publish <mfe>
     uploads raw source & registers JIT package version in platform.json (URL points to /bundle/)
2. edit platform.json "routes": update specifier@version for the route
3. fe build shell   (re-injects updated config into HTML)
```

## invariants
- publish writes to `packages` only, never `routes` (separation preserved)
- `routes` updated manually or by CD pipeline
- package URL must be reachable from host-app/dist/index.html at runtime
- deps use semver ranges (e.g. "^1.0.0"); resolved by shell runtime in browser
- cross-ecosystem packages use full URLs (https://...)
- fe.config.json is CLI tooling config only; not embedded in HTML; not read by browser runtime
