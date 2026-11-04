/* סיבת כישלון שמירה במילים פשוטות – כדי שלא כל תקלה תיראה כמו "בדוק חיבור".
   הקוד הטכני מופיע בסוגריים, ונרשם גם בקונסול, כדי שאפשר יהיה לאתר את התקלה. */
export function saveError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  console.error('save failed', e);
  if (code === 'permission-denied') return 'השרת דחה את השמירה – אין הרשאה, או שאחד הנתונים לא תקין (permission-denied)';
  if (code === 'unavailable' || /offline|network/i.test(msg)) return 'אין חיבור לשרת – בדוק את האינטרנט ונסה שוב';
  if (code === 'failed-precondition' || code === 'aborted') return `השמירה התנגשה בשינוי אחר באותו זמן – נסה שוב (${code})`;
  if (/invalid data|Nested arrays|Unsupported field/i.test(msg) || code === 'invalid-argument') return 'אחד הנתונים בטופס לא נשמר בפורמט תקין (invalid-argument)';
  return `השמירה נכשלה${code ? ` (${code})` : ''} – נסה שוב`;
}
