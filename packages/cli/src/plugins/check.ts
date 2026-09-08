import { join } from "path";
import type { Plugin, CliContext, BuildOptions, Hooks } from "@fe/core";
import { readPackageMeta, readFeDepKeys } from "../helpers";

async function runCheck(ctx: CliContext, hooks: Hooks, args: string[]): Promise<void> {
  const target = args[0];
  if (!target) {
    console.error("Usage: check <target>");
    process.exit(1);
  }

  console.log(`Checking ${target}...`);
  const feConfig = await ctx.adapters.config.get();

  let dir: string;
  if (target === "shell") {
    dir = join(ctx.root, feConfig.shellDir);
  } else if (target) {
    dir = join(ctx.root, target);
  } else {
    console.error("Usage: check <target>");
    process.exit(1);
  }

  try {
    readPackageMeta(dir);
  } catch (e) {
    console.error(`Check failed: Invalid package metadata in ${dir}. Target should be a path relative to the monorepo root (e.g., sandbox/mfe-a).`);
    process.exit(1);
  }

  console.log(`- Running Typecheck`);
  const proc = Bun.spawn(["bun", "x", "tsgo", "--noEmit", "--project", join(dir, "tsconfig.json")], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error(`Check failed for ${target} (TypeScript errors)`);
    process.exit(1);
  }

  console.log(`- Simulating Build`);
  const externals = readFeDepKeys(dir);

  let entrypoint = join(dir, "src", "index.ts");
  if (!(await Bun.file(entrypoint).exists())) {
    entrypoint = join(dir, "src", "index.tsx");
  }

  let options: BuildOptions = {
    entrypoints: [entrypoint],
    outdir: join(dir, "dist"),
    format: "esm",
    target: "browser",
    external: externals,
  };

  if (target === "shell") {
    options.naming = "app.js";
  }

  options = await hooks.waterfall("build:options", options);

  const result = await ctx.adapters.builder.build(options);
  if (!result.success) {
    console.error(`Check failed for ${target} (Build errors)`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  console.log(`Check passed for ${target} ✅`);
}

function setupCheck(ctx: CliContext, hooks: Hooks): void {
  ctx.commands.set("check", {
    name: "check",
    description: "Verify configuration and buildability of an MFE or the shell",
    usage: "check <target|shell>",
    run: (args) => runCheck(ctx, hooks, args),
  });
}

export const checkPlugin: Plugin = {
  name: "check",
  setup: setupCheck,
};
