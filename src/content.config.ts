import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Content lives as markdown in /content/<collection>/ at the repo root.
// Adding an entry = add a .md file there and commit. That is the whole "database".

const disclosures = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/disclosures' }),
  schema: z.object({
    title: z.string(),
    target: z.string(),                        // e.g. "mattn/http-server"
    target_url: z.string().url(),
    bug_class: z.string(),                      // e.g. "Heap buffer overflow (CWE-122)"
    severity: z.string(),                       // honest, owner-chosen, e.g. "High / DoS"
    cvss: z.string().optional(),                // e.g. "7.5"
    discovery_method: z.string(),               // e.g. "libFuzzer + ASan/UBSan"
    disclosed: z.coerce.date(),                 // YYYY-MM-DD
    status: z.enum(['open', 'fixed', 'published']).default('open'),
    advisory_url: z.string().url(),             // link to the public issue / GHSA
    cve: z.string().optional(),
    credit: z.string().optional(),
    summary: z.string(),                        // 1-2 sentences, shown on cards
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),       // highlight one card
    draft: z.boolean().default(false),          // hide from build until ready
  }),
});

const writeups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/writeups' }),
  schema: z.object({
    title: z.string(),
    platform: z.string(),                       // "TryHackMe", "HackTheBox", "Personal lab"
    room_url: z.string().url().optional(),
    difficulty: z.string().optional(),          // "Easy / Medium / Hard"
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    tools_used: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { disclosures, writeups, notes };
