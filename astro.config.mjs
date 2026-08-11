import { defineConfig, passthroughImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The canonical URL of the deployed site. Used for sitemap + RSS absolute links.
// Change this if you deploy somewhere else.
export default defineConfig({
  site: 'https://www.compiledcuriosity.net',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  image: { service: passthroughImageService() }, // this site processes no images; avoids the sharp dependency path
  markdown: {
    shikiConfig: { theme: 'tokyo-night', wrap: true }, // built-in highlighter; adds no client JS
  },
  build: { inlineStylesheets: 'never' }, // keep CSS in a linked file (cleaner CSP)
});
