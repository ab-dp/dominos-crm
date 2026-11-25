/* תגית "לעדכן בתפעול" – תזכורת בלבד (needsOpsUpdate ב-types.ts): הזמנה של היום/מחר שנוצרה או שונתה בפרט שהסניף צריך לדעת
   אחרי שעת הסף ביום שלפני. אותה תגית בטבלת ההזמנות (גם בכרטיס של הטלפון), בתור של מסך היום ובכרטיס ההזמנה ליד הסניף.
   ההסבר המלא בריחוף ובפוקוס (Tip), ובשם הנגיש. */
import { useStore } from '../../data/store';
import { needsOpsUpdate, type Order } from '../../data/types';
import { Tip } from '../../design/components';

export function OpsTag({ o }: { o: Pick<Order, 'status' | 'date' | 'opsChangeAt'> }) {
  const { now, thresholds } = useStore();
  if (!needsOpsUpdate(o, now, thresholds.opsCutoff)) return null;
  const why = `נוצרה או שונתה אחרי ${thresholds.opsCutoff} ביום שלפני`;
  return (
    <Tip label={why}>
      <span className="ops-tag" tabIndex={0} role="note" aria-label={`לעדכן בתפעול: ${why}`}>לעדכן בתפעול</span>
    </Tip>
  );
}
