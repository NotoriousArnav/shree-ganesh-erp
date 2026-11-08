#!/usr/bin/env python3
"""Rewrites docs Markdown for Hugo (Hugo Book) consumption.

- Internal links pointing at another Markdown file become Hugo `relref`
  shortcodes so Hugo resolves them to real page URLs.
- Image references starting with ../assets/ are rebased to the correct
  relative depth for the page being rendered.

Usage: rewrite_docs.py <content_dir>
"""

import re
import sys
from pathlib import Path

LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


def rebase(target: str, ups: int) -> str:
    prefix = "../" * ups
    if target.startswith("../assets/"):
        return prefix + "assets/" + target[len("../assets/") :]
    return target


def main() -> None:
    content_root = Path(sys.argv[1])
    for path in sorted(content_root.rglob("*.md")):
        rel = path.relative_to(content_root).as_posix()
        parent_parts = len(path.parent.relative_to(content_root).parts)
        ups = (
            parent_parts
            if path.name == "_index.md"
            else parent_parts + 1
        )
        text = path.read_text(encoding="utf-8")

        def image_sub(m: re.Match) -> str:
            alt, target = m.group(1), m.group(2)
            return f"![{alt}]({rebase(target, ups)})"

        text = IMAGE_RE.sub(image_sub, text)

        def link_sub(m: re.Match) -> str:
            label, target = m.group(1), m.group(2)
            if target.endswith(".md") and not target.startswith("http") and not target.startswith("#"):
                return f'[{label}]({{< relref "{target}" >}})'
            return m.group(0)

        text = LINK_RE.sub(link_sub, text)
        path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
