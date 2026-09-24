---
title: "NULL pointer dereference in gdi_surface_bits when the client has not enabled NSCodec"
target: "FreeRDP/FreeRDP"
target_url: "https://github.com/FreeRDP/FreeRDP"
bug_class: "NULL pointer dereference (CWE-476)"
severity: "High / remote DoS"
cvss: "7.1"
cvss_version: "4.0"
cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:P/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N"
cwe: ["CWE-476"]
discovery_method: "Custom libFuzzer harness (TestFuzzGdiCache) + ASan"
disclosed: 2026-08-19
status: "published"
advisory_url: "https://github.com/FreeRDP/FreeRDP/security/advisories/GHSA-ffjr-p229-hpch"
cve: "CVE-2026-91954"
cve_url: "https://www.cve.org/CVERecord?id=CVE-2026-91954"
ghsa: "GHSA-ffjr-p229-hpch"
ghsa_url: "https://github.com/FreeRDP/FreeRDP/security/advisories/GHSA-ffjr-p229-hpch"
cna: "VulnCheck"
fix_commit: "5c12d4ef"
fix_commit_url: "https://github.com/FreeRDP/FreeRDP/commit/5c12d4eff64f9cba9e7710341b712cf426d399c3"
patched_in: "3.31.0"
affected: "FreeRDP before 3.31.0"
credit: "Credited as reporter on GHSA-ffjr-p229-hpch"
summary: "A malicious RDP server can crash any FreeRDP client with a 22-byte Surface Bits command that claims NSCodec, even when the client never negotiated that codec. Fix requested and merged by the maintainer the same day it was reported."
tags: ["C", "RDP", "fuzzing", "null-deref", "remote"]
featured: true
---

## Summary

FreeRDP clients accept a `SURFACE_BITS` command from the server and dispatch on the
codec ID inside it. Nothing checks that the codec the server names is one the client
actually negotiated. If the server says NSCodec and the client never enabled NSCodec,
`gdi_surface_bits()` hands a NULL codec context straight into `nsc_process_message()`
and the process dies.

The whole trigger is 22 bytes on the wire and no credentials are involved. The victim
only has to connect to the server.

## Where it goes wrong

`FreeRDP_NSCodec` has no default value in `libfreerdp/core/settings.c`, so it is false
unless the user passes `/nsc` on the command line. `get_codecs_flags()` strips the flag,
and `codecs_prepare()` then never creates the NSCodec context. Meanwhile the surface
command handler is still registered, because `DeactivateClientDecoding` is false by
default. So the handler exists, the context does not, and no code in between compares
the server's codec ID against the negotiated set.

The argument that made the report land was the neighbouring switch case. The RemoteFX
branch is safe only because `rfx_process_message()` checks its own context first. Two
adjacent cases in the same switch, one guarded, one not.

## Proof of concept

22 wire bytes plus one harness selector byte:

```
01 01 00 00 00 00 00 40 00 40 00 20 00 00 01 01 00 ff 00 00 00 00 00
```

`cmdType 01 00`, rectangle 0/0/64/64 so it passes the rectangle validity check,
`bpp 0x20`, `codecID 01` which is `RDP_CODEC_ID_NSCODEC`. The dereference happens before
any bitmap data is read, so `bitmapDataLength` can be zero.

libFuzzer's `-minimize_crash` and a hand derivation from the source produced a
byte-identical file.

## Release builds are not safe either

The first thing to check with a reachable assert is whether it survives into shipped
builds. It does. `WITH_VERBOSE_WINPR_ASSERT` defaults on, and with it on
`winpr_internal_assert()` calls `abort()` with no `NDEBUG` gate at all. I compiled it
both ways to confirm rather than assuming, because the usual instinct here is wrong:
`NDEBUG` alone does not remove FreeRDP's asserts.

## How it was found

The working theory going in was that the parsers are fuzzed hard and the consumers are
not. The two in-tree core harnesses build a bare context and never call `cache_new()` or
`gdi_init()`, so every handler that dispatches into a cache or into GDI finds no consumer
and returns early. I wrote a harness that initialises both first and then drives the
same parsers. The crash showed up at 771 seconds.

## Timeline

- 2026-08-19 reported privately through GitHub Security Advisories
- 2026-08-19 maintainer requested a CVE, roughly six hours after filing
- 2026-08-19 fixed in commit `5c12d4ef`, replacing the assert with a real NULL check
- 2026-09-01 advisory published
- 2026-09-15 CVE-2026-91954 assigned
