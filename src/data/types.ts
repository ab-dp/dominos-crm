export type OrderStatus = 'new' | 'pending_customer' | 'approved' | 'delivered' | 'partial' | 'cancelled';
export type PaymentState = 'pending' | 'paid' | 'cancelled';
export type PaymentMethod = 'credit' | 'account' | 'cash';

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
  cancelled: 'בוטל',
};
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  credit: 'אשראי',
  account: 'הקפה',
  cash: 'מזומן',
};

export type Branch = { id: string; name: string; cluster: string; phone: string };

export type OrderItem = { name: string; qty: number; unitPrice: number };

export type Order = {
  id: number;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  branchId: string;
  branchName: string;
  cluster: string;
  branchPhone: string;
  amount: number;
  qNumber?: string;
  qAmount?: number;
  status: OrderStatus;
  branchApproval?: { manager: string; at: string };
  payment: PaymentState;
  method: PaymentMethod;
  accountPhone?: string;
  handler: string;
  channel: 'טלפון' | 'WhatsApp' | 'מייל';
  delivery: 'delivery' | 'pickup';
  address?: string;
  contactName?: string;
  contactPhone?: string;
  poRequired: boolean;
  poNumber?: string;
  items: OrderItem[];
  instructions?: string;
  notes: { by: string; at: string; text: string }[];
  createdBy: string;
  createdAt: string;
  billingNote?: string;
};
