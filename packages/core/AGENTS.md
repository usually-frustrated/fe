# ⚯ packages/core/ · agent-ref
↑ /AGENTS.md for repo-wide context

## purpose
`@fe/core` v0.2.3 — shared types and interfaces consumed by `@fe/cli` and external plugins.
Published. No runtime logic; pure TypeScript types + the `Hooks` class.

## src/ file map
```
src/
  fe-config.ts    FeConfig interface (CLI config schema)
  adapters.ts     ConfigProvider · SourceStorage · ArtifactStorage · ManifestManager · Builder
  context.ts      CliContext · CommandDef
  plugin.ts       Plugin interface
  jit-plugin.ts   JitPlugin interface
  hooks.ts        Hooks class · HookMap type
  types.ts        PlatformConfig · PackageVersion · PackageEntry · ImportMap · BuildOptions · BuildResult
  index.ts        re-exports everything above
```

## FeConfig (fe-config.ts)
CLI config sourced via `ConfigProvider`. Default impl reads `configs/fe.config.json`.
```ts
interface FeConfig {
  plugins?:      string[];   // npm packages to load as CLI plugins
  jitPlugins?:   string[];   // npm packages to load as JIT compiler plugins
  manifestPath?: string;     // default: "configs/platform.json"
  uploadsDir?:   string;     // default: "uploads"
  sourcesDir?:   string;     // default: "sources"
  shellDir?:     string;     // default: "shell"
}
```

## Adapter interfaces (adapters.ts)

### ConfigProvider
```ts
interface ConfigProvider {
  get(): Promise<Required<FeConfig>>;
}
```
Supplies CLI config (FeConfig with all fields filled). Stored at `ctx.adapters.config`.
Default impl: `@fe/cli` `createJsonConfigProvider(root)` reads `configs/fe.config.json`.
Plugins may swap this to pull config from env vars, remote APIs, etc.

### SourceStorage / ArtifactStorage
```ts
interface SourceStorage {
  upload(slug: string, version: string, srcDir: string): Promise<string>;
  fetchFile(slug: string, version: string, relativePath: string): Promise<string | null>;
  listFiles(slug: string, version: string): Promise<string[]>;
}
interface ArtifactStorage {
  upload(slug: string, version: string, distDir: string): Promise<string>;
  exists(slug: string, version: string): Promise<boolean>;
}
```
Default impls: `createLocalSourceStorage` (`sources/`) and `createLocalArtifactStorage` (`uploads/`).

### ManifestManager
```ts
interface ManifestManager {
  read(): Promise<PlatformConfig>;
  write(config: PlatformConfig): Promise<void>;
  registerPackage(specifier: string, version: string, entry: PackageVersion): Promise<void>;
}
```
Default impl: `createJsonManifestManager(root, manifestPath)` — reads/writes `configs/platform.json`.

### Builder
```ts
interface Builder {
  build(options: BuildOptions): Promise<BuildResult>;
}
```
Default impl: `createBunBuilder()` — thin wrapper over `Bun.build()`.

## CliContext (context.ts)
```ts
interface CliContext {
  root: string;  // absolute path to workspace root (where fe is invoked)
  adapters: {
    config:          ConfigProvider;    // CLI config; swappable by plugins
    sourceStorage:   SourceStorage;     // JIT source uploads/fetch
    artifactStorage: ArtifactStorage;   // upload/exist checks; swappable
    manifest:        ManifestManager;   // platform.json I/O; swappable
    builder:         Builder;           // Bun.build wrapper; swappable
  };
  commands:   Map<string, CommandDef>;  // populated by plugin setup()
  jitPlugins: JitPlugin[];             // populated from FeConfig.jitPlugins at bootstrap
}

interface CommandDef {
  name: string;
  description: string;
  usage: string;
  run(args: string[]): Promise<void>;
}
```

## Plugin (plugin.ts)
```ts
interface Plugin {
  name: string;
  setup(ctx: CliContext, hooks: Hooks): void | Promise<void>;
}
```
`setup` is called once at bootstrap. Plugins register commands and/or swap adapters.

## JitPlugin (jit-plugin.ts)
```ts
interface JitPlugin {
  transform(options: BuildOptions): BuildOptions;
}
```
JIT plugins intercept the Bun build pipeline. `transform` receives the current `BuildOptions`
and returns a (possibly modified) copy. Typical use: append Bun plugins to `options.plugins`.

Each JIT plugin package exports a default `JitPlugin` (or named `jitPlugin`):
```ts
export default { transform(options) { return { ...options, plugins: [...] }; } } satisfies JitPlugin;
```
Bootstrap loads them from `FeConfig.jitPlugins` and applies their transforms via the
`build:options` waterfall hook before every build and JIT bundle request.

When `BuildOptions.plugins` is set (by any JIT plugin), `@fe/compiler` uses it directly and
skips Solid.js auto-detection. When it is `undefined`, auto-detection runs as a fallback.

Published: `@fe/jit-plugin-solid`.

## Hooks (hooks.ts)
```ts
class Hooks {
  hook(event: keyof HookMap, handler: ...): void
  callHook(event, ...args): Promise<void>
  waterfall<T>(event, value: T): Promise<T>  // each handler transforms the value
}
```
Key hook events used by builtin plugins:
```
build:before(target, options)     build:after(target, result)
build:options(options) → options  (waterfall)
build:shell:before()              build:shell:after()
dev:start(target, port)           dev:rebuild(target)      dev:reload()
serve:start(port)                 serve:request(req)
publish:before(target, meta)      publish:after(target, url, deps)
publish:register:before(name, ver, entry) publish:register:after()
link:before(consumer, dep)        link:after(consumer, depName)
```

## PlatformConfig / PackageVersion (types.ts)
```ts
interface PlatformConfig {
  routes:   Record<string, string>;                      // path → "specifier@version"
  packages: Record<string, { versions: Record<string, PackageVersion> }>;
  devtools?: string;                                     // "specifier@version" | undefined
  preload?: string[];                                    // specifier@version strings to preload on init
}
interface PackageVersion {
  url:  string;                  // runtime-reachable artifact URL
  deps: Record<string, string>;  // MFE dep specifier → semver range
}
```

## invariants
- core exports types only; no runtime I/O, no file system access
- adding a new adapter interface here requires: default impl in @fe/cli + add to CliContext.adapters
- Hooks event names are stringly-typed; grep for `callHook`/`hook` to find all sites
- JitPlugin packages export default or named `jitPlugin`; bootstrap validates the shape
