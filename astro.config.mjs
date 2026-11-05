import { defineConfig, passthroughImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The canonical URL of the deployed site. Used for sitemap + RSS absolute links.
// Change this if you deploy somewhere else.
export default defineConfig({
  site: 'https://www.compiledcuriosity.net',
  trailingSlash: 'ignore',
  // Unlisted pages (shared by link only) stay out of the sitemap; they also carry noindex.
  integrations: [sitemap({ filter: (page) => !page.includes('/backyard-wars') })],
  image: { service: passthroughImageService() }, // this site processes no images; avoids the sharp dependency path
  markdown: {
    shikiConfig: { theme: 'tokyo-night', wrap: true }, // built-in highlighter; adds no client JS
    smartypants: false, // keep straight quotes and plain dashes, no typographic substitution
  },
  build: { inlineStylesheets: 'never' }, // keep CSS in a linked file (cleaner CSP)
});
