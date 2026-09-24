---
title: "Infinite loop in the vendored dr_wav chunk parser from a 69-byte WAV"
target: "mackron/miniaudio"
target_url: "https://github.com/mackron/miniaudio"
bug_class: "Infinite loop / uncontrolled resource consumption (CWE-835)"
severity: "Medium / DoS"
discovery_method: "libFuzzer + ASan against ma_decode_memory(), triaged with gdb and instrumentation"
disclosed: 2026-08-22
status: "open"
advisory_url: "https://github.com/mackron/miniaudio/issues/1151"
cwe: ["CWE-835"]
credit: "Reported publicly at the maintainer's request"
summary: "A 69-byte WAV file with a forged chunk size locks miniaudio's decoder in a loop forever. Reproduces on a plain non-sanitizer build, so it is not a fuzzing artifact."
tags: ["C", "audio", "fuzzing", "infinite-loop"]
featured: false
---

## Summary

`ma_decode_memory()` never returns on a 69-byte WAV whose `fmt ` chunk declares a size of
`0xFFFFFFFF`. The chunk-walking loop reads a size straight out of the file, seeks forward
by it, and never checks that the seek actually went anywhere real. The cursor climbs by
4,294,967,295 every pass and the loop's only exit never fires.

## Triage method

This one was worth writing down because the technique generalises.

1. Reproduce it standalone, outside the fuzzer, so it is definitely not fork contention.
2. Attach to the hung process several times: `gdb -p <PID> -batch -ex bt`.
3. Compare backtraces by function **name**, not frame number. The frame numbers shift
   because they are just stack depth. The function present in every single backtrace is
   the loop; everything above it changes each pass, which is what proves it is a loop
   body rather than a block.
4. Then instrument that one loop with an `fprintf` and read the actual numbers.

The numbers were the thing. A single gdb snapshot had suggested the cursor was moving
backwards, and I built a theory on that. The instrumented run showed it only ever moves
forward. One stack snapshot is a photograph of something moving.

## What I got wrong, on the record

My first proposed fix was to break when the cursor stops changing. It does not work, and
I only found that out by building it. After the first two passes the cursor never
repeats, so the check is dead code. It was cut from the report before filing.

The instrumentation also showed something I had misread earlier: two identical cursor
values at the start were not two passes of one loop, they were two separate **calls** to
the init function. The second call is the one that hangs.

The filed report says plainly what was verified and what was not, including one open
question I could not answer: why the chunk-header read keeps succeeding once the position
is clamped at the end of the buffer.

## Reproduction

Two independent reproductions are in the report. The second matters more: a plain
`clang -O1` build with no sanitizers, which pre-empts any "this is just a fuzzing
artifact" objection.

## Disclosure route

miniaudio's security policy states that all security issues are handled publicly and
transparently, and that the fastest route to a fix is a pull request. So there was no
private report and no embargo. The public issue is the citable reference.
