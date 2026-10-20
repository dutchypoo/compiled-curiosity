// Shared ranking + severity helpers so every list on the site agrees on what
// "most severe" means. Single place to change the rule.

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

/** Word shown where a score would go when the advisory carries no CVSS vector. */
export const bandWord = (cvss?: string, severity?: string): string => {
  const b = band(cvss, severity);
  // keep GitHub's own word when that is what the advisory used
  if (!score(cvss) && /moderate/i.test(severity ?? '')) return 'moderate';
  return b === 'high' ? 'high' : b === 'med' ? 'medium' : 'low';
};

/** A finding is "credited" once it carries a CVE or a published GHSA. */
export const isCredited = (e: any): boolean => Boolean(e.data.cve || e.data.ghsa);

/** Ledger order: highest CVSS first, unscored last, newest breaks ties. */
export const byScore = (a: any, b: any): number =>
  score(b.data.cvss) - score(a.data.cvss) || +b.data.disclosed - +a.data.disclosed;

/** Sort used for the full disclosures index: credited first, then by score. */
export const bySeverity = (a: any, b: any): number =>
  (isCredited(b) ? 1 : 0) - (isCredited(a) ? 1 : 0) || byScore(a, b);

/** Counts for the scoreboard, derived from the content so they never go stale. */
export const tally = (entries: any[]) => ({
  cves: entries.filter((e) => e.data.cve).length,
  advisories: entries.filter((e) => e.data.ghsa).length,
  credited: entries.filter(isCredited).length,
  total: entries.length,
  projects: new Set(entries.map((e) => e.data.target)).size,
  resolved: entries.filter((e) => e.data.status !== 'open').length,
});
