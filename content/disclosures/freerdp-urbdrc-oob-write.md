---
title: "Out-of-bounds write in urb_send_current_frame_number_result"
target: "FreeRDP/FreeRDP"
target_url: "https://github.com/FreeRDP/FreeRDP"
bug_class: "Reachable assertion via out-of-bounds write (CWE-617)"
severity: "High / remote DoS"
cvss: "7.1"
cvss_version: "4.0"
cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:P/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N"
cwe: ["CWE-617"]
discovery_method: "Custom in-tree libFuzzer harness for the urbdrc channel + ASan"
disclosed: 2026-08-19
status: "published"
advisory_url: "https://github.com/FreeRDP/FreeRDP/security/advisories/GHSA-h5w2-q35j-443h"
cve: "CVE-2026-91951"
cve_url: "https://www.cve.org/CVERecord?id=CVE-2026-91951"
ghsa: "GHSA-h5w2-q35j-443h"
ghsa_url: "https://github.com/FreeRDP/FreeRDP/security/advisories/GHSA-h5w2-q35j-443h"
cna: "VulnCheck"
fix_commit: "aa8650b3"
fix_commit_url: "https://github.com/FreeRDP/FreeRDP/commit/aa8650b300aa4cabd85d9c72b431301509b9043f"
patched_in: "3.31.0"
affected: "FreeRDP 3.14.0 through 3.30.0"
credit: "Credited as reporter on GHSA-h5w2-q35j-443h"
summary: "A malicious RDP server can send a 28-byte USB redirection message that writes four bytes past a 16-byte buffer in the urbdrc client channel, crashing the client when verbose asserts are enabled. Found in code Google's OSS-Fuzz fleet never compiles."
tags: ["C", "RDP", "fuzzing", "oob-write", "remote"]
featured: true
---

## Summary

The urbdrc channel handles USB device redirection. A server-supplied USB request message
reaches `urb_send_current_frame_number_result()`, which builds a fixed 16-byte reply
buffer and then writes past the end of it. 28 bytes from the server is enough.

## Why nobody had found it

This is the finding I am happiest with, because the target selection is what produced it
rather than luck.

FreeRDP has 14 in-tree fuzz harnesses and is in Google's OSS-Fuzz. That normally means
the shallow bugs are gone. But OSS-Fuzz builds from
`ci/cmake-preloads/config-oss-fuzz.cmake`, and that file sets `CHANNEL_URBDRC` to OFF.
The channel is 7,078 lines of C that the entire Google fuzzing fleet has never once
compiled, let alone executed.

I checked the OSS-Fuzz build configuration before writing a single line of harness code,
specifically looking for code that is shipped but never built under fuzzing. urbdrc was
the largest thing on that list.

The seed that triggered the bug was hand-written from the message layout in the source,
not mutated.

## Reported alongside a standing offer

The maintainer's response included an open invitation for pull requests improving unit
and fuzzer coverage. The harness that found this is the obvious thing to upstream.

## Timeline

- 2026-08-19 reported privately through GitHub Security Advisories
- 2026-08-20 accepted by the maintainer, fix PR opened
- 2026-09-01 advisory published
- 2026-09-15 CVE-2026-91951 assigned
