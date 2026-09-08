# ⚯ packages/cli/ · agent-ref
↑ /AGENTS.md for repo-wide context
↑ packages/core/AGENTS.md for all types/interfaces

## purpose
`@fe/cli` v0.2.3 — the `fe` binary. Bootstraps context, loads plugins, dispatches commands.
Published. Entry: `src/index.ts` → dispatches to `ctx.commands`. Bin alias: `fe`.

## src/ file map
```
src/
  index.ts                           CLI entry: parse argv → bootstrap → dispatch
  bootstrap.ts                       wires up CliContext + loads plugins
  plugin-loader.ts                   dynamic import() of external plugin npm packages
  helpers.ts                         readPackageMeta · readFeDepKeys · readFeDeps · slugFromSpecifier · isMfeSpecifier
  adapters/
    json-config-provider.ts          ConfigProvider: reads configs/fe.config.json
    json-manifest-manager.ts         ManifestManager: reads/writes configs/platform.json
    local-source-storage.ts          SourceStorage: cp src/→sources/<slug>/<ver>/
    local-artifact-storage.ts        ArtifactStorage: cp dist/→uploads/<slug>/<ver>/
    bun-builder.ts                   Builder: thin Bun.build() wrapper; applies BuildOptions.plugins
  plugins/
    build.ts                         `fe build <target|shell>`
    serve.ts                         `fe serve [port]` (has JIT bundler; passes ctx.jitPlugins)
    dev.ts                           `fe dev <target> [port]`
    link.ts                          `fe link <consumer> <dep>`
    publish.ts                       `fe publish <target>`
    admin.ts                         `fe admin upload <target>` (legacy artifact upload)
    check.ts                         `fe check <target|shell>`
    new.ts                           `fe new <scope/name>` (scaffold new MFE)
```

## bootstrap flow (bootstrap.ts)
```
1. createJsonConfigProvider(root)          → configProvider
2. configProvider.get()                    → feConfig (plugins, jitPlugins, manifestPath, uploadsDir, shellDir)
3. build CliContext:
     adapters.config          = configProvider
     adapters.sourceStorage   = createLocalSourceStorage(root, feConfig.sourcesDir)
     adapters.artifactStorage = createLocalArtifactStorage(root, feConfig.uploadsDir)
     adapters.manifest        = createJsonManifestManager(root, feConfig.manifestPath)
     adapters.builder         = createBunBuilder()
     jitPlugins               = []
4. loadExternalPlugins(root, feConfig.plugins)  → external Plugin[]
5. run setup() for each plugin in order:
     BUILTIN_PLUGINS (build, serve, dev, link, admin, check) first
     external plugins after → can swap any ctx.adapters.*
6. load JIT plugins from feConfig.jitPlugins → push to ctx.jitPlugins
7. register build:options waterfall hook → applies ctx.jitPlugins transforms before each build
```
The `configProvider` is stored in `ctx.adapters.config` so plugins can swap it or call `.get()`.
CLI plugins added before step 6 can push to `ctx.jitPlugins` in their `setup()`.

## ConfigProvider adapter

### json-config-provider.ts (monorepo / shell mode)
```ts
createJsonConfigProvider(root: string): ConfigProvider
```
Reads `<root>/configs/fe.config.json`. This is the default used at bootstrap.

Returns `Required<FeConfig>` with defaults merged:
```
plugins:      []                      npm packages loaded as CLI plugins
jitPlugins:   []                      npm packages loaded as JIT compiler plugins
manifestPath: "configs/platform.json" path to routes+packages registry
uploadsDir:   "uploads"               artifact storage dir (fe admin upload)
sourcesDir:   "sources"               source upload dir (fe publish)
shellDir:     "shell"                 host application directory
```

**All plugins must call `ctx.adapters.config.get()` to read config — never import from these files directly.**

## Plugin pattern
Each builtin plugin's `run()` fetches config on-demand:
```ts
// correct ✓
const feConfig = await ctx.adapters.config.get();

// wrong ✗ (config.ts was deleted — this will not compile)
const { readFeConfig } = await import("../config");
```

## Command behaviours

