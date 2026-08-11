---
title: "Missing bounds check in BMP parser"
target: "dotpeedeeeff/stegtool"
target_url: "https://github.com/dotpeedeeeff/stegtool"
bug_class: "Out-of-bounds read (missing bounds validation)"
severity: "Low / memory-safety"
cvss: ""
discovery_method: "Manual review (practice target)"
disclosed: 2026-08-09
status: "fixed"
advisory_url: "https://github.com/dotpeedeeeff/stegtool/issues/1"
credit: "Fixed by the maintainer; acknowledged in the issue thread"
summary: "steg.c allocates malloc(FileSize) then parses the info-header for DataOffset without validating those offsets lie within the allocation; the parser bounds-checks the claimed length, not the real buffer size. Fixed by the maintainer."
tags: ["C", "image-parser", "oob-read", "memory-safety", "fixed"]
featured: false
---

## Summary

`main` in `steg.c` computes `image = malloc(FileSize)`, then parses the info-header at
`image + 14` for `DataOffset` — reading `DataOffset - 14` bytes — with no validation that
these offsets lie within the allocation. The parser in `parser.c` bounds-checks against
the *claimed* length from the BMP header, not the *real* buffer size, so a crafted header
can drive a read past the end of the allocation.

## Impact

Out-of-bounds read (memory-safety). This is a small standalone tool used as a practice
target; impact is limited to a crash / over-read of the tool.

## Suggested fix

Validate that `DataOffset` and any header-derived offsets fall within `[0, FileSize)`
before dereferencing, and bound the parse against the real allocation size rather than the
header's claimed length.

## Resolution

The maintainer added checks to ensure the pointers stay within the allocated memory, and
additionally stopped trusting the file size taken from the BMP header — both fixed in
response to this report. Issue closed as completed.

## Timeline

- **2026-08-09** — reported upstream as issue #1.
- **2026-08-11** — maintainer added bounds checks and header-size validation; issue closed
  as fixed.
