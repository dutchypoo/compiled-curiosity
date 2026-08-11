# Compiled Curiosity — full setup & deploy guide

This is the complete, no-stone-unturned walkthrough: install the tools, run the site
locally, write/edit/delete posts, and deploy it live. Every command is spelled out and
every flag is explained. Where a helper script exists, the manual (script-free) way is
shown too.

> **The mental model.** There is no database server and no admin page. Your content is
> Markdown files in `content/`, tracked by git. *Publishing = committing a file. Deleting
> = deleting a file.* Git is the datastore, the backup, and the history. This is the whole
> point of the design: nothing to log into, nothing to breach at runtime.

---

## 1. Prerequisites

You need two things: **Node.js 22.12 or newer** and **git**.

### On the Debian server (spudnik) or any Debian/Ubuntu box

Install git:

```bash
sudo apt-get update           # refresh the package index
sudo apt-get install -y git    # -y answers "yes" to the install prompt automatically
```

Install Node.js 22. The version in Debian's own repos is usually too old for Astro 7, so
use one of these:

**Option A — NodeSource (system-wide):**

```bash
# download NodeSource's setup script for the 22.x line and run it with sudo.
# -fsSL: -f fail on HTTP errors, -s silent, -S still show errors, -L follow redirects.
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
# -E preserves your environment through sudo; the trailing - lets bash read from stdin.

sudo apt-get install -y nodejs   # installs node + npm from the repo just added
```

**Option B — nvm (per-user, no sudo, easy to switch versions):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close and reopen your terminal (or: source ~/.bashrc) so nvm loads
nvm install 22    # download + install the latest Node 22.x
nvm use 22        # activate it in this shell
nvm alias default 22   # make it the default for new shells
```

Verify both:

```bash
node -v    # should print v22.12.0 or higher
npm -v     # any recent 10.x/11.x is fine
git --version
```

### On the Kali laptop

Same as above — Kali is Debian-based, so the `apt-get`/nvm instructions apply unchanged.

---

## 2. Get the code and run it locally

From the folder that contains this repo:

```bash
npm install
```

`npm install` reads `package.json`, downloads the dependencies (Astro + the RSS and
sitemap integrations) into `node_modules/`, and writes `package-lock.json` (the exact
resolved versions). Run it once after cloning, and again whenever dependencies change.

Now start the dev server:

```bash
npm run dev
```

This runs `astro dev`. It serves the site at **http://localhost:4321** with live reload —
edit a file, save, and the browser updates. Press `Ctrl-C` to stop. Use this while
writing.

To produce the real, deployable site:

```bash
npm run build     # runs `astro build` → writes the finished static site into dist/
npm run preview   # runs `astro preview` → serves dist/ locally so you can check the build
```

`dist/` is what gets deployed. You never edit it by hand; it's regenerated every build.

> **Expected warning.** Until you add your first writeup or note, the build prints
> `The collection "writeups" does not exist or is empty`. That is normal and harmless —
> the empty-state pages still build. The warning disappears once a post exists.

---

## 3. Writing content

All posts are Markdown files under `content/`:

```
content/disclosures/   ← vulnerability disclosures (4 real ones are already here)
content/writeups/      ← CTF / lab writeups (empty)
content/notes/         ← short notes (empty)
```

Each file has a **frontmatter** block (the `--- … ---` header of typed fields) followed by
the Markdown body. The fields are validated on every build by `src/content.config.ts`, so
a missing or malformed field fails the build with a message naming the file and field —
that's the safety net, not a bug.

### 3a. Add a post (the easy way)

```bash
npm run new disclosure "Heap overflow in libfoo BMP parser"
```

This runs `scripts/new-post.sh`, which:

- turns the title into a filename slug (lowercase, spaces → dashes),
- creates `content/disclosures/heap-overflow-in-libfoo-bmp-parser.md`,
- pre-fills every frontmatter field with placeholders,
- sets `draft: true` so it won't publish until you're ready,
- refuses to overwrite a file that already exists.

The same command works for the other two types:

```bash
npm run new writeup "TryHackMe: Blue"
npm run new note    "Choosing an under-fuzzed target"
```

Then: open the file, fill in the fields and body, and change `draft: true` to
`draft: false`. Preview with `npm run dev`, then commit (section 3d).

### 3b. Add a post (the manual way, no script)

The script just writes a template — you can do it by hand. Copy an existing post and edit
it:

```bash
cp content/disclosures/bagder-c-comments-cstrip-null-deref.md \
   content/disclosures/my-new-finding.md
