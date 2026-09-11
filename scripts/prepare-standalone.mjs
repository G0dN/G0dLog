import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(standalone)) throw new Error(".next/standalone was not created by Next.js");
// Next's file tracing can omit versioned libvips shared libraries. Preserve the
// installed native packages at their original paths, including pnpm's layout.
const requireSharp = createRequire(createRequire(import.meta.url).resolve("sharp"));
const sharpPackage = requireSharp("../package.json");
for (const name of Object.keys(sharpPackage.optionalDependencies ?? {})) {
  if (!name.startsWith("@img/sharp-")) continue;
  let manifest;
  try {
    manifest = requireSharp.resolve(`${name}/package`);
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") continue; // Other platforms are not installed.
    throw error;
  }
  const source = fs.realpathSync(path.dirname(manifest));
  const relative = path.relative(root, source);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Native package outside project: ${name}`);
  fs.cpSync(source, path.join(standalone, relative), { recursive: true, force: true });
}
for (const directory of ["drizzle", "scripts"]) {
  const source = path.join(root, directory);
  const destination = path.join(standalone, directory);
  fs.cpSync(source, destination, { recursive: true, force: true });
}
for (const directory of [".next/static", "public"]) {
  const source = path.join(root, directory);
  if (!fs.existsSync(source)) continue;
  const destination = path.join(standalone, directory);
  fs.cpSync(source, destination, { recursive: true, force: true });
}
console.log("Prepared standalone static assets, migrations and operational scripts.");
