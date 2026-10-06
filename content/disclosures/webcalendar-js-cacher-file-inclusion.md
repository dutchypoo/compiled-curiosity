---
title: "Unauthenticated local file inclusion in js_cacher.php"
target: "craigk5n/webcalendar"
target_url: "https://github.com/craigk5n/webcalendar"
bug_class: "Path traversal into a PHP include (CWE-22, CWE-98)"
severity: "High / unauthenticated arbitrary file read"
cvss: "7.5"
cvss_version: "3.1"
cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
cwe: ["CWE-22", "CWE-98"]
discovery_method: "Black-box testing against a local install, then source review to confirm the cause"
disclosed: 2026-10-05
status: "published"
advisory_url: "https://github.com/craigk5n/webcalendar/security/advisories/GHSA-vf78-25w4-9676"
ghsa: "GHSA-vf78-25w4-9676"
ghsa_url: "https://github.com/craigk5n/webcalendar/security/advisories/GHSA-vf78-25w4-9676"
cve_status: "requested by the maintainer, 2026-10-05"
affected: "< 1.9.25"
patched_in: "1.9.25"
fix_commit_url: "https://github.com/craigk5n/webcalendar/pull/798"
credit: "Credited as reporter on GHSA-vf78-25w4-9676"
summary: "js_cacher.php took a path out of the query string and handed it to include_once. One check looked at the first segment only, and the other compared the second segment against a directory listing that contains dot dot. An unauthenticated request read any file the web server user could read."
tags: ["web", "PHP", "path-traversal", "file-read"]
featured: true
---

## Summary

WebCalendar has a small script that serves its JavaScript, `js_cacher.php`. It takes the
file to serve from the `inc` query parameter and passes it to `include_once`. It is on
WebCalendar's list of public pages, so no login is needed to reach it.

```
GET /js_cacher.php?inc=js/../../../../../etc/passwd
```

came back with the whole file, 839 bytes, with no session cookie and no Authorization
header on the request. The response carried a fresh `Set-Cookie`, which is the server
saying it had never seen this visitor before. That is the part that makes it a finding
rather than a quirk: there is no login in front of it.

## Finding the shape of the filter

There were two checks in front of the include and I did not know what either one did at
first. The way through it was to hold one thing still and move one thing at a time.

What came out of that:

- The value has to start with `js/` or the request never reaches the include at all.
- `..` survives whatever filtering happens after that.

So the rule is not "stay inside the js folder". It is "start with the js folder", and
after that you can walk anywhere.

## Proving it is an include and not a file read

This matters for what the bug actually gets you, so it was worth nailing down rather than
assuming. A PHP error on one of the attempts printed its own stack:

```
#0 /var/www/html/js_cacher.php(65): include_once()
```

`include_once` is not the same as reading a file and printing it. A file with no PHP code
in it comes back exactly as it is on disk. A file with PHP code in it gets executed, and
you see its output rather than its source. So:

- System files, config files, logs, session files: returned in full.
- PHP files: run in WebCalendar's context. You never see the source.

## The test that nearly killed the finding

The obvious prize in a PHP app is the database credentials, which live in
`includes/settings.php`. That file reads back as zero bytes.

The reason is the previous section. The settings in that file sit inside a `/* */`
comment block, so `include` parses it, throws the comment away and emits nothing. The
credentials are unreachable by this route. The primitive is any non-PHP file on the
filesystem, and nothing more.

## Two routes to code execution, both closed

An arbitrary include is one step away from running code if you can get a file of your own
onto the disk. Two ways to try that, and I ran both to the end:

**Uploading.** WebCalendar imports ICS calendar files. I took a `find / -xdev -type f`
snapshot before an import and another after, 10,384 files, and diffed them. The only new
file was the snapshot itself. WebCalendar parses the ICS in memory, writes rows to MySQL
and throws the file away. Nothing attacker-controlled lands on disk.

**Session files.** `session.save_path` is unset in this container, so sessions land in
`/tmp/sess_<id>` as plain serialized text, and the session ID is sitting in my own cookie.
Including my own session file dumped it whole, and it contained `dbLogin`, `dbPassword`,
`dbHost`, `dbDatabase`, the `installPassword` hash and a live `csrf_form_key`.

That looked like the headline for about ten minutes. Then I ran the test that could kill
it: a clean `GET /login.php` for a brand new session ID, then include that session file.
Zero bytes. Those credentials were only in my session because I had run the install wizard
in that same browser session. An attacker gets their own empty session file, and a 32
character hex ID is not something you can guess or list through an include.

Last try on that route: a login attempt with PHP code as the username, to get my own code
written into the session file. Rejected with "Illegal characters in login", and the session
file stayed at zero bytes.

So the finding is an unauthenticated arbitrary file read. Not remote code execution. The
advisory says the same thing.

## Where I was wrong

WebCalendar's own navigation bar contains this link, as the printer-friendly button:

```
js_cacher.php?inc=js/../../year.php&friendly=1
```

The app walks out of the js directory itself, in a link it generates. I read that as the
author having designed for traversal here, and wrote the report around arguing that
leaving the application directory entirely is a different thing from the two levels he
built for.

Craig's answer was that the print link was not intended behaviour either. It is built from
the current URL and query string, so it was echoing the same bug back at me. No legitimate
caller needs `..` at all. The thing I spent the most effort defending turned out to be
another symptom.

## The fix

Fixed in v1.9.25, released the same day the report went in.

The fix is a strict allow-list rather than a containment check. The included file has to be
an entry directly inside `includes/js/` other than `.` or `..`, and anything after the file
name is never treated as part of the path. The pull request is
[#798](https://github.com/craigk5n/webcalendar/pull/798) and it ships regression tests for
both the traversal and the escaping.

While fixing it Craig found and closed a reflected XSS in the same mechanism, where request
values were written unescaped into the `<script src>` attribute on `catsel.php` and
`availability.php`. That one is his find, not mine.

## Timeline

- 2026-10-05: local install of WebCalendar v1.9.24 and black-box testing of the public pages.
- 2026-10-05: `inc=js/../../../../../etc/passwd` returns the file with no session. Filter
  behaviour isolated, the upload and session-poisoning routes to RCE both tested and closed.
- 2026-10-05: reported privately to the maintainer.
- 2026-10-05: confirmed and fixed the same day, released as v1.9.25, credited in the
  CHANGELOG and release notes.
- 2026-10-05: published as GHSA-vf78-25w4-9676, High, CVSS 3.1 7.5. CVE requested the same day.
