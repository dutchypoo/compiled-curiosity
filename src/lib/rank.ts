// Shared ranking + severity helpers so the home page, the index and the cards
// all agree on what "most severe" means. Single place to change the rule.

export const score = (cvss?: string): number => {
  const n = parseFloat(cvss ?? '');
  return Number.isFinite(n) ? n : 0;
};

/** CVSS band. Falls back to the free-text severity string when there is no score. */
export const band = (cvss?: string, severity?: string): 'high' | 'med' | 'low' => {
  const n = score(cvss);
  if (n >= 7) return 'high';
  if (n >= 4) return 'med';
  if (n > 0) return 'low';
  return /crit|high/i.test(severity ?? '') ? 'high'
       : /medium|moderate/i.test(severity ?? '') ? 'med' : 'low';
};

/**
 * Sort order for every disclosure list on the site:
 * anything with a CVE first, then by CVSS, then newest.
 */
export const bySeverity = (a: any, b: any): number =>
  (b.data.cve ? 1 : 0) - (a.data.cve ? 1 : 0)
  || score(b.data.cvss) - score(a.data.cvss)
  || +b.data.disclosed - +a.data.disclosed;

/** Counts for the scoreboard, derived from the content itself so they never go stale. */
export const tally = (entries: any[]) => ({
  cves: entries.filter((e) => e.data.cve).length,
  advisories: entries.filter((e) => e.data.ghsa).length,
  total: entries.length,
  projects: new Set(entries.map((e) => e.data.target)).size,
  resolved: entries.filter((e) => e.data.status !== 'open').length,
});
