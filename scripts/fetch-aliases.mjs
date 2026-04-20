#!/usr/bin/env node
/**
 * Fetches the aliases dump from https://github.com/adactio/TheSession-data
 * and writes it to public/data/aliases.json.
 *
 * Run this occasionally (say, monthly) to refresh the bundled dump used for
 * offline/fast-path matching.
 *
 * Usage: npm run fetch-aliases
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "data", "aliases.json");

// The raw aliases.json from the data repo. This URL tracks `main`, which updates ~weekly.
const SOURCE_URL =
  "https://raw.githubusercontent.com/adactio/TheSession-data/main/json/aliases.json";

async function main() {
  console.log(`Fetching aliases from ${SOURCE_URL}…`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error("Unexpected response shape — expected an array.");
    process.exit(1);
  }

  // The dump contains {tune_id, alias, name} — write only what we need to keep size down.
  const slim = data.map((row) => ({
    tune_id: Number(row.tune_id),
    alias: row.alias,
    name: row.name
  }));

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(slim));

  const sizeKb = Math.round((await fs.stat(OUT_PATH)).size / 1024);
  console.log(`Wrote ${slim.length.toLocaleString()} aliases to ${OUT_PATH} (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
