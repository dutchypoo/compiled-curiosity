// Single source of truth for site identity. Edit here, not in every file.
export const SITE = {
  name: 'Compiled Curiosity',
  domain: 'https://www.compiledcuriosity.net',
  tagline: 'Finding and reporting vulnerabilities in open source software.',
  description:
    'Vulnerability research and responsible disclosure in open source software by dutchypoo.',
  author: 'dutchypoo',
  github: 'https://github.com/dutchypoo',
  email: 'augustwas@compiledcuriosity.net',
  // Update this once you push the site repo (used for the "source" footer link).
  repo: 'https://github.com/dutchypoo/compiled-curiosity',
};

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const monthYear = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
