# ⚯ packages/jit-plugin-solid/ · agent-ref
↑ /AGENTS.md for repo-wide context
↑ packages/core/AGENTS.md for JitPlugin interface

## purpose
`@fe/jit-plugin-solid` v0.2.3 — JIT plugin for Solid.js MFEs.
Published. Add to `FeConfig.jitPlugins` in `fe.config.json` to enable Solid.js JSX compilation.

## what it does
Appends `SolidPlugin()` from `bun-plugin-solid` to `BuildOptions.plugins`.
This injects the Babel-based Solid.js JSX transform into the Bun build pipeline,
required because Bun's native JSX handling does not produce correct Solid.js output.

## src/index.ts
```ts
import { SolidPlugin } from "bun-plugin-solid";

const jitPlugin: JitPlugin = {
  transform(options: BuildOptions): BuildOptions {
    return {
      ...options,
      plugins: [...(options.plugins ?? []), SolidPlugin()],
    };
  },
};
export default jitPlugin;
export { jitPlugin };
```

## usage
```json
// configs/fe.config.json
{ "jitPlugins": ["@fe/jit-plugin-solid"] }
```

Also used as a `devDependency` in packages that want the Solid.js JSX transform applied
via the `build:options` waterfall hook during `fe build` (e.g. `toolkit/devtools`).

## dependencies
- `bun-plugin-solid` — wraps Babel + `babel-preset-solid` for correct Solid.js output
- `solid-js` — peer dep required by `bun-plugin-solid`

## invariants
- exports default and named `jitPlugin` (bootstrap validates either)
- SolidPlugin() is appended; any prior plugins in options.plugins are preserved
- this plugin suppresses @fe/compiler's auto-detection fallback (options.plugins is now set)
