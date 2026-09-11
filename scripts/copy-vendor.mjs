import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/lucide/dist/umd/lucide.min.js");
const destination = resolve(root, "www/vendor/lucide.min.js");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Copied Lucide to ${destination}`);
