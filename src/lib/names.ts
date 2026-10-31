/* זיהוי שמות דומים (אפיון 6.10): "רמת-גן ביאליק" ו"רמת גן – ביאליק" הם אותו סניף,
   כדי שאותו סניף לא יירשם פעמיים בכתיב שונה ויפצל את הדוחות. */

export function normName(s: string): string {
  return s
    .replace(/[֑-ׇ]/g, '') // ניקוד
    .replace(/["'״׳`]/g, '')
    .replace(/[-–—_.,/\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function isSimilar(a: string, b: string): boolean {
  const x = normName(a).replace(/ /g, '');
  const y = normName(b).replace(/ /g, '');
  if (!x || !y) return false;
  if (x === y) return true;
  if ((x.includes(y) || y.includes(x)) && Math.min(x.length, y.length) >= 4) return true;
  return lev(x, y) <= (Math.max(x.length, y.length) > 8 ? 2 : 1);
}

export function findSimilar<T extends { id: string; name: string }>(name: string, list: T[], excludeId?: string): T | undefined {
  return list.find((it) => it.id !== excludeId && isSimilar(it.name, name));
}

/* טלפון: נשמר כספרות בלבד, מוצג 05X-XXXXXXX */
export function cleanPhone(raw: string): string {
  return raw.replace(/\D/g, '');
}
export function phoneError(raw: string): string {
  const d = cleanPhone(raw);
  if (!d) return '';
  return /^0\d{8,9}$/.test(d) ? '' : 'מספר טלפון לא תקין – 9 או 10 ספרות שמתחילות ב-0';
}
