// Single source of truth for site identity. Edit here, not in every file.
export const SITE = {
  name: 'Compiled Curiosity',
  domain: 'https://www.compiledcuriosity.net',
  tagline: 'Memory-safety and logic bugs in open-source C/C++.',
  description:
    'Vulnerability research and responsible disclosure in open-source C/C++ by dutchypoo.',
  author: 'dutchypoo',
  github: 'https://github.com/dutchypoo',
  email: 'wasek.aug@gmail.com',
  // Update this once you push the site repo (used for the "source" footer link).
  repo: 'https://github.com/dutchypoo/compiled-curiosity',
};

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const monthYear = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
