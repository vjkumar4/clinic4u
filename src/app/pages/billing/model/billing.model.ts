export type BillStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type PayMode = 'cash' | 'card' | 'upi' | 'insurance';

export interface BillItem { description: string; qty: number; price: number }
export interface Payment { amount: number; mode: PayMode; at: string }

export interface Bill {
  id: string; number: string; date: string;               // date = YYYY-MM-DD
  patientId: string | null; patientName: string; phone: string;
  items: BillItem[]; discount: number; taxPct: number;    // discount = flat amount
  payments: Payment[]; status: BillStatus; createdAt: string;
}
export type NewBill = Pick<Bill, 'patientId' | 'patientName' | 'phone' | 'items' | 'discount' | 'taxPct'>;

export const PAY_MODES: { key: PayMode; label: string }[] = [
  { key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' }, { key: 'insurance', label: 'Insurance' },
];
export const STATUS_LABEL: Record<BillStatus, string> = {
  pending: 'Pending', partial: 'Partial', paid: 'Paid', cancelled: 'Cancelled',
};

/** Subtotal, discount, tax and total for a set of line items. Used by the form preview and by saved bills. */
export function calc(items: BillItem[], discount: number, taxPct: number) {
  const subtotal = items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
  const disc = Math.min(Math.max(discount || 0, 0), subtotal);
  const tax = Math.round(((subtotal - disc) * (taxPct || 0)) / 100);
  return { subtotal, discount: disc, tax, total: subtotal - disc + tax };
}

/** Totals for a saved bill, including what has been paid and what is still due. */
export function billTotals(b: Bill) {
  const t = calc(b.items, b.discount, b.taxPct);
  const paid = b.payments.reduce((s, p) => s + p.amount, 0);
  return { ...t, paid, due: Math.max(0, t.total - paid) };
}