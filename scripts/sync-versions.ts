import { readFileSync, writeFileSync } from "fs";
import { globSync } from "glob";
import { join } from "path";

const rootPkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = rootPkg.version;

console.log(`Syncing version ${version} to all packages...`);

const packages = globSync("packages/*/package.json");

for (const pkgPath of packages) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.version !== version) {
    console.log(`- Updating ${pkg.name} to ${version}`);
    pkg.version = version;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
}
