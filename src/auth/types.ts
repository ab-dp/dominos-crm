import type { Timestamp } from 'firebase/firestore';

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'disabled' | 'deleted';
export type Role = 'user' | 'admin';

export type UserDoc = {
  uid: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  provider: 'google' | 'password';
  requestedAt?: Timestamp;
  lastLogin?: Timestamp;
  approvedBy?: string;
  rejectReason?: string;
  statusChangedAt?: Timestamp;
  statusChangedBy?: string;
};

export const BOOT_ADMIN = 'alonberger16@gmail.com';

export const ROLE_LABEL: Record<Role, string> = { user: 'משתמש', admin: 'מנהל מערכת' };
export const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'ממתין לאישור',
  active: 'פעיל',
  rejected: 'נדחה',
  disabled: 'מושבת',
  deleted: 'נמחק',
};

/* הודעות מצב חשבון (אפיון 11) */
export const STATUS_MESSAGE: Partial<Record<AccountStatus, string>> = {
  rejected: 'בקשת ההרשמה לא אושרה. לפרטים פנה למנהל המוקד.',
  disabled: 'הגישה שלך למערכת הושבתה. לפרטים פנה למנהל המוקד.',
};