### build (plugins/build.ts)
```
fe build <target>   Bun.build src/index.ts → dist/index.js, esm, browser
                    external[] = MFE specifier keys from devDependencies
fe build shell      Bun.build src/index.ts → dist/app.js
                    reads platform.json → injects as <script id="__platform__"> in dist/index.html
```
`buildTarget(ctx, hooks, target, shellDir)` is exported — re-used by dev plugin.
JIT plugin transforms are applied via the `build:options` waterfall hook before each build.

### serve (plugins/serve.ts)
```
fe serve [port=3000]
  mounts JIT bundler at /bundle/* (passes ctx.jitPlugins for on-demand compilation)
  serves <shellDir>/dist/  (index.html + app.js)
  /<uploadsDir>/* → <root>/<uploadsDir>/  (artifact passthrough)
  all other paths → distDir file or 404
```

### dev (plugins/dev.ts)
```
fe dev <target> [port=3000]
  initial build of target
  serves at http://localhost:<port>:
    /          → sandboxHtml (inline importmap + SSE reload)
    /index.js  → dist/index.js
    /__dev     → SSE stream (data: {t: timestamp})
  watches src/ (recursive) → rebuild → notifyReload() via SSE
  HMR: browser imports /index.js?t=<ts> → unmounts old · mounts new
```

### link (plugins/link.ts)
```
fe link <consumer> <dep>
  reads dep's package.json → name
  writes consumer/package.json devDependencies[depName] = "file:../dep"
  runs bun install in consumer/
```

### publish (plugins/publish.ts)
```
fe publish <target>
  runs pre-flight check (build simulation to /dev/null via index.ts or index.tsx)
  reads name + version from target/package.json
  slug = slugFromSpecifier(name)
  sourceStorage.upload(slug, version, tmpDir)  // uploads src/ content + package.json
  reads MFE devDeps → resolves dep versions from local package.json files
  url = `/bundle/${slug}/${version}/index.{ts|tsx}`
  manifest.registerPackage(name, version, {url, deps})
```
Never touches "routes": only "packages" in platform.json. Legacy `admin.ts` provides artifact uploads but `publish` handles source code for JIT.

### new (plugins/new.ts)
```
fe new <scope/name>
  creates <name-slug>/ directory in cwd with:
    package.json  name=@<scope>/fe-<name>, build/check scripts
    tsconfig.json  strict · ESNext · bundler moduleResolution
    src/index.ts   render() stub
  exits 1 if directory already exists
```

### check (plugins/check.ts)
```
fe check <target|shell>
  tsgo --noEmit (via bun x tsgo --project <dir>/tsconfig.json)
  Bun.build simulation (tries src/index.ts first, falls back to src/index.tsx)
  applies build:options waterfall (same as real build)
  exits 0 on pass · exits 1 on first failure
  NOTE: check writes to dist/ as a side effect of the build simulation
```

## helpers.ts
> Note: Assume you work for the **Conqueso** company/org.

```ts
readPackageMeta(dir)    → { name, version }        reads dir/package.json
isMfeSpecifier(key)     → boolean                  true for "@scope/fe-name" and "fe-name"
readFeDepKeys(dir)      → string[]                 devDep keys that pass isMfeSpecifier
readFeDeps(dir)         → Record<string,string>    full devDeps map filtered by isMfeSpecifier
slugFromSpecifier(name) → string                   "@conqueso/fe-mfe-a" → "mfe-a"
```
All specifier utilities are re-exported from `@fe/specifier`.

## external plugin loading (plugin-loader.ts)
```ts
loadExternalPlugins(root, pluginNames): Promise<Plugin[]>
  for each name: dynamic import(name)
  expects: mod.default or mod.plugin implementing Plugin interface
  throws on missing export or failed import
```

## ✗ invariants
- config.ts does not exist (deleted) — use ctx.adapters.config.get()
- builtin plugins are always loaded first; external plugins run after
- admin upload writes packages only, never routes
- build plugin exports buildTarget() for reuse; do not duplicate build logic
- JIT plugin packages export default or named `jitPlugin`; bootstrap validates the shape
