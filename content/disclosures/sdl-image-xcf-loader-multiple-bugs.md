---
title: "Multiple bugs in the XCF loader (IMG_xcf.c)"
target: "libsdl-org/SDL_image"
target_url: "https://github.com/libsdl-org/SDL_image"
bug_class: "NULL pointer dereference & unchecked allocation size (DoS)"
severity: "Low–Medium / DoS"
cvss: ""
discovery_method: "libFuzzer + ASan + UBSan"
disclosed: 2026-08-11
status: "open"
advisory_url: "https://github.com/libsdl-org/SDL_image/issues/757"
credit: ""
summary: "Fuzzing IMG_LoadXCF_IO surfaced four issues in the XCF loader — two NULL-pointer dereferences, an unchecked width/height leading to a gigabyte-scale allocation, and a variant-analysis note. All denial of service."
tags: ["C", "image-parser", "fuzzing", "DoS", "null-deref"]
featured: false
---

## Summary

Fuzzing `IMG_LoadXCF_IO` with libFuzzer + ASan + UBSan surfaced four related issues in
the XCF (GIMP) loader, `src/IMG_xcf.c`. All are denial of service — a crash or a
resource-exhaustion allocation. No memory-corruption / RCE path was identified. Any
application using SDL_image to load untrusted `.xcf` files is affected. All findings
reproduce on clean current `main`.

## Bug 1 — NULL dereference in do_layer_surface

`read_xcf_level()` can return `NULL` (short read, allocation failure); the caller does
not check it before dereferencing.

```c
level = read_xcf_level(src, head);
ty = tx = 0;
for (j = 0; level->tile_file_offsets[j]; j++) {   /* line 780 — deref without NULL check */
```

```
AddressSanitizer: SEGV on unknown address 0x000000000008 (READ)
UBSan: member access within null pointer of type 'xcf_level'
  #0 do_layer_surface  src/IMG_xcf.c:780
  #1 IMG_LoadXCF_IO    src/IMG_xcf.c:1000
```

**Fix:** check `level` for `NULL` after the call and bail out with an error.

## Bug 2 — NULL dereference in read_xcf_level

`SDL_realloc`'s return value is written without a NULL check.

```c
do {
    l->tile_file_offsets = (Uint64 *)SDL_realloc(l->tile_file_offsets,
        sizeof(*l->tile_file_offsets) * (i + 1));
    l->tile_file_offsets[i] = read_offset(src, h);   /* written without NULL check */
} while (l->tile_file_offsets[i++]);
```

If `SDL_realloc` returns `NULL`, the next line writes to `NULL`. **Fix:** assign to a
temporary, check it, free and return `NULL` on failure before reassigning.

## Bug 3 — Unchecked width/height → gigabyte-scale allocation

`head->width` / `head->height` are read from the file and used to allocate a surface
with no bounds check. The `hierarchy->width/height` path is bounded (`> 20000`), but the
`head` path is not.

```c
surface = SDL_CreateSurface(head->width, head->height, SDL_PIXELFORMAT_ARGB8888); /* line 971 */
```

A 4-byte edit to a valid `.xcf` (setting width to `0x7fffffff`) triggers a multi-gigabyte
allocation attempt — a reliable DoS on any app loading untrusted XCF. **Fix:** apply the
same sanity limit already used for `hierarchy` to `head`.

## Bug 4 — Variant-analysis note on GHSA-gq8w-x74c-h6p7

The colormap patch (commit `996bf12`) correctly guarded both `cm_map[]` paths, and every
remaining use of `cm_map[]` is now guarded — the patch was complete for that bug class.
Bugs 1–3 are other unchecked attacker-controlled header values in the same file,
unrelated to the colormap.

## Environment

- Target: current `main`, `src/IMG_xcf.c`
- Compiler: `clang -fsanitize=fuzzer,address,undefined -DLOAD_XCF`
- Harness: `IMG_LoadXCF_IO(SDL_IOFromConstMem(data, size))`

## Impact

All four are denial of service (crash or resource exhaustion). No memory-corruption / RCE
path was identified.

## Timeline

- **2026-08-11** — reported upstream as issue #757 (open at time of writing). Harness,
  corpus, and crash artifacts offered to the maintainers.
