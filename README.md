# Compiled Curiosity

The vulnerability-research site of **dutchypoo** — disclosures, CTF/lab writeups, and
short research notes. Static, hardened, no database, no JavaScript.

Live site: https://www.compiledcuriosity.net

## Stack

- **[Astro](https://astro.build)** — static site generator. Compiles everything to flat
  HTML at build time.
- **Plain CSS** — one hand-written stylesheet, no framework.
- **Markdown content** in `content/` — your posts. Git is the datastore.
- **Zero JavaScript** ships to the browser. No server, no database, no auth.

Full security rationale is in [`SECURITY.md`](./SECURITY.md).
The complete build-and-deploy walkthrough is in [`SETUP.md`](./SETUP.md).

## Quick start

You need Node.js 22.12+ and git. Then:

```bash
npm install     # install dependencies (one time)
npm run dev      # local dev server with live reload → http://localhost:4321
npm run build    # produce the static site into dist/
npm run preview  # serve the built dist/ locally to check it
```

## How content works

There is no admin panel — and for a security researcher's site, that is the point (an
admin login is the biggest thing an attacker could target). Your content lives as Markdown
files in `content/`, versioned in git. **Adding a post is creating a file and committing
it. Deleting a post is deleting the file and committing.**

```bash
# scaffold a new entry (fills in the correct frontmatter for you)
npm run new disclosure "Heap overflow in libfoo parser"
npm run new writeup    "TryHackMe: Blue"
npm run new note       "Picking an under-fuzzed target"
```

Each command creates a file with `draft: true`. Fill it in, flip to `draft: false`, then
commit. Editing is just editing the file; deleting is deleting it (then `npm run rebuild`
locally — see SETUP for why). Every step, with each command and flag explained, is in
[`SETUP.md`](./SETUP.md).

## Project structure

```
compiled-curiosity/
├─ content/                  ← YOUR POSTS (the "database")
│  ├─ disclosures/           ← one .md per disclosure (4 real ones seeded)
│  ├─ writeups/              ← empty until you add one
│  └─ notes/                 ← empty until you add one
├─ src/
│  ├─ consts.ts              ← site identity (name, email, github) — edit here
│  ├─ content.config.ts      ← frontmatter schemas (validates every post)
│  ├─ styles/global.css      ← the whole design
│  ├─ layouts/Base.astro     ← page shell (head, header, footer)
│  ├─ components/            ← Header, Footer, cards
│  └─ pages/                 ← routes (home, section indexes, per-post, rss, 404)
├─ public/
│  ├─ _headers               ← security headers (Cloudflare Pages)
│  ├─ robots.txt
│  ├─ favicon.svg
│  └─ .well-known/security.txt
├─ scripts/new-post.sh       ← the scaffolder behind `npm run new`
├─ netlify.toml              ← build + security headers (Netlify)
├─ astro.config.mjs
├─ SECURITY.md
└─ SETUP.md
```

## Maintenance

- `npm run audit` — fails on any high/critical dependency advisory.
- `npm run rebuild` — clean rebuild (use after deleting a post locally).
- Backups: none needed beyond git. Your history *is* the backup.
