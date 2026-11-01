export type OrderStatus = 'new' | 'pending_customer' | 'approved' | 'delivered' | 'partial' | 'cancelled';
export type PaymentState = 'pending' | 'paid' | 'failed' | 'cancelled';
// אמצעי התשלום הבסיסיים נעולים ברשימות המערכת; אפשר להוסיף אחרים, לכן המזהה הוא מחרוזת
export type PaymentMethod = 'credit' | 'account' | 'cash' | (string & {});

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'חדשה',
  pending_customer: 'ממתינה לאישור לקוח',
  approved: 'אושרה',
  delivered: 'סופקה',
  partial: 'סופקה חלקית',
  cancelled: 'בוטלה',
};
export const CLOSED: OrderStatus[] = ['delivered', 'partial', 'cancelled'];

export const PAYMENT_LABEL: Record<PaymentState, string> = {
  pending: 'ממתין לתשלום',
  paid: 'שולם',
  failed: 'חיוב נכשל',
  cancelled: 'בוטל',
};
export const METHOD_LABEL: Record<string, string> = {
  credit: 'אשראי',
  account: 'הקפה',
  cash: 'מזומן',
};

export type Branch = { id: string; name: string; cluster: string; phone: string };

export type OrderItem = { itemId?: string; name: string; qty: number; unitPrice: number };

export type Order = {
  id: number;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  branchId: string;
  branchName: string;
  cluster: string; // שם האשכול, קפוא ביום ההזמנה
  branchPhone: string;
  amount: number; // הסכום לחיוב, לפי הסגירה מול הלקוח
  calcAmount?: number; // הסכום המחושב מהפריטים – נשמר רק כשהסכום לחיוב שונה ידנית
  qNumber?: string;
  qAmount?: number;
  status: OrderStatus;
  branchApproval?: { manager: string; at: string };
  payment: PaymentState;
  method: PaymentMethod;
  methodLabel?: string;
  accountPhone?: string;
  handler: string;
  handlerUid?: string;
  channel: string;
  delivery: 'delivery' | 'pickup';
  address?: string;
  contactName?: string;
  contactPhone?: string;
  poRequired: boolean;
  poNumber?: string;
  items: OrderItem[];
  contents?: string; // תכולה במילים: "12 משפחתיות, 6 שתייה" – בעיקר בהזמנה מהירה
  deliveryFee?: number; // דמי משלוח, כלולים בסכום ההזמנה
  instructions?: string;
  note?: string; // הערה פנימית שנרשמה ביצירה
  notes: { by: string; at: string; text: string }[];
  createdBy: string;
  createdByUid?: string;
  createdAt: string; // YYYY-MM-DD
  billingNote?: string;
  partialNote?: string; // מה סופק בפועל, בסגירה "סופקה חלקית"
  cancelReason?: string;
  /* אישורים שמנקים חריג (אפיון 9): פער מול Q שהוסבר, וביטול שבוצע גם בקופה */
  qGapAck?: { amount: number; qAmount: number; by: string; at: string; note?: string };
  qCancelAck?: { by: string; at: string };
  cancelNote?: string;
};
