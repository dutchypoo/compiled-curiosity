---
title: "Out-of-bounds read in wait_for_header_and_parse() via a truncated Content-Range header"
target: "gpac/gpac"
target_url: "https://github.com/gpac/gpac"
bug_class: "Out-of-bounds read (CWE-125, CWE-119)"
severity: "Low / memory-safety defect"
cvss: "1.9"
cvss_version: "4.0"
cvss_vector: "CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:L/VI:L/VA:L/SC:N/SI:N/SA:N"
cwe: ["CWE-125", "CWE-119"]
discovery_method: "Manual source audit of a strchr() misuse pattern"
disclosed: 2026-08-18
status: "published"
advisory_url: "https://github.com/gpac/gpac/issues/3859"
cve: "CVE-2026-92475"
cve_url: "https://www.cve.org/CVERecord?id=CVE-2026-92475"
cna: "VulDB"
fix_commit: "c74a3065"
fix_commit_url: "https://github.com/gpac/gpac/commit/c74a3065038ede35c1c7b75fa493a69ef6bcdb84"
patched_in: "abi-16.26"
credit: "Fixed upstream using the reported guard"
summary: "An HTTP server replying with a truncated Content-Range header walks GPAC's header parser one byte past the end of a six-byte allocation. One instance of a whole bug class that runs through the codebase."
tags: ["C", "HTTP", "source-audit", "oob-read"]
featured: false
---

## Summary

`strchr(s, 0)` does not return NULL. It returns a pointer to the string's own
terminator, because the terminator counts as a match. That means the very common
skip-whitespace idiom

```c
while (strchr(" \t", p[0])) p++;
```

walks straight past the end of the string instead of stopping at it.

GPAC's HTTP downloader uses that idiom on the value of a `Content-Range` response
header. A server replying with `Content-Range: bytes` and nothing after it makes the
parser read one byte past a six-byte `strdup("bytes")`.

## Why it landed

I verified the behaviour first with a two-line test program rather than asserting it,
then checked whether GPAC already knew about the pattern. It did. The guarded form
already appears elsewhere in the same tree:

```c
while (attribute_content[0] && strchr(...))
```

So the report could be framed as "this does not match your own convention" and point at
the existing correct instances. That is a much easier thing for a maintainer to accept
than an abstract argument about undefined behaviour.

The report also listed six further unguarded instances of the same idiom elsewhere in
the tree, marked clearly as unverified rather than claimed.

## The fix

Upstream commit `c74a3065` adds the guard, plus a NULL check:

```c
while (val && val[0] && strchr(":= ", val[0]))
```

## Honest severity

VulDB scored this 1.9 Low with a local attack vector. I would argue the vector is
network, since the trigger is a response from an HTTP server GPAC was pointed at, but
the assigned score is the assigned score and it is not worth disputing over a one-byte
over-read. It is here because it is a real, fixed, publicly tracked finding, not because
it is impressive.

## Timeline

- 2026-08-18 filed as gpac/gpac#3859
- 2026-08-19 fixed in master, confirmed by reading the patched file upstream
- 2026-09-16 CVE-2026-92475 assigned
