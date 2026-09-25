---
title: "NULL-pointer dereference in c-strip"
target: "bagder/c-comments"
target_url: "https://github.com/bagder/c-comments"
bug_class: "NULL pointer dereference (crash)"
severity: "Low / DoS"
cwe: ["CWE-476"]
discovery_method: "Manual audit + ASan/UBSan"
disclosed: 2026-08-10
status: "open"
advisory_url: "https://github.com/bagder/c-comments/issues/1"
summary: "c-strip crashes with a NULL-pointer write when a processed line produces no output. The output buffer is only allocated on the first addc() call, so a lone \"/\" reaches strip_trailing_space() with a NULL buffer."
tags: ["C", "parser", "null-deref", "DoS"]
featured: false
---

## Summary

`c-strip` crashes with a NULL-pointer write when a processed line produces no output,
leaving the output buffer unallocated. The simplest trigger is an input consisting of a
single `/`.

## Reproduction

```bash
printf '/' | ./c-strip
```

Built with `-fsanitize=address,undefined`:

```
c-strip.c:118:20: runtime error: store to null pointer of type 'char'
AddressSanitizer: SEGV on unknown address 0x000000000000 (WRITE)
  #0 strip_trailing_space c-strip.c:118
  #1 strip_file           c-strip.c:262
```

## Cause

The output buffer `o->p` is only allocated on the first `addc()` call. A lone `/` sets
`state = SLASH` without emitting output, so `addc()` is never called and `o->p` stays
`NULL`. `strip_trailing_space()` then dereferences it:

```c
buf->p[buf->len] = '\0';   /* c-strip.c:118, buf->p is NULL, buf->len is 0 */
```

## Impact

Crash (denial of service) on malformed input. This is a small command-line utility, so
impact is limited to a crash of the tool itself.

## Suggested fix

Guard the write when the buffer was never allocated (`buf->p == NULL` / `buf->len == 0`),
or allocate the output buffer up front.

## Timeline

- **2026-08-10** reported upstream as issue #1 (open at time of writing).
