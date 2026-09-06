import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(standalone)) throw new Error(".next/standalone was not created by Next.js");
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
