---
title: "OpenCATS: stored XSS in calendar event rendering"
target: "opencats/OpenCATS"
target_url: "https://github.com/opencats/OpenCATS"
bug_class: "Stored cross-site scripting"
discovery_method: "Manual testing of a local install"
disclosed: 2026-10-22
advisory_url: "https://github.com/opencats/OpenCATS/security/advisories/GHSA-pw84-c8j7-98q2"
severity: "High"
status: "published"
cvss: "8.7"
cvss_version: "3.1"
cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:N"
ghsa: "GHSA-pw84-c8j7-98q2"
ghsa_url: "https://github.com/opencats/OpenCATS/security/advisories/GHSA-pw84-c8j7-98q2"
cwe: ["CWE-79", "CWE-116", "CWE-1004"]
affected: "<= 0.11.1"
patched_in: "0.12.1"
cve_status: "requested by the maintainer, 2026-10-22"
credit: "dutchypoo, Reporter"
tags: ["web", "php", "xss"]
summary: "A normal OpenCATS user can put script in a calendar event title or description, and it runs in any other user's browser that views it, including an administrator's."
---

## Summary

OpenCATS is an applicant tracking system written in PHP. Calendar event titles and descriptions are stored as text and URL encoded on the way to the browser. The calendar JavaScript decodes them again and writes them into the page as HTML with no output escaping. Any authenticated user who can add or edit a calendar event can put markup in the title or the description, and it executes in the browser of whoever views it.

Marking the event as a Public Entry hands it to the rest of the users, administrators included.

Published as GHSA-pw84-c8j7-98q2, High, CVSS 3.1 8.7, affected versions 0.11.1 and below, patched in 0.12.1.

## Why it matters

Adding a calendar event is not supposed to be an administrative capability. It is the kind of thing a recruiter does on their first day. But the script that comes along with the event runs inside the OpenCATS origin in the victim's browser, so it can read what that user can read and send requests with their privileges. When the victim is an administrator, that is administrative access through a calendar entry.

Session cookie theft is on the table too. OpenCATS does not set HttpOnly on its CATS session cookie at the session start points the advisory covers, so whether the cookie is reachable from JavaScript comes down to how the instance is deployed. On my own test install it was reachable, and I took an administrator's session cookie and replayed it. Turning HttpOnly on takes that part away, but it does not stop the injected script from acting through the victim's own authenticated browser.

## Where it goes wrong

The problem is not the storage, it is the render. The values come down encoded, the calendar JavaScript decodes them, and the result is inserted as HTML rather than as text. Titles reach that path in the month, week and day views and in the event details panel. Descriptions reach it when the details panel is shown. Whether it fires as soon as the calendar loads or only after the victim opens a grouped event depends on the view and on how the events are grouped that day.

I am not putting a file and line on that in this post. I confirmed the behavior at runtime on my own install, but I did not read the 0.12.1 patch diff, so I am not going to point at code I have not looked at.

## Proving the boundary

The thing worth proving was that this really is a privilege boundary and not just one admin feature talking to another.

Read only accounts cannot create events through the affected endpoint, so the attacker needs add or edit permission on the calendar. That is what a plain non administrator account has on a stock install. The control test was to log in as that plain user, create the event, then open the calendar as the administrator in a separate browser profile and watch the payload execute there. Two different accounts, two different privilege levels, and the script ran on the higher one.

What I did not establish: no password disclosure, and no server side code execution. The finding is what it is.

## The fix

Fixed in 0.12.1. The advisory notes the vulnerable rendering paths were present in 0.12.0 as well, so 0.12.1 is the version to be on.

## Timeline

- 2026-10-08: found while testing a local install, reported privately through GitHub private vulnerability reporting
- 2026-10-22: GHSA-pw84-c8j7-98q2 published by the maintainer, High, CVSS 3.1 8.7, credited to dutchypoo as reporter
- 2026-10-22: maintainer requested a CVE
