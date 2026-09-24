---
title: "Remote heap over-read in gf_rtp_parse_ttxt() from a single UDP packet"
target: "gpac/gpac"
target_url: "https://github.com/gpac/gpac"
bug_class: "Out-of-bounds read (CWE-125, CWE-119)"
severity: "Medium / remote information disclosure"
cvss: "6.9"
cvss_version: "4.0"
cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:L/SC:N/SI:N/SA:N"
cwe: ["CWE-125", "CWE-119"]
discovery_method: "Custom libFuzzer harness driving the RTP depacketizer + ASan"
disclosed: 2026-08-20
status: "published"
advisory_url: "https://github.com/gpac/gpac/issues/3868"
cve: "CVE-2026-93331"
cve_url: "https://www.cve.org/CVERecord?id=CVE-2026-93331"
cna: "VulDB"
fix_commit: "6bb0f64b"
fix_commit_url: "https://github.com/gpac/gpac/commit/6bb0f64b4d1039c0fecd14ee2c1ee861d8661a68"
patched_in: "abi-16.26"
affected: "GPAC 26.08-DEV"
credit: "Credited by name in the upstream fix commit"
summary: "A 19-byte UDP datagram makes GPAC copy roughly 64KB of adjacent heap memory into its media pipeline. Confirmed, fixed and credited by the maintainer within about eleven hours of a private report."
tags: ["C", "RTP", "fuzzing", "oob-read", "remote"]
featured: true
---

## Summary

GPAC's RTP timed-text depacketizer reads a 16-bit length field straight off the wire and
never compares it against how many bytes actually arrived. Four separate guards in that
function check the header field against itself. None of them check it against the packet.

A 19-byte UDP datagram carrying a 7-byte RTP payload makes GPAC emit five 65,536-byte
packets into the media pipeline. The bytes past the end of the real payload are whatever
is next on the heap.

## Root cause

In `src/ietf/rtp_depacketizer.c`:

```c
ttu_len = gf_bs_read_u16(bs);   /* straight off the wire, never bounded */
if (ttu_len < 2) break;         /* checks the field, not the packet */
```

Three separate uses inherit the unchecked value. The one that matters most is the
callback at line 527, because the consumer on the other side allocates and then
`memcpy`s that attacker-chosen length out of the packet buffer. So this is not only a
read past the end, it is a copy of that memory into data the pipeline goes on to use.

## Proof

7-byte RTP payload, type 1, `ttu_len` set to `0xFFFF`:

```
01 FF FF 00 00 00 00
```

Against `gpac -i poc_ttxt.sdp inspect:deep` this prints five packets of `size 65536`
from seven bytes of input. Type 3 with an 8-byte payload gives a clean ASan report:
`heap-buffer-overflow ... READ of size 65529`.

Two details cost time and are worth recording. The RTP sequence number has to stay
fixed, because incrementing it makes the reorderer drop everything. And type 1 does not
produce a clean ASan report even though it is the same bug, because ASan's `memcpy`
interceptor uses a fast first/middle/last-byte range check that a 64KB read starting in
a small chunk can slip past. The byte-by-byte path catches it, the `memcpy` does not.

## Why the RTP receive path was unfuzzed

GPAC has four OSS-Fuzz harnesses. Not one of them opens a socket. `src/ietf/` is
about 11,750 lines of protocol handling that the upstream fuzzers only reach on the
sending side. Every RTP hit in the public issue tracker is the packetizer, which is
file-driven, never the depacketizer.

Reaching it from a file turned out to be possible anyway: the RTP input filter declares
the `sdp` file extension, and the depacketizer is constructed at stream-declaration time,
so a plain `.sdp` file is enough to build the harness around.

## The fix

The patch is the guard from the report, inserted verbatim after the existing
`ttu_len < 2` check, with a log line added:

```c
if (pay_start + ttu_len + 1 > (u64) size) break;
```

## Timeline

- 2026-08-20 reported privately to security@gpac.io
- 2026-08-20 confirmed and fixed about eleven hours later, commit body reads "credits @dutchypoo"
- 2026-08-21 public issue #3868 opened at the maintainer's invitation as a citable reference
- 2026-09-18 CVE-2026-93331 assigned
