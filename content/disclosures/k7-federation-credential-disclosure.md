---
title: "Unauthenticated peer requests flood the pending list and leak peer credentials on approval"
target: "kaybi-gh/K7"
target_url: "https://github.com/kaybi-gh/K7"
bug_class: "Resource allocation without limits + sensitive information in error messages (CWE-770, CWE-209)"
severity: "Moderate / credential disclosure"
discovery_method: "Black-box testing against two local federated instances, Burp Repeater"
disclosed: 2026-09-02
status: "published"
advisory_url: "https://github.com/kaybi-gh/K7/security/advisories/GHSA-p4fh-487r-9cjc"
ghsa: "GHSA-p4fh-487r-9cjc"
ghsa_url: "https://github.com/kaybi-gh/K7/security/advisories/GHSA-p4fh-487r-9cjc"
cwe: ["CWE-770", "CWE-209"]
patched_in: "1.9.1"
credit: "Credited as reporter on GHSA-p4fh-487r-9cjc"
summary: "POST /api/federation/peer-request takes no authentication and no valid token. Anyone who can reach the port can write attacker-chosen entries into the admin's pending list, and approval sends three secrets to a URL the attacker picked."
tags: ["web", "black-box", "credential-disclosure", "ssrf"]
featured: false
---

## Summary

K7 lets two instances federate so friends can share libraries. The handshake starts
with `POST /api/federation/peer-request`, which is deliberately unauthenticated so a
remote server can ask to link up.

The request carries a display name, a callback URL and a token, all three chosen by
whoever sends it. The token is never validated, it is just echoed back later. So any
unauthenticated party who can reach the port can write arbitrary entries into the
administrator's pending-peers list, with no rate limit and no cap.

If the administrator approves one of those entries, the server posts `clientId`,
`clientSecret` and `federationAssertionSecret` to the attacker's URL. Those are real
OAuth2 client credentials. They exchange at `/connect/token` for an access token with
the `peer` scope, which reads the victim's federation endpoints.

## The chain, every step confirmed live

Two extra K7 instances were stood up locally to test this properly, since federation
needs a second peer to talk to.

1. `POST /api/federation/peer-request` with no cookie and an invented token of `AAAA`
   returns 200.
2. The entry lands in the admin's pending list with the attacker's name and URL.
3. On approve, a netcat listener on the attacker host receives all three secrets, with
   the `AAAA` token echoed back unchanged.
4. `grant_type=client_credentials&scope=peer` against `/connect/token` returns a Bearer
   token.
5. That token reads `GET /api/federation/libraries` on the victim.

## What I checked that was NOT vulnerable

This part went in the report on purpose. A report that only lists what broke leaves the
maintainer guessing how far the problem reaches.

- `requesterName` is HTML-escaped in the admin panel. No XSS.
- The `peer` scope is properly confined. The token returns 403 on `/api/users`,
  `/api/libraries`, `/api/medias`, `/api/users/me` and `/api/federation/peers`.
- With federation disabled, which is the default, the initial request is rejected
  outright with a clear 403.

## Related finding: the peer URL guard only blocks loopback

`PeerUrlValidator` rejects loopback but allowed other internal destinations. Four
distinct responses came back depending on what was behind the address: a request
received on an external host I controlled, `The response ended prematurely` on an
internal non-HTTP port, a 500 on an internal HTTP service, and connection refused on a
closed port.

Four distinguishable states is a working internal port scanner. It also means the
callback URL in step 3 can point inward rather than outward.

## Honest limits

Federation is off by default and an administrator has to click approve. That makes the
credential half a social-engineering step rather than a straight unauthenticated
compromise, and the report said so in its own preconditions section rather than leaving
the maintainer to find it.

What stands on its own without any admin action is the unauthenticated, unlimited write
into the pending list.

## What shipped in 1.9.1

Rate limit of 10 requests per 10 minutes per IP, a cap of 25 pending requests, generic
outbound handshake errors so the four states collapse into one, and the accept dialog
now redisplays the requester URL before credentials go out.
