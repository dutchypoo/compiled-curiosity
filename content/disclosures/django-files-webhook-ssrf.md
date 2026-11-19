---
title: "Server side request forgery in webhooks lets any user enumerate internal services"
target: "django-files/django-files"
target_url: "https://github.com/django-files/django-files"
bug_class: "Server-side request forgery (CWE-918)"
severity: "Moderate / authenticated internal service discovery"
cvss: "5.0"
cvss_version: "3.1"
cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:L/I:N/A:N"
cwe: ["CWE-918"]
discovery_method: "Black-box testing against a local install as a plain user, then source review to confirm the cause"
disclosed: 2026-09-28
status: "published"
advisory_url: "https://github.com/django-files/django-files/security/advisories/GHSA-78q4-xvhj-c95c"
ghsa: "GHSA-78q4-xvhj-c95c"
ghsa_url: "https://github.com/django-files/django-files/security/advisories/GHSA-78q4-xvhj-c95c"
cve_status: "submitted to VulDB, 2026-11-19"
affected: "< 0.18.4"
patched_in: "0.18.4"
fix_commit: "517c6750"
fix_commit_url: "https://github.com/django-files/django-files/commit/517c6750aee65253ac5c8a2dff4947f1a71357c8"
credit: "Credited as co-reporter on GHSA-78q4-xvhj-c95c"
summary: "Any logged in user could point a webhook at the server's own loopback interface and fire a test event. The error that came back told an open port from a closed one, and an HTTP service from one that is not, which is enough to map what runs inside the container."
tags: ["web", "Python", "ssrf"]
featured: true
---

## Summary

Django Files is a self-hosted file sharing app written in Django. Users can add webhooks
in Settings so the server posts events to a URL they choose, and a Send Test Event button
fires one on demand.

Before 0.18.4 the only check on that URL was that it looked like a URL. A plain user, with
no staff and no superuser rights, could point it at the server's own loopback interface,
click the button, and read back how the connection went. Three different answers came
back depending on what was listening, and that is enough to walk a port range and build a
map of the services running inside the container.

Published as GHSA-78q4-xvhj-c95c, Moderate, CVSS 3.1 5.0, affected versions below 0.18.4,
patched in 0.18.4. I am credited on it as a reporter alongside a second researcher who
reported the same bug separately. More on that below.

## Three answers

Nothing listening on the port:

```json
{"success": false, "error": "[Errno 111] Connection refused"}
```

Port open, but the service does not speak HTTP (this is Redis on 6379):

```json
{"success": false, "error": "Server disconnected without sending a response."}
```

Port open and speaking HTTP:

```json
{"success": false, "status_code": 501}
```

The status code in the third answer is the real one the target returned, not a fixed
value. Closed, open, and open with HTTP behind it. Repeat that across a port range and you
have a map.

## Who can reach it

Any logged in account. Webhooks sit in the user's own Settings, the user controls the
whole URL including the host and the port, and the hook comes back user scoped.

Getting an account is not much of a barrier on a lot of installs either. Django Files has
an invite system and an option for open OAuth registration.

## Where it goes wrong

`_clean_webhook_url` at `app/api/views.py:642` (0.18.3) is the whole check on a saved URL:

```python
def _clean_webhook_url(value) -> tuple:
    if not validators.url(str(value)):
        return None, "Invalid url"
    return value, None
```

`send_webhook` at `app/home/util/webhooks.py:336` then hands it straight to httpx:

```python
return httpx.post(webhook.url, content=body, headers=headers, timeout=30)
```

and the test view at `app/api/views.py:808-811` returns whatever happened:

```python
except httpx.HTTPError as error:
    log.warning("webhook_test_view: %s - %s", webhook_id, error)
    return JsonResponse({"success": False, "error": str(error)})
return JsonResponse({"success": r.is_success, "status_code": r.status_code})
```

`str(error)` is the raw httpx error text. That is where connection refused and server
disconnected turn into two different answers.

The part that made this worth reporting is that the project already had the right guard.
`remote_url_error` at `app/api/utils.py:15` allows only http and https, resolves the
hostname, and rejects the URL if any resolved address is not public. The remote file
download path used it, and re-checked it on every redirect hop. The webhook path never
called it.

## Steps to reproduce

1. Log in as a normal user with no staff or superuser rights.
2. Go to Settings and add a webhook.
3. Set the URL to `http://127.0.0.1:6379` and save.
4. Click Send Test Event. The answer is that the server disconnected without sending a
   response, so the port is open.
5. Change the URL to a port with nothing on it, for example `http://127.0.0.1:9090`, and
   fire it again. The answer is now connection refused.

