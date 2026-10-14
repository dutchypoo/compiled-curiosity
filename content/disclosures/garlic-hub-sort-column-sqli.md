---
title: "Blind SQL injection through the sort_column parameter"
target: "garlic-signage/garlic-hub"
target_url: "https://github.com/garlic-signage/garlic-hub"
bug_class: "SQL injection in an ORDER BY clause (CWE-89)"
severity: "Moderate / authenticated database disclosure"
cvss: "6.5"
cvss_version: "3.1"
cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N"
cwe: ["CWE-89"]
discovery_method: "Black-box parameter testing on a local install, then blind extraction with a shell script"
disclosed: 2026-10-14
status: "published"
advisory_url: "https://github.com/garlic-signage/garlic-hub/security/advisories/GHSA-mxv7-9529-qqv6"
ghsa: "GHSA-mxv7-9529-qqv6"
ghsa_url: "https://github.com/garlic-signage/garlic-hub/security/advisories/GHSA-mxv7-9529-qqv6"
cve_status: "requested by the maintainer, 2026-10-14"
affected: "< 1.1.5"
patched_in: "1.1.5"
fix_commit: "026014c5"
fix_commit_url: "https://github.com/garlic-signage/garlic-hub/commit/026014c5387060b8ea6718b25472cef6b21d83a0"
credit: "Credited as finder on GHSA-mxv7-9529-qqv6"
summary: "The sort_column query parameter on the data table routes lands in an ORDER BY clause with no validation. The only filtering it passes through is htmlspecialchars, which leaves arithmetic, parens and keywords alone, so any logged in user of any role can read the whole database one character at a time."
tags: ["web", "PHP", "sql-injection"]
featured: true
---

## Summary

garlic-hub is a self-hosted digital signage manager. Its list pages let you sort by
clicking a column heading, and the column name travels in the query string:

```
GET /playlists?sort_column=playlist_id&sort_order=asc
```

That value goes into the ORDER BY clause of the query. Nothing checks it against the
real column names. Any account, of any role, can put an expression there instead of a
column and read the database out of the sort order.

The proof that it is evaluated rather than echoed is one request:

```
sort_column=playlist_id*-1
```

with `sort_order=asc` returns the rows in the exact reverse of what `playlist_id`
returns. Multiplying by minus one flips the sort. Nothing that compares a name against
a list of allowed names can do arithmetic, so the value is reaching SQLite as SQL.

## Why this one was worth reporting

The project ships a `docs/threat-model.md` and the SECURITY.md says a report that
describes a documented design decision gets closed with a pointer to it. A lot is out of
scope on purpose: the player UUID is treated as a bearer credential in a header, player
self registration creates inert records, the `owner_id` parameter is an association
parameter and not an access control one. Worth reading before spending a night on
something they already decided they do not care about.

Section 9 of that document names injection on any route as in scope, and asks for a
proof of concept that demonstrates impact rather than a code pattern. So the bar was set
by them, and this is the lane they left open.

On privileges: a default install has no self registration, an admin creates accounts.
That is why the score is PR:L and not PR:N. It still means the lowest role in the
product can read the credentials of every other account.

## The check that was there, and the one next to it that was not

Both values come off the same request and are handled a few lines apart.

`src/Framework/Database/BaseRepositories/FilterBase.php:189-190`

```php
if (strcasecmp($sort_order, 'desc') != 0 && strcasecmp($sort_order, 'asc') != 0)
    $sort_order = 'ASC';
```

`sort_order` is compared against two allowed words, and anything else is thrown away.
That is the right thing to do.

`src/Framework/Database/BaseRepositories/FilterBase.php:200`

```php
return ['sort' => $this->table.'.'.$fields[BaseFilterParametersInterface::PARAMETER_SORT_COLUMN]['value'], 'order' => $sort_order];
```

`sort_column` gets a table prefix glued onto the front of it and nothing else. From
there it is handed to DBAL at
`src/Framework/Database/BaseRepositories/Traits/FindOperationsTrait.php:202`:

```php
$queryBuilder->addOrderBy($order['sort'], $order['order'] ?? 'ASC');
```

`addOrderBy` puts the first argument in the statement as written. It is a place for an
identifier, not for user input.

The one filter in the path is `src/Framework/Core/Sanitizer.php:38`:

```php
return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
```

That is HTML escaping. It handles quotes and angle brackets, and it does nothing to
parens, commas, arithmetic operators or SQL keywords. Keep the payload free of quotes
and it arrives intact.

This all lives in the shared framework filter rather than in the playlist code, so the
same parameter is on the other data table routes as well.

## Getting data out

There is no error output and no row content to read, so everything came back as a yes or
a no. A CASE expression in the ORDER BY either produces a valid sort or makes the query
fail, and the HTTP status code is the answer. One character per request.

I wrote a shell loop for it and walked the schema out by hand: the table names, then the
column layout of `user_main`, then the usernames, then the beginning of a bcrypt hash.

sqlmap confirmed it independently with a time based payload using SQLite heavy queries
over `RANDOMBLOB`.

## Where this went sideways

Two things cost real time, both mine.

The saved request I fed to sqlmap still had `playlist_name=test&playlist_mode=internal`
on it from earlier testing. That cuts the result down to about one row, and with one row
SQLite has no reason to evaluate the ORDER BY expression at all, so the detection that
had already worked by hand looked like it was failing. The second one was a missing
`--flush-session`, so it kept resuming a stored detection point instead of testing the
request I had just changed.

I also went in believing a time based blind could not work inside an ORDER BY on SQLite.
That was wrong.

## The ceiling, honestly

This is a read. PDO does not run stacked statements here, so there is no second query to
append, and SQLite has no `load_file` or `INTO OUTFILE`. Full disclosure of the database
including password hashes and stored OAuth2 credentials, and no write and no code
execution. The same parameter will also take an expensive subquery, which is a denial of
service rather than anything cleverer.

## The fix

Fixed in 1.1.5, in commit
[026014c5](https://github.com/garlic-signage/garlic-hub/commit/026014c5387060b8ea6718b25472cef6b21d83a0),
one hour and 44 minutes after the report went in.

ORDER BY cannot take a bound parameter, which is why this is not a placeholder fix. The
value now has to match `^[a-zA-Z_][a-zA-Z0-9_]*$` before it is used, it falls back to the
default column when it does not, and if neither the supplied value nor the default passes
the function returns no sort at all rather than building the clause anyway. The accepted
identifier is then quoted on both sides. The commit ships tests for it.

## Timeline

- 2026-10-13: found while testing a local install of garlic-hub, probing the list page
  parameters. Confirmed with the `playlist_id*-1` reversal, then extracted schema and
  user rows blind to show impact rather than report the pattern.
- 2026-10-14, 4:38 pm: reported privately to the maintainer, GPG encrypted to the key in
  the project SECURITY.md.
- 2026-10-14, 6:22 pm: maintainer replied with the fix.
- 2026-10-14: published as GHSA-mxv7-9529-qqv6, Moderate, CVSS 3.1 6.5, credited as
  finder. CVE requested the same day.