# then edit content/disclosures/my-new-finding.md
```

…or create the file from scratch with any editor. A minimal valid disclosure is just the
frontmatter (see the field reference in section 4) plus a Markdown body. The **filename
without `.md` becomes the URL**: `content/disclosures/my-new-finding.md` →
`/disclosures/my-new-finding`.

### 3c. Edit an existing post

Open the `.md` file and change it — frontmatter, body, or both. Save. `npm run dev` shows
it live. That's the whole edit flow. (To rename a post's URL, rename the file.)

### 3d. Publish (commit to git)

Nothing is live until you commit and push. Each command explained:

```bash
git add content/disclosures/my-new-finding.md
# stage the file — tell git you want this change in the next commit

git commit -m "add: heap overflow in libfoo BMP parser"
# record the staged change to history. -m provides the commit message inline.

git push
# upload your commits to the remote (GitHub). This is what triggers a live redeploy
# on Cloudflare Pages / Netlify.
```

To stage everything you changed at once, `git add -A` (`-A` = all changes: new, modified,
and deleted files).

### 3e. Delete a post

Delete the file, then do a **clean** rebuild locally:

```bash
rm content/writeups/old-writeup.md   # remove the source file

npm run rebuild
# runs `npm run clean` (deletes dist/, .astro/, and node_modules/.astro/) then `astro build`.
```

Why the clean step: Astro keeps a content cache in `node_modules/.astro/`. A plain
`npm run build` can leave the deleted post's page behind locally. `npm run rebuild` clears
that cache so the delete actually takes effect. **On the live host this is automatic** —
Cloudflare Pages and Netlify build from a fresh checkout every time, so a deleted file is
simply gone. Then commit the deletion:

```bash
git add -A
git commit -m "remove: old writeup"
git push
```

### 3f. The draft flag

Every post has `draft: true|false`. `draft: true` posts are excluded from the site, the
section lists, and the RSS feed — but the file still lives in git. Use it to work on a post
over several sittings, then flip to `draft: false` to publish.

---

## 4. Frontmatter field reference

### Disclosures (`content/disclosures/*.md`)

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Shown as the card + page heading |
| `target` | yes | e.g. `mattn/http-server` |
| `target_url` | yes | Must be a valid URL |
| `bug_class` | yes | e.g. `Heap buffer overflow (CWE-122)` |
| `severity` | yes | Free text, e.g. `High / DoS`. Contains "High"/"Critical" → pink badge |
| `cvss` | no | e.g. `7.5` (leave `""` if none) |
| `discovery_method` | yes | e.g. `libFuzzer + ASan/UBSan` |
| `disclosed` | yes | `YYYY-MM-DD` |
| `status` | yes | `open`, `fixed`, or `published` |
| `advisory_url` | yes | Link to the issue/GHSA (valid URL) |
| `cve` | no | e.g. `CVE-2026-12345` |
| `credit` | no | Free text |
| `summary` | yes | 1–2 sentences, shown on the card |
| `tags` | no | List, e.g. `["C", "fuzzing"]` |
| `featured` | no | `true` highlights one card on the homepage |
| `draft` | no | `true` hides it |

### Writeups (`content/writeups/*.md`)

| Field | Required | Notes |
|---|---|---|
| `title` | yes | |
| `platform` | yes | e.g. `TryHackMe` |
| `room_url` | no | Valid URL if present |
| `difficulty` | no | e.g. `Easy` |
| `date` | yes | `YYYY-MM-DD` |
| `summary` | yes | Shown on the card |
| `tags` | no | List |
| `tools_used` | no | List |
| `draft` | no | |

### Notes (`content/notes/*.md`)

| Field | Required | Notes |
|---|---|---|
| `title` | yes | |
| `date` | yes | `YYYY-MM-DD` |
| `summary` | no | |
| `tags` | no | List |
| `draft` | no | |

To change your name, email, GitHub link, or domain, edit **`src/consts.ts`** — it feeds
every page.

---

## 5. Put the repo on GitHub

Both hosted deploy options read from a git remote. One-time setup:

```bash
git init                     # start tracking this folder with git (skip if already done)
git add -A                   # stage everything
git commit -m "initial commit"

# create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/dutchypoo/compiled-curiosity.git
git branch -M main           # name the branch "main"
git push -u origin main      # push and set the upstream so future `git push` is enough
```

`.gitignore` already excludes `node_modules/`, `dist/`, `.astro/`, and `.env`, so only
source is committed.

---

## 6. Deploy

Pick one. **Cloudflare Pages is the easiest** and is recommended.

### Option A — Cloudflare Pages (recommended: free, fast, auto-HTTPS)

1. Push the repo to GitHub (section 5).
2. Go to the Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**. Authorize GitHub and pick the `compiled-curiosity` repo.
3. Build settings:
   - **Framework preset:** Astro (or "None" — it doesn't matter, the commands below are
     what count)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - The repo includes a `.node-version` file pinning Node 22, so the build uses the right
     Node automatically.
4. Click **Save and Deploy**. Cloudflare installs deps, runs the build, and serves the
   result. The `public/_headers` file is applied automatically — your security headers are
   live with no extra config.
5. **Custom domain:** in the Pages project → **Custom domains** → **Set up a custom
   domain** → add `www.compiledcuriosity.net` (and `compiledcuriosity.net`). If the domain
   is already on Cloudflare, the DNS records are created for you. If not, Cloudflare shows
   the exact CNAME to add at your registrar.

Every `git push` to `main` from then on redeploys automatically.

### Option B — Netlify (alternative)

1. Push the repo to GitHub.
2. Netlify → **Add new site** → **Import an existing project** → pick the repo.
3. Netlify reads `netlify.toml` from the repo, which already sets the build command
   (`npm run build`), the publish directory (`dist`), the Node version, and all the
   security headers. Just confirm and deploy.
4. **Custom domain:** Site settings → **Domain management** → add
   `www.compiledcuriosity.net`. Netlify shows the DNS records to set.

### Option C — Self-host on spudnik (nginx + Let's Encrypt)

More control, more upkeep. Do this only if you specifically want to host it yourself.

**1. Install nginx and certbot:**

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

**2. Build the site and place it in the web root:**

```bash
# on the server, in the repo folder:
npm ci            # like npm install but strictly from package-lock.json (reproducible)
npm run build
sudo mkdir -p /var/www/compiledcuriosity
sudo rsync -a --delete dist/ /var/www/compiledcuriosity/
# rsync -a = archive (preserve perms/times), --delete = remove files no longer in dist
```

**3. Create the nginx server block** at `/etc/nginx/sites-available/compiledcuriosity`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name compiledcuriosity.net www.compiledcuriosity.net;

    root /var/www/compiledcuriosity;
    index index.html;

    # --- security headers (mirror of public/_headers) ---
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'none'; font-src 'self'; connect-src 'self'; manifest-src 'self'; upgrade-insecure-requests" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), microphone=(), midi=(), payment=(), usb=(), interest-cohort=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    # serve security.txt as plain text
    location = /.well-known/security.txt { default_type text/plain; }

    # map /path and /path/ to the built /path/index.html; fall back to 404
    location / { try_files $uri $uri/ $uri.html =404; }
    error_page 404 /404.html;

    gzip on;
    gzip_types text/css application/xml image/svg+xml application/rss+xml;
}
```

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/compiledcuriosity /etc/nginx/sites-enabled/
sudo nginx -t          # test the config for syntax errors before applying
sudo systemctl reload nginx
```

**4. Get HTTPS** (point DNS at the server first — section 7):

```bash
sudo certbot --nginx -d compiledcuriosity.net -d www.compiledcuriosity.net
```

Certbot obtains the certificate, rewrites the server block to listen on 443, and adds an
HTTP→HTTPS redirect. It also installs a renewal timer.

**5. (Optional) Auto-rebuild on push.** Create a bare repo with a `post-receive` hook so
`git push` to the server rebuilds and redeploys:

```bash
# hook at /home/git/compiledcuriosity.git/hooks/post-receive (chmod +x it):
#!/bin/bash
set -e
SRC=/var/www/compiledcuriosity-src
git --work-tree="$SRC" --git-dir=/home/git/compiledcuriosity.git checkout -f main
cd "$SRC"
npm ci
npm run build
rsync -a --delete "$SRC/dist/" /var/www/compiledcuriosity/
```

Then add that server as a git remote and push to it to deploy.

---

## 7. DNS for compiledcuriosity.net

The canonical URL is **https://www.compiledcuriosity.net** (set in `astro.config.mjs`).

- **Cloudflare Pages / Netlify:** the platform's custom-domain screen tells you the exact
  records — usually a `CNAME` for `www` pointing at the platform, and an apex record that
  the platform provisions for you. Follow what it shows; don't guess.
- **Self-host:** point both names at spudnik's public IP.

| Type | Name | Value |
|---|---|---|
| `A` | `@` (apex) | your server's IPv4 |
| `A` | `www` | your server's IPv4 |
| `AAAA` | `@` / `www` | your server's IPv6 (if you have one) |

Redirect the apex to `www` (or vice-versa) so there's one canonical host. On Cloudflare/
Netlify this is a checkbox; self-hosted, add a small redirect server block.

---

## 8. Verify the live deployment

```bash
curl -I https://www.compiledcuriosity.net
# -I fetches headers only. Confirm: 200, and the security headers are present.

curl -sI https://www.compiledcuriosity.net | grep -i content-security-policy
# -s silent, -I headers only. Confirms the CSP is being served.

curl https://www.compiledcuriosity.net/.well-known/security.txt
# should return the RFC 9116 file as plain text

curl -so /dev/null -w "%{http_code}\n" https://www.compiledcuriosity.net/nope
# -o /dev/null discards the body, -w prints the status code. Expect 404.
```

Then run the site through a scanner like **securityheaders.com** or the **Mozilla
Observatory** — with this config you should score at or near the top.

---

## 9. Maintenance

- **Dependency audits:** `npm run audit` runs `npm audit --omit=dev --audit-level=high`
  and exits non-zero on any high/critical advisory. Run it before deploying, and consider
  a CI step (a GitHub Action running `npm ci && npm run audit && npm run build`) so a
  vulnerable dependency blocks the deploy.
- **Updating dependencies:** `npm update` within the current major ranges, or bump the
  versions in `package.json` deliberately and re-test with `npm run build` + `npm run
  audit`.
- **After deleting a post locally:** `npm run rebuild` (clean build). Live hosts don't need
  this.
- **security.txt:** bump the `Expires` date in `public/.well-known/security.txt` about once
  a year.
- **Backups:** none required beyond git. Your commit history is the backup and the audit
  trail.

---

## 10. Troubleshooting

- **`The collection "writeups"/"notes" does not exist or is empty`** — normal until you add
  the first post of that type. Harmless.
- **A deleted post still shows locally** — you ran `npm run build` instead of
  `npm run rebuild`. Run `npm run rebuild` to clear the `node_modules/.astro` content
  cache. (Live deploys are unaffected — they build fresh each time.)
- **Build fails with a frontmatter/zod error** — a post has a missing or malformed field.
  The error names the file and the field; fix that field. This is the schema catching a
  mistake before it ships.
- **Build fails on the host with a Node/engine error** — the host is on an old Node. The
  `.node-version` file pins 22; make sure the platform respects it, or set `NODE_VERSION`
  to `22` in the platform's build environment.
- **Headers missing on the live site** — on Pages/Netlify confirm `_headers` /
  `netlify.toml` are in the repo root of what was deployed; self-hosted, re-check the
  `add_header … always;` lines and `sudo nginx -t`.
