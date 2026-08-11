import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';

export async function GET(context) {
  const disc = await getCollection('disclosures', ({ data }) => !data.draft);
  const wr = await getCollection('writeups', ({ data }) => !data.draft);
  const notes = await getCollection('notes', ({ data }) => !data.draft);
  const items = [
    ...disc.map((e) => ({ title: `[disclosure] ${e.data.title}`, description: e.data.summary, pubDate: e.data.disclosed, link: `/disclosures/${e.id}` })),
    ...wr.map((e) => ({ title: `[writeup] ${e.data.title}`, description: e.data.summary, pubDate: e.data.date, link: `/writeups/${e.id}` })),
    ...notes.map((e) => ({ title: `[note] ${e.data.title}`, description: e.data.summary ?? '', pubDate: e.data.date, link: `/notes/${e.id}` })),
  ].sort((a, b) => +b.pubDate - +a.pubDate);
  return rss({ title: SITE.name, description: SITE.description, site: context.site, items });
}