The difference between those two answers is what separates an open port from a closed
one.

The same thing works through the API with a regular user's session. Setting the URL:

```
PATCH /api/webhooks/4/ HTTP/1.1
Host: 192.168.1.201:8090
Content-Type: application/json
Cookie: sessionid=<regular user session>

{"name":"Redis Port","webhook_type":"custom","scope":"user","url":"http://127.0.0.1:9090","secret":"","active":true,"events":[],"filters":{}}
```

Firing it:

```
POST /api/webhooks/4/test/ HTTP/1.1
Host: 192.168.1.201:8090
Cookie: sessionid=<regular user session>
```

## Proving the boundary

Two things needed proving: that the account really was a plain user, and that the server
really made the connections rather than the app guessing.

The webhook was created and fired from the account `usera`. Straight from the database:

```
1 anonymous staff= False super= False
2 admin     staff= True  super= True
3 usera     staff= False super= False
```

Both flags are False on that account.

For the second, I started a plain HTTP listener inside the container, on a port that is
not published and cannot be reached from outside it, and pointed a webhook at it. The
listener logged the incoming request:

```
172.29.0.2 - - [28/Sep/2026 17:16:16] code 501, message Unsupported method ('POST')
172.29.0.2 - - [28/Sep/2026 17:16:16] "POST / HTTP/1.1" 501 -
```

The source address is the container itself, and the request arrived on a port nothing
outside the container can talk to. The app really does make the connection.

## The ceiling, honestly

I could not read any response content back out. The test endpoint returns a success flag
and a status code and nothing else, and the body the app sends is JSON encoded, so I could
not push raw bytes into a service like Redis either. What is proven is port and service
discovery, not data theft.

In the test install the loopback services included Redis on 6379 and tusd on 8080.
Neither is exposed outside the container. A user with no shell on the machine should not
be able to learn that they exist.

## Two reports, one advisory

I reported this privately through GitHub as GHSA-fw79-v2qg-7gvh. Another researcher
reported the same bug separately as GHSA-78q4-xvhj-c95c, with a proof of concept aimed at
the cloud metadata address `169.254.169.254` instead of loopback. The maintainer published
GHSA-78q4-xvhj-c95c, credited both of us as reporters on it, and closed
GHSA-fw79-v2qg-7gvh the same minute. That is why the identifier on this page is not the
one I filed under, and why GHSA-fw79-v2qg-7gvh has no public page.

The published advisory scores it CVSS 3.1 5.0 with scope changed. My own report scored it
4.3 with scope unchanged, and also tagged CWE-204 for the response discrepancy. This page
uses the published advisory's score and CWE.

## The fix

Two changes, both in 0.18.4.

[#445](https://github.com/django-files/django-files/pull/445), commit
[517c6750](https://github.com/django-files/django-files/commit/517c6750aee65253ac5c8a2dff4947f1a71357c8),
moved `remote_url_error` into a shared `app/home/util/urls.py` and runs it on webhook URLs
when they are saved and again before every delivery, for custom and Discord hooks alike.
That is the check at save time and at send time that my report asked for. Redirects are
turned off, a delivery that fails the check is skipped rather than retried, and the test
view now answers every other delivery failure with the same `Webhook delivery failed.`
message instead of the raw httpx error. This first went out in 0.18.4-beta.0.

[#447](https://github.com/django-files/django-files/pull/447), commit
[f5214ff9](https://github.com/django-files/django-files/commit/f5214ff9fa6cc67aed2346cfb6bf127418dc13b1),
closed a DNS rebinding bypass of that check. `remote_url_error` resolved the hostname and
checked it, then httpx resolved it again when it connected, so a hostname that answered
with a public address the first time and `127.0.0.1` the second got through. The pull
request says this was verified against 0.18.4-beta.0. Webhook deliveries and remote
downloads now go through a transport that re-checks the addresses at connect time and
dials the address it vetted.

0.18.4 is the version to be on.

## Timeline

- 2026-09-28: found while testing a local install as a plain user, reported privately
  through GitHub private vulnerability reporting as GHSA-fw79-v2qg-7gvh
- 2026-10-26: first fix merged in #445 and shipped in 0.18.4-beta.0
- 2026-11-18: DNS rebinding follow-up merged in #447, and 0.18.4 released
- 2026-11-18: GHSA-78q4-xvhj-c95c published by the maintainer, Moderate, CVSS 3.1 5.0,
  crediting me as a reporter alongside the other researcher. GHSA-fw79-v2qg-7gvh closed.
