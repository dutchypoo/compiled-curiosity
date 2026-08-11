#!/usr/bin/env bash
# Scaffold a new content entry with the correct frontmatter.
# Usage:  npm run new <disclosure|writeup|note> "Title here"
# (or directly:  bash scripts/new-post.sh disclosure "Title here")
set -euo pipefail

TYPE="${1:-}"
shift || true
TITLE="${*:-}"

if [ -z "$TYPE" ] || [ -z "$TITLE" ]; then
  echo "usage: npm run new <disclosure|writeup|note> \"Title here\""
  exit 1
fi

today="$(date +%F)"
# slug: lowercase, non-alphanumerics -> single dash, trim leading/trailing dashes
slug="$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"

case "$TYPE" in
  disclosure)
    file="content/disclosures/$slug.md"
    [ -e "$file" ] && { echo "refusing to overwrite existing $file"; exit 1; }
    cat > "$file" <<EOF
---
title: "$TITLE"
target: "org/repo"
target_url: "https://github.com/org/repo"
bug_class: "e.g. Out-of-bounds read (CWE-125)"
severity: "e.g. Low / DoS"
cvss: ""
discovery_method: "e.g. libFuzzer + ASan/UBSan"
disclosed: $today
status: "open"            # open | fixed | published
advisory_url: "https://github.com/org/repo/issues/1"
cve: ""
credit: ""
summary: "One or two sentences shown on the card."
tags: []
featured: false
draft: true               # set to false when ready to publish
---

## Summary

## Vulnerable code

## Reproduction

## Impact

## Suggested fix

## Timeline
EOF
    ;;
  writeup)
    file="content/writeups/$slug.md"
    [ -e "$file" ] && { echo "refusing to overwrite existing $file"; exit 1; }
    cat > "$file" <<EOF
---
title: "$TITLE"
platform: "TryHackMe"
room_url: "https://tryhackme.com/room/example"
difficulty: "Easy"
date: $today
summary: "One or two sentences shown on the card."
tags: []
tools_used: []
draft: true
---

## Recon

## Foothold

## Privilege escalation

## Notes
EOF
    ;;
  note)
    file="content/notes/$slug.md"
    [ -e "$file" ] && { echo "refusing to overwrite existing $file"; exit 1; }
    cat > "$file" <<EOF
---
title: "$TITLE"
date: $today
summary: ""
tags: []
draft: true
---

Write the note here.
EOF
    ;;
  *)
    echo "unknown type: $TYPE  (use disclosure|writeup|note)"
    exit 1
    ;;
esac

echo "created $file"
echo "next: edit it, set  draft: false  when ready, then:"
echo "  git add $file && git commit -m \"add: $TITLE\" && git push"
