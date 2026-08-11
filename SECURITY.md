# Security posture

This site is built security-first. The short version: **there is no server to attack.**

## Threat model

- **Single trusted author.** All content is written by the site owner and committed to
  git. There is no login, no comment box, no contact form, no user-submitted input of any
  kind.
- **No server-side runtime.** The site is compiled to static HTML/CSS ahead of time and
  served as flat files. There is no database, no API, no auth, no session state — so there
  is no SQL injection, no auth bypass, no server RCE surface.
- **Git is the datastore.** "Publishing" is a git commit. History is versioned and
  revertible. There is nothing to breach at runtime.

## What ships to the browser

- 100% static HTML + one CSS file.
- **Zero JavaScript.** Verified at build time: the `dist/` output contains no `.js`
  files and no `<script>` tags on any page.

## HTTP security headers

Set in `public/_headers` (Cloudflare Pages) and `netlify.toml` (Netlify). For a
self-hosted nginx deploy the same values are provided in `SETUP.md`.

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | see below | Locks down what the page may load/run |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing |
| `X-Frame-Options` | `DENY` | Anti-clickjacking (legacy backup to CSP) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Minimal referrer leakage |
| `Permissions-Policy` | camera/mic/geo/usb/etc. all `()` | Disables powerful browser APIs |
| `Cross-Origin-Opener-Policy` | `same-origin` | Process isolation |
| `Cross-Origin-Resource-Policy` | `same-origin` | Blocks cross-origin embedding of resources |

### Content-Security-Policy

```
default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline';
script-src 'none'; font-src 'self'; connect-src 'self'; manifest-src 'self';
upgrade-insecure-requests
```

Two entries deserve explanation:

- **`script-src 'none'`** — the site runs no JavaScript at all, so scripts are forbidden
  outright. This blocks external scripts, inline `<script>` blocks, **and** inline event
  handlers (`onerror=`, `onclick=`, …). If you ever add a client-side component, relax this
  to `script-src 'self'`.
- **`style-src 'self' 'unsafe-inline'`** — the syntax highlighter (Shiki) writes colors as
  inline `style="…"` attributes on code spans. `'unsafe-inline'` is required for those.
  This is a style-only allowance; **inline styles cannot execute code**, so it does not
  create a scripting risk.

## A note on Markdown and XSS

Astro's Markdown pipeline passes raw HTML through **verbatim** — it does not escape or
sanitize it. This was confirmed directly: a test post containing
`<script>…</script>` and `<img onerror=…>` emitted those tags literally into the HTML.

This is acceptable here for two independent reasons:

1. **There is no untrusted input.** The only person who can add content is the owner, via
   git. An attacker has no path to inject Markdown.
2. **CSP neutralizes it anyway.** Because `script-src 'none'` is enforced, even if a raw
   `<script>` or an inline `onerror=` ended up in a page, the browser refuses to run it.

If this site ever grows an untrusted-input path (comments, a CMS with multiple authors,
user submissions), add `rehype-sanitize` to the Markdown config **before** doing so. Note
that a naïve sanitizer will strip Shiki's inline styles and break code highlighting, so
configure its allow-list to keep `class`/`style` on `span`/`code`/`pre`.

## security.txt

`public/.well-known/security.txt` follows RFC 9116. Two maintenance notes:

- The `Expires` date must stay in the future — bump it about once a year.
- For production you should PGP-sign the file and publish the signature.

## Dependencies

- The dependency surface is deliberately small: Astro + the official RSS and sitemap
  integrations, nothing else.
- `npm run audit` runs `npm audit --omit=dev --audit-level=high` and **fails on any
  high/critical** advisory. Wire this into CI (see `SETUP.md`) so a vulnerable dependency
  blocks deploys.
- No secrets live in the repo. `.env` files are git-ignored.

## Reporting an issue with this site

Email the address in `security.txt`.
