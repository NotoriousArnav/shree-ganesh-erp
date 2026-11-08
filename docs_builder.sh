#!/usr/bin/env bash
# Builds the documentation sites for every app that has a docs/ folder.
#
# For each detected app (e.g. mushak/docs, lokkhi/docs) this script copies the
# Markdown into a per-app Hugo source tree, rewrites internal links and image
# paths, clones the Hugo Book theme, runs Hugo, and writes the static site to
# public/<app>/docs.
#
# The GitHub Pages workflow runs this script on every push and publishes the
# combined public/ directory, so each app gets a /<app-name>/docs page.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE="$ROOT/site"
OUT="$ROOT/public"
HUGO_BIN="${HUGO:-hugo}"
THEME_REPO="https://github.com/alex-shpak/hugo-book"

rm -rf "$OUT"
mkdir -p "$OUT"

APPS=()
while IFS= read -r dir; do
  app="$(basename "$(dirname "$dir")")"
  APPS+=("$app")
done < <(find "$ROOT" -maxdepth 2 -type d -name docs \
  -not -path '*/node_modules*' -not -path '*/public*' -not -path '*/site*' -not -path '*/.git*' \
  | sort)

if [ ${#APPS[@]} -eq 0 ]; then
  echo "docs_builder.sh: no docs folders found" >&2
  exit 1
fi

for app in "${APPS[@]}"; do
  src="$ROOT/$app/docs"
  dest="$SITE/apps/$app"
  content="$dest/content"
  static="$dest/static"

  mkdir -p "$content" "$static/assets/screenshots"
  rm -rf "$content" "$static"
  mkdir -p "$content" "$static/assets/screenshots"
  cp -R "$src"/. "$content/"
  if [ -f "$content/README.md" ]; then
    mv "$content/README.md" "$content/_index.md"
  fi
  if [ -d "$src/assets" ]; then
    cp -R "$src/assets"/. "$static/assets/"
  fi

  if [ ! -d "$dest/themes/hugo-book" ]; then
    mkdir -p "$dest/themes"
    git clone --depth 1 "$THEME_REPO" "$dest/themes/hugo-book" >/dev/null 2>&1
  fi

  python3 "$SITE/scripts/rewrite_docs.py" "$content"

  "$HUGO_BIN" \
    --source "$dest" \
    --baseURL "https://notoriousarnav.github.io/shree-ganesh-erp/$app/docs/" \
    --destination "$OUT/$app/docs" \
    --cleanDestinationDir

  echo "docs_builder.sh: built $app docs -> $OUT/$app"
done

cat > "$OUT/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shree Ganesh ERP - Documentation</title>
</head>
<body>
  <h1>Shree Ganesh ERP - Documentation</h1>
  <p>Documentation per application.</p>
  <ul>
HTML
  for app in "${APPS[@]}"; do
    cat >> "$OUT/index.html" <<HTML
    <li><a href="/shree-ganesh-erp/$app/docs/">$app docs</a></li>
HTML
  done
cat >> "$OUT/index.html" <<'HTML'
  </ul>
</body>
</html>
HTML

echo "docs_builder.sh: built ${#APPS[@]} docs site(s) into $OUT"
