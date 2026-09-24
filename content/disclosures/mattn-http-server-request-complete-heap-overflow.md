---
title: "Heap buffer overflow in request_complete()"
target: "mattn/http-server"
target_url: "https://github.com/mattn/http-server"
bug_class: "Heap-based buffer overflow (CWE-122 / CWE-787)"
severity: "High / DoS"
cvss: "7.5"
cvss_version: "3.1"
cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
cwe: ["CWE-122", "CWE-787"]
discovery_method: "Manual source audit + ASan/UBSan"
disclosed: 2026-07-29
status: "published"
advisory_url: "https://github.com/mattn/http-server/security/advisories/GHSA-6jm3-wmrf-frmh"
ghsa: "GHSA-6jm3-wmrf-frmh"
ghsa_url: "https://github.com/mattn/http-server/security/advisories/GHSA-6jm3-wmrf-frmh"
credit: "Credited as reporter (accepted) on GHSA-6jm3-wmrf-frmh"
summary: "An unauthenticated remote client can crash the server with a single over-long request URI: request_complete() copies the raw path into a fixed PATH_MAX heap buffer with no length check."
tags: ["C", "web-server", "buffer-overflow", "DoS"]
featured: true
---

## Summary

`request_complete()` builds the on-disk file path for an incoming request by copying
the document root and then the raw request URI into a fixed-size heap buffer,
`request->file_path[PATH_MAX]`, **with no length check**. An unauthenticated remote
client can send a single request with an over-long URI path and write past the end of
that buffer, terminating the server.

## Vulnerable code

`server.c:285` onward:

```c
static void
request_complete(http_request* request) {
  memcpy(request->file_path, static_dir, static_dir_len);   /* line 285 — in bounds  */
  memcpy(request->file_path + static_dir_len,               /* line 286 — OOB write  */
         request->path, request->path_len);
  if ((request->path + request->path_len - 1) == '/') {
    memcpy(request->file_path + static_dir_len + request->path_len,
           "index.html", 11);                               /* line 288 — OOB write  */
  } else
    request->file_path[static_dir_len + request->path_len] = 0; /* line 290 — OOB    */
}
```

`static_dir` defaults to `"./public"` (`static_dir_len = 8`, `server.c:71`) and
`file_path` is `char[PATH_MAX]` (4096 on Linux). Only line 285 is always in bounds.

**Overflow condition:** `static_dir_len + path_len > PATH_MAX` — i.e. `path_len > 4088`
with the default root. The threshold moves with the `-d` document-root flag. There are
two out-of-bounds writes per request: the path copy at line 286, and the trailing
`index.html` / NUL write at 288/290.

## Reproduction

Build with AddressSanitizer and run a local instance:

```bash
git clone https://github.com/mattn/http-server
cd http-server
git submodule update --init --recursive
( cd deps/libuv && sh autogen.sh && ./configure && make -j"$(nproc)" )

clang -g -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
  -I./deps/picohttpparser -I./deps/libuv/include -I./deps/klib \
  server.c deps/picohttpparser/picohttpparser.c deps/libuv/.libs/libuv.a \
  -o http-server-asan -pthread -lrt -lm

mkdir -p public
ASAN_OPTIONS=abort_on_error=1 ./http-server-asan -a 127.0.0.1 -p 7000 -d ./public
```

Then send one request whose URI path is ~5000 bytes in a single write
(`GET /AAAA…AAAA HTTP/1.1`). ASan aborts inside the copy at `server.c:286`:

```
ERROR: AddressSanitizer: heap-buffer-overflow
WRITE of size 5001
  #1 request_complete server.c:286:3
  #2 on_read          server.c:370:3
0x... is located 0 bytes after 5208-byte region
```

The full PoC script is attached to the advisory.

## Impact

- **Class:** heap-based buffer overflow (CWE-122 / CWE-787)
- **Impact:** unauthenticated remote denial of service
- **Severity:** CVSS 3.1 base **7.5 High** — `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`
- **Auth / interaction:** none / none

Only denial of service is demonstrated. Controlled heap corruption and remote code
execution are **not** demonstrated and **not** claimed. Testing was done against a local
instance owned by me.

## Suggested fix

Bounds-check the composed length before writing, and reject or truncate when it would
not fit:

```c
if (static_dir_len + request->path_len + sizeof("index.html") >= sizeof(request->file_path)) {
    /* respond 414 / close the connection instead of writing */
    return;
}
```

## Timeline

- **2026-07-28** — reported privately to the maintainer via GitHub Security Advisories.
- **2026-07-29** — maintainer accepted the report; advisory **GHSA-6jm3-wmrf-frmh**
  published. Credited as reporter.
- No CVE requested at time of writing (the advisory is CVE-eligible on request).
