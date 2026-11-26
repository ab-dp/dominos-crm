/* ערוץ ההזמנה – רשימה סגורה (הגדרות ← רשימות ← ערוצי קבלה, settings/lists.channels).
   בהזמנה נשמרים channelId (מזהה הפריט ברשימה) ו-channel (השם בזמן השמירה – לגרסאות ישנות ולייצוא).
   פונקציה אחת קובעת את שם הערוץ בכל מקום (טבלה, כרטיס, דוחות, ייצוא, בורד, סינון): channelLabel.
   כך שינוי שם ברשימה לא מפצל את הפילוח לשניים, והשבתה לא מעלימה את הערוץ מהזמנות שכבר שויכו אליו.
   הרשימה הנוכחית נקבעת מה-store בזמן ריצה (setChannels), כמו פיצול האיחורים – כדי שהפונקציות הטהורות לא יקבלו אותה בכל קריאה. */
import type { ListItem } from './lists';
import type { Order } from './types';

/* הזמנה ישנה עם טקסט חופשי בלי channelId – מקובצת כאן, כדי שהסכומים יתאימו לשאר המסכים */
export const UNCLASSIFIED = 'לא מסווג';
export const UNCLASSIFIED_TEXT = 'לא מסווג (טקסט ישן)';

let current: ListItem[] = [];
export const setChannels = (list: ListItem[]) => { current = list; };
export const getChannels = () => current;

/* channelId → השם הנוכחי ברשימה (גם פריט מושבת). בלי channelId: טקסט ישן → "לא מסווג", ריק → '' */
export function channelLabel(o: Pick<Order, 'channelId' | 'channel'>, channels: ListItem[] = current): string {
  if (o.channelId) return channels.find((c) => c.id === o.channelId)?.label ?? (o.channel?.trim() || o.channelId);
  return o.channel?.trim() ? UNCLASSIFIED : '';
}

/* הטקסט החופשי הישן לייצוא: מה שנשמר ב-channelLegacy, ואם עוד לא נבחר ערוץ – הטקסט שבשדה channel. ריק כשאין */
export const channelLegacyText = (o: Pick<Order, 'channelId' | 'channel' | 'channelLegacy'>) => o.channelLegacy || (!o.channelId ? o.channel?.trim() ?? '' : '');

/* חסר ערוץ = אין channelId וגם אין טקסט ישן (הזמנה ישנה עם טקסט לא נחשבת חסרה) */
export const hasChannel = (o: Pick<Order, 'channelId' | 'channel'>) => !!o.channelId || !!o.channel?.trim();

/* חיפוש לפי מספר קריאה (callRef) – בטבלת ההזמנות ובחיפוש הכללי */
export const callRefMatch = (o: Pick<Order, 'callRef'>, q: string) => !!q && !!o.callRef && o.callRef.toLowerCase().includes(q.trim().toLowerCase());
