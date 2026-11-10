#!/usr/bin/env node
/**
 * Hugo docs maker for the Shree Ganesh ERP monorepo.
 *
 * Scans for every app that has a docs/ folder (mushak/docs, lokkhi/docs, …),
 * builds a Hugo Book site per app into dist/docs/<app>/, and writes a small
 * root index at dist/docs/index.html that links to each built docs site.
 *
 * Run with: npm run docs:all            (all apps)
 *          npm run docs:mushak          (single app, e.g. docs:lokkhi later)
 *          node scripts/build-docs.mjs [app]
 * Override the Hugo binary with HUGO=/path/to/hugo
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "dist", "docs");
const HUGO = process.env.HUGO || "hugo";
const THEME_REPO = "https://github.com/alex-shpak/hugo-book";

const SKIPPED_TOP = new Set([
  "node_modules",
  "public",
  "site",
  "dist",
  "packages",
  ".git",
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

/**
 * The site root that the built docs are served from. Each app is published at
 * `<prefix>/<app>/`.
 *
 * - Local builds leave this unset so Hugo emits relative URLs and the output
 *   can be opened straight from disk (`file://`) or any static host.
 * - CI sets DOCS_BASE_PREFIX from actions/configure-pages (`base_url`), which
 *   already includes the repo path or custom domain. Do not hard-code it here:
 *   that is what previously produced `/docs/mushak/...` asset URLs while the
 *   artifact was served from `/mushak/...`, so every stylesheet 404'd.
 * - If a CI run forgets the variable, fall back to the GitHub project-pages
 *   URL derived from GITHUB_REPOSITORY.
 */
function resolveDeployPrefix() {
  const configured = process.env.DOCS_BASE_PREFIX;
  if (configured && configured.trim().length > 0) return configured.trim();

  if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    if (!owner || !repo) return null;
    if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
      return `https://${repo}/`;
    }
    return `https://${owner}.github.io/${repo}/`;
  }

  return null;
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
          target.startsWith("http") ||
          target.startsWith("#") ||
          target.startsWith("mailto:")
        ) {
          return m;
        }

        // Split `page.md#section` so the fragment survives the relref call.
        const hashIndex = target.indexOf("#");
        let pathPart =
          hashIndex === -1 ? target : target.slice(0, hashIndex);
        const fragment = hashIndex === -1 ? "" : target.slice(hashIndex);
        if (!pathPart.endsWith(".md")) return m;

        // README files were renamed to _index.md, so point at the section page.
        if (/(^|\/)README\.md$/.test(pathPart)) {
          pathPart = pathPart.replace(/README\.md$/, "_index.md");
        }

        return `[${label}]({{< relref "${pathPart}" >}}${fragment})`;
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
  const deployPrefix = resolveDeployPrefix();
  const baseURL = deployPrefix
    ? `${deployPrefix.replace(/\/?$/, "/")}${app}/`
    : "/";
  const relativeURLs = deployPrefix === null;

  fs.rmSync(content, { recursive: true, force: true });
  fs.rmSync(staticDir, { recursive: true, force: true });
  fs.mkdirSync(content, { recursive: true });
  fs.mkdirSync(staticDir, { recursive: true });
  fs.cpSync(src, content, { recursive: true });

  // Hugo treats README.md as an ordinary page (`/api/readme/`), but a folder's
  // README is meant to be its landing page. Renaming every README to _index.md
  // gives `/api/` instead of `/api/readme/` and keeps sibling relative links
  // (for example `openapi.json`) pointing at the right directory.
  const renameReadmes = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) renameReadmes(full);
      else if (entry.name === "README.md") {
        fs.renameSync(full, path.join(dir, "_index.md"));
      }
    }
  };
  renameReadmes(content);
  // Publish every non-Markdown file (images, checked-in openapi.json, …)
  // under its original path. Hugo only renders Markdown, so anything else in
  // the docs tree would otherwise 404 when a page links to it.
  const copyStatic = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        copyStatic(full);
        continue;
      }
      if (entry.name.endsWith(".md")) continue;
      const target = path.join(staticDir, path.relative(src, full));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(full, target);
    }
  };
  copyStatic(src);

  const title = app.charAt(0).toUpperCase() + app.slice(1);
  fs.writeFileSync(
    path.join(dest, "hugo.toml"),
    `baseURL = "${baseURL}"
title = "${title}"
theme = "hugo-book"
defaultContentLanguage = "en"
disableKinds = ["taxonomy", "term"]
relativeURLs = ${relativeURLs}
canonifyURLs = false

[params]
  bookSection = "*"
  bookShowReadingTime = false
  bookHideSearch = false

[markup]
  [markup.goldmark]
    [markup.goldmark.renderer]
      unsafe = true
`,
    "utf8",
  );

  if (!fs.existsSync(path.join(dest, "themes", "hugo-book"))) {
    fs.mkdirSync(path.join(dest, "themes"), { recursive: true });
    execFileSync(
      "git",
      ["clone", "--depth", "1", THEME_REPO, path.join(dest, "themes", "hugo-book")],
      { stdio: "inherit" },
    );
  }

  rewriteDocs(content);

  execFileSync(
    HUGO,
    [
      "--source",
      dest,
      "--baseURL",
      baseURL,
      "--destination",
      path.join(OUT, app),
      "--cleanDestinationDir",
    ],
    { stdio: "inherit" },
  );

  verifyBuiltAssets(app, baseURL);
  return { app, baseURL };
}

/**
 * Fails the build when a page points at a local file that Hugo did not emit.
 * This is the guard against a baseURL that does not match the path the site is
 * actually served from (the bug that silently removed the stylesheet).
 */
