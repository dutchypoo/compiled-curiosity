---
title: "Remote command execution on the BBS server through the Remote Borg Path field"
target: "marcpope/borgbackupserver"
target_url: "https://github.com/marcpope/borgbackupserver"
bug_class: "OS command injection via argument injection (CWE-78, CWE-88)"
severity: "Critical / authenticated RCE"
cvss: "9.1"
cvss_version: "3.1"
cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H"
cwe: ["CWE-78", "CWE-88"]
discovery_method: "Black-box testing against a local install, then source review to confirm the cause"
disclosed: 2026-10-02
status: "published"
advisory_url: "https://github.com/marcpope/borgbackupserver/security/advisories/GHSA-4jqx-9f92-rc8p"
ghsa: "GHSA-4jqx-9f92-rc8p"
ghsa_url: "https://github.com/marcpope/borgbackupserver/security/advisories/GHSA-4jqx-9f92-rc8p"
cve_status: "requested by the maintainer, 2026-10-03"
affected: "<= 2.98.0"
patched_in: "2.98.1"
credit: "Credited as reporter on GHSA-4jqx-9f92-rc8p"
summary: "The Remote Borg Path field names a binary that is supposed to run on the remote backup host. It never gets there. The value lands in the local ssh command line instead, so an ssh option that runs a program executes on the BBS server as www-data before any login happens."
tags: ["web", "PHP", "argument-injection", "rce"]
featured: true
---

## Summary

BBS lets an administrator add a remote SSH host to store backups on. One field on that
form is Remote Borg Path, which is supposed to name the borg binary that runs on the
remote machine after BBS logs into it.

It never gets to the remote machine. The value is dropped into the ssh command line that
BBS runs on its own server, before any connection is made. Setting it to an ssh option
that runs a program gives command execution on the BBS server as the web user, www-data,
with no valid SSH key anywhere.

## Where the value goes

`src/Services/RemoteSshService.php`, `testConnection()`, builds the ssh call as an array:

```php
$borgBin = $config['borg_remote_path'] ?: 'borg';      // line 94
...
"{$config['remote_user']}@{$config['remote_host']}",   // line 106
"{$borgBin} --version",                                // line 107
```

Line 107 reads like the command that runs on the remote host after login. It is not. The
string is split on spaces into separate arguments, so the Remote Borg Path becomes its
own argument to the local ssh process. Anything starting with `-o` is read by that local
ssh as a config option.

The username on line 106 is filtered. A short list of ssh keywords including
`ProxyCommand=`, `LocalCommand=`, `IdentityFile=`, `KnownHostsCommand=` and `ProxyJump=`
is rejected, case-insensitively. The Remote Borg Path field has no filter at all.

## Proving the ssh is local, not remote

Finding a field that reaches ssh is not the finding. What has to be proven is that the
ssh reading it is running on the BBS server and not on the far end.

Control test: put `-V` on its own in the Remote Borg Path field and press test
connection. `-V` makes ssh print its version and exit without opening a connection. The
response was:

```
OpenSSH_10.0p2 Debian-7+deb13u4, OpenSSL 3.5.7 9 Jun 2026
```

That is the ssh on the BBS server. A value sent to a remote host could not have produced
it, because no connection was ever made.

## Getting code execution

ssh's `ProxyCommand` option hands a string to /bin/sh on the local machine as soon as ssh
tries to open the connection, before any authentication. So the Remote Borg Path becomes:

```
-oProxyCommand=/usr/bin/id>/tmp/evil_file
```

Press test connection. On the server:

```
/tmp/evil_file www-data 2026-10-02 20:30:12 +0000
```

Owned by www-data, created at the exact second of the request. No key, no login, no
remote host that exists.

## Steps to reproduce

1. Log in as an admin.
2. Storage, add a Remote SSH Host, Custom.
3. Fill in any host, any user, and a throwaway SSH key.
4. Remote Borg Path: `-oProxyCommand=/usr/bin/id>/tmp/evil_file`
5. Save, then press test connection for that host.
6. `/tmp/evil_file` now exists on the server, owned by www-data.

## What did not work

Three real limits, all of them in the report:

- A literal space splits the value into separate ssh arguments, so the command cannot
  contain spaces. Redirects get around most of that: `cat</etc/passwd>/tmp/out`.
- `${IFS}` does not expand here, so the usual answer to the space problem is out.
- Output cannot be read back. Every file written this way came back zero bytes, because
  ssh kills the ProxyCommand process before it flushes. The proof rests on the file
  existing, its owner and its timestamp, not on its contents.

## Who can reach it

Checked rather than assumed. A plain user role account gets 403 on the storage page, 403
on the remote SSH config create endpoint, and has no API token section at all. So this is
administrator only, through the web UI and through the API.

## Why this is not one of the existing advisories

The project already had two argument injection advisories from September 2026,
GHSA-mrq9-2g5p-r8j6 and GHSA-w6m3-j4cx-8m67, both about user input reaching borg's own
command line. Before reporting I had to be able to say why this is a different bug.
Different field, different binary: this one reaches ssh's arguments, not borg's, through
a field neither of those fixes touched.

## The fix

Fixed in 2.98.1. The remote host, user and Remote Borg Path fields are validated on save
in both the web UI and the API, the Remote Borg Path is checked again wherever it is
used, the ssh commands BBS builds now put `--` before the destination so nothing after it
can be read as an option, and stored values that fail the new check are cleared on
update.

The maintainer's writeup added something I had not found. The same field is also passed
to borg as `--remote-path`, which borg places after the host in its own ssh call, so it
could run commands wherever borg ran, including client machines backing up to that host.
The same fix covers that path. Hosted multi-tenant installs were never affected, because
the remote SSH storage pages and API are disabled there.

## What I did not resolve

The username filter is real and I never found it. The two error strings it returns,
"remote username contains invalid characters" and "hostname contains invalid characters",
do not appear anywhere in the PHP source or the helper scripts on disk, and md5sum
confirmed the running container matched the clone I was reading. I worked around that
filter without ever understanding it.

## Timeline

- 2026-10-01: local install from the project's own docker compose, version 2.98.0.
- 2026-10-02: a leading dash in the remote username field returns ssh's own usage text,
  which shows that field reaches ssh's arguments.
- 2026-10-02: the username field turns out to be filtered by keyword. The Remote Borg
  Path field is not. `-V` there returns the ssh version banner from the BBS server.
- 2026-10-02: `-oProxyCommand=` in that field runs a program as www-data. Reported
  privately through GitHub.
- 2026-10-03: accepted and published by the maintainer as GHSA-4jqx-9f92-rc8p, Critical,
  CVSS 3.1 9.1. Fixed in 2.98.1. CVE requested the same day.
