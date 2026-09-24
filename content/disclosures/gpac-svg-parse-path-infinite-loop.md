---
title: "Infinite loop in svg_parse_path() from a 26-byte SVG"
target: "gpac/gpac"
target_url: "https://github.com/gpac/gpac"
bug_class: "Infinite loop / uncontrolled resource consumption (CWE-835)"
severity: "Medium / DoS"
discovery_method: "libFuzzer + ASan, extension-gated filter harness"
disclosed: 2026-08-17
status: "fixed"
advisory_url: "https://github.com/gpac/gpac/issues/3856"
cwe: ["CWE-835"]
fix_commit: "f76689d5"
fix_commit_url: "https://github.com/gpac/gpac/commit/f76689d5edde0ebc1f0d547e9b093f9c83670503"
credit: "Patch merged verbatim by the maintainer, comment included"
summary: "Twenty-six bytes of SVG hang GPAC forever. Fixed by the maintainer the next day using the suggested patch verbatim, comment and all."
tags: ["C", "SVG", "fuzzing", "infinite-loop"]
featured: false
---

## Summary

```
<svg><path d="z1"/></svg>
```

Twenty-six bytes. GPAC's SVG path parser never returns.

## The coverage gap that produced it

GPAC filters that declare a `FILE_EXT` capability with no `probe_data` callback can only
be selected by file extension. All four upstream OSS-Fuzz harnesses write their input to
`/tmp/libfuzzer.<pid>`, with no extension and no MIME type. So every extension-gated
filter in GPAC is unreachable by the entire Google fuzzing fleet, permanently, by
construction.

The SVG loader is one of those filters. Building a harness that hands the parser a file
with the right extension took it out of that blind spot, and the first bug showed up
almost immediately.

## Outcome

The maintainer merged the suggested patch the following day, verbatim, including the
explanatory comment. Same bug class later turned up in two other places in the same
tree, which became separate reports.

This one has no CVE. GPAC does not assign them, and the MITRE request for it is still
in the queue.
