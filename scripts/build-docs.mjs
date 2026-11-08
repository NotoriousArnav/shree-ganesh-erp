#!/usr/bin/env node
/**
 * Hugo docs maker for the Shree Ganesh ERP monorepo.
 *
 * Scans for every app that has a docs/ folder (mushak/docs, lokkhi/docs, …),
 * builds a Hugo Book site per app into public/<app>/docs, and writes a small
 * root index that links to each built docs site.
 *
 * Run with: npm run docs:hugo   (or: node scripts/build-docs.mjs)
 * Override the Hugo binary with HUGO=/path/to/hugo
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public");
const HUGO = process.env.HUGO || "hugo";
const THEME_REPO = "https://github.com/alex-shpak/hugo-book";

const SKIPPED_TOP = new Set([
  "node_modules",
  "public",
  "site",
  ".git",
  "dist",
]);

function findApps(root) {
  const apps = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (SKIPPED_TOP.has(entry.name)) continue;
    const docsDir = path.join(root, entry.name, "docs");
    let stat;
    try {
      stat = fs.statSync(docsDir);
    } catch {
      continue;
    }
    if (stat.isDirectory()) apps.push(entry.name);
  }
  return apps.sort();
}

function rebase(target, ups) {
  const prefix = "../".repeat(ups);
  if (target.startsWith("../assets/")) {
    return `${prefix}assets/${target.slice("../assets/".length)}`;
  }
  return target;
}

function rewriteDocs(contentDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) files.push(full);
    }
  };
  walk(contentDir);

  for (const file of files.sort()) {
    const text = fs.readFileSync(file, "utf8");
    const parentParts = path
      .relative(contentDir, path.dirname(file))
      .split(path.sep)
      .filter((p) => p.length > 0);
    const ups =
      path.basename(file) === "_index.md" ? parentParts.length : parentParts.length + 1;

    const rewritten = text.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_m, alt, target) => `![${alt}](${rebase(target, ups)})`,
    );

    const relinked = rewritten.replace(
      /\[([^\]]*)\]\(([^)]+)\)/g,
      (m, label, target) => {
        if (
          target.endsWith(".md") &&
          !target.startsWith("http") &&
          !target.startsWith("#")
        ) {
          return `[${label}]({{< relref "${target}" >}})`;
        }
        return m;
      },
    );

    fs.writeFileSync(file, relinked, "utf8");
  }
}

function buildApp(app) {
  const src = path.join(ROOT, app, "docs");
  const dest = path.join(ROOT, "site", "apps", app);
  const content = path.join(dest, "content");
  const staticDir = path.join(dest, "static");

  fs.rmSync(content, { recursive: true, force: true });
  fs.rmSync(staticDir, { recursive: true, force: true });
  fs.mkdirSync(content, { recursive: true });
  fs.mkdirSync(staticDir, { recursive: true });
  fs.cpSync(src, content, { recursive: true });
  if (fs.existsSync(path.join(content, "README.md"))) {
    fs.renameSync(path.join(content, "README.md"), path.join(content, "_index.md"));
  }
  const srcAssets = path.join(src, "assets");
  if (fs.existsSync(srcAssets)) {
    fs.cpSync(srcAssets, path.join(staticDir, "assets"), { recursive: true });
  }
  if (!fs.existsSync(path.join(dest, "themes", "hugo-book"))) {
    fs.mkdirSync(path.join(dest, "themes"), { recursive: true });
    execFileSync(
      "git",
      ["clone", "--depth", "1", THEME_REPO, path.join(dest, "themes", "hugo-book")],
      { stdio: "inherit" },
    );
  }

  rewriteDocs(content);

  const baseURL = `https://notoriousarnav.github.io/shree-ganesh-erp/${app}/docs/`;
  execFileSync(
    HUGO,
    [
      "--source",
      dest,
      "--baseURL",
      baseURL,
      "--destination",
      path.join(OUT, app, "docs"),
      "--cleanDestinationDir",
    ],
    { stdio: "inherit" },
  );
  return { app, baseURL };
}

function writeRootIndex(apps) {
  const lines = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "  <title>Shree Ganesh ERP - Documentation</title>",
    "</head>",
    "<body>",
    "  <h1>Shree Ganesh ERP - Documentation</h1>",
    "  <p>Documentation per application.</p>",
    "  <ul>",
  ];
  for (const app of apps) {
    lines.push(`    <li><a href="/shree-ganesh-erp/${app}/docs/">${app} docs</a></li>`);
  }
  lines.push("  </ul>", "</body>", "</html>", "");
  fs.writeFileSync(path.join(OUT, "index.html"), lines.join("\n"), "utf8");
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const apps = findApps(ROOT);
  if (apps.length === 0) {
    console.error("build-docs.mjs: no docs folders found");
    process.exit(1);
  }

  for (const app of apps) {
    const { baseURL } = buildApp(app);
    console.log(`build-docs.mjs: built ${app} docs -> ${path.join(OUT, app, "docs")} (baseURL ${baseURL})`);
  }

  writeRootIndex(apps);
  console.log(`build-docs.mjs: built ${apps.length} docs site(s) into ${OUT}`);
}

main();