function verifyBuiltAssets(app, baseURL) {
  const dir = path.join(OUT, app);
  const origin = baseURL === "/" ? null : new URL(baseURL).origin;
  const basePath = baseURL === "/" ? "/" : new URL(baseURL).pathname;

  const pages = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) pages.push(full);
    }
  };
  walk(dir);

  const missing = [];
  const seen = new Set();

  for (const page of pages) {
    const pageRel = `/${path.relative(dir, page).split(path.sep).join("/")}`;
    const text = fs.readFileSync(page, "utf8");

    for (const match of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = match[1];
      if (
        !raw ||
        raw.startsWith("#") ||
        raw.startsWith("data:") ||
        raw.startsWith("mailto:") ||
        raw.startsWith("tel:") ||
        raw.startsWith("javascript:") ||
        raw.startsWith("//")
      ) {
        continue;
      }

      let target;
      if (/^https?:\/\//i.test(raw)) {
        // Absolute links are only ours when they sit under this app's base.
        if (!origin || !raw.startsWith(origin)) continue;
        target = raw.slice(origin.length);
        if (target.startsWith(basePath)) {
          target = `/${target.slice(basePath.length)}`;
        } else if (target === basePath.replace(/\/$/, "")) {
          target = "/";
        } else {
          continue;
        }
      } else if (raw.startsWith("/")) {
        // Hugo emits root-relative links that already include the Pages base
        // path (for example `/repo/app/favicon.svg`); strip it before resolving
        // against the app's output directory.
        if (basePath !== "/") {
          if (raw.startsWith(basePath)) {
            target = `/${raw.slice(basePath.length)}`;
          } else {
            continue;
          }
        } else {
          target = raw;
        }
      } else {
        target = path.posix.normalize(
          path.posix.join(path.posix.dirname(pageRel), raw),
        );
      }

      target = target.split("#")[0].split("?")[0];
      if (!target || target === "/") continue;

      const key = `${pageRel}::${target}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let decoded = target;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        // Keep the raw path; existsSync will simply report it missing.
      }
      const candidate = path.join(dir, decoded.replace(/^\//, ""));
      const exists =
        fs.existsSync(candidate) &&
        (fs.statSync(candidate).isFile() ||
          fs.existsSync(path.join(candidate, "index.html")));

      if (!exists) missing.push(`${path.relative(ROOT, page)} -> ${raw}`);
    }
  }

  if (missing.length > 0) {
    const preview = missing.slice(0, 20).join("\n  ");
    throw new Error(
      `build-docs.mjs: ${app} references ${missing.length} missing local asset(s):\n  ${preview}`,
    );
  }
}

function getAppDescription(app) {
  const candidates = [
    path.join(ROOT, app, "README.md"),
    path.join(ROOT, app, "docs", "README.md"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(
        (p) =>
          p.length > 0 &&
          !p.startsWith("#") &&
          !p.startsWith("---") &&
          !p.startsWith("[") &&
          !p.startsWith("!") &&
          !p.startsWith("<") &&
          !p.startsWith("```") &&
          !/^[-*|>]/.test(p) &&
          !/^[0-9]+\./.test(p),
      );
    const first = paragraphs[0];
    if (first) {
      const clean = first
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`>#]/g, "")
        .trim();
      return clean.length > 180 ? clean.slice(0, 177).trimEnd() + "…" : clean;
    }
  }
  return `Documentation for the ${app} application.`;
}

function writeRootIndex(appData) {
  const cards = appData
    .map(
      ({ name, description, url }) => `
      <a href="${url}" class="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold capitalize text-slate-900">${name}</h2>
        <p class="mt-2 flex-1 text-sm leading-relaxed text-slate-600">${description}</p>
        <span class="mt-6 inline-flex items-center text-sm font-medium text-blue-600 transition group-hover:text-blue-700">
          Open documentation
          <svg xmlns="http://www.w3.org/2000/svg" class="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </a>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shree Ganesh ERP — Documentation</title>
  <meta name="description" content="Documentation hub for the Shree Ganesh ERP applications.">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body{font-family:'Inter',system-ui,sans-serif}</style>
</head>
<body class="min-h-screen bg-slate-50 text-slate-900 antialiased">
  <header class="border-b border-slate-200 bg-white">
    <div class="mx-auto max-w-5xl px-6 py-14">
      <div class="flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <span class="text-sm font-semibold uppercase tracking-widest text-slate-500">Shree Ganesh ERP</span>
      </div>
      <h1 class="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Documentation</h1>
      <p class="mt-4 max-w-2xl text-lg text-slate-600">
        Guides, API references, and operations manuals for every application in the suite.
      </p>
    </div>
  </header>

  <main class="mx-auto max-w-5xl px-6 py-12">
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
${cards}
    </div>
  </main>

  <footer class="mx-auto max-w-5xl border-t border-slate-200 px-6 py-10 text-sm text-slate-500">
    <p>© ${new Date().getFullYear()} Shree Ganesh Merchant Assistive Software. Documentation for ${appData.length} application${appData.length === 1 ? "" : "s"}.</p>
  </footer>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html, "utf8");
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const requested = process.argv[2] || null;
  const allApps = findApps(ROOT);
  const apps = requested === "all" ? allApps : allApps.filter((app) => app === requested);

  if (apps.length === 0) {
    console.error("build-docs.mjs: no docs folders found or app not found");
    process.exit(1);
  }

  for (const app of apps) {
    const { baseURL } = buildApp(app);
    console.log(`build-docs.mjs: built ${app} docs -> ${path.join(OUT, app)} (baseURL ${baseURL})`);
  }

  writeRootIndex(
    apps.map((app) => ({
      name: app,
      description: getAppDescription(app),
      url: `./${app}/`,
    })),
  );
  console.log(`build-docs.mjs: built ${apps.length} docs site(s) into ${OUT}`);
}

main();
