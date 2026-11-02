import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { Bill, BillStatus, NewBill, PayMode, billTotals, calc } from '../pages/billing/model/billing.model';

/** true = static sample data (in memory). Set to false to call your API. */
const USE_MOCK = true;
const API_BASE = 'http://localhost:3000/api';

/**
 * Endpoints used when USE_MOCK = false:
 *   GET   {API_BASE}/billing/bills                 -> Bill[]
 *   POST  {API_BASE}/billing/bills                 -> Bill   (body: NewBill; the server issues the number, e.g. "INV-2026-0007")
 *   POST  {API_BASE}/billing/bills/:id/payments    -> Bill   (body: { amount, mode })
 *   POST  {API_BASE}/billing/bills/:id/cancel      -> Bill
 */
const todayStr = () => new Date().toLocaleDateString('en-CA');
const nowIso = () => new Date().toISOString();

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient); // add provideHttpClient() in app.config.ts

  bills = signal<Bill[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  today = computed(() => this.bills().filter(b => b.date === todayStr() && b.status !== 'cancelled'));

  constructor() { this.refresh(); }

  /** Loads bills (static sample data in mock mode). Also used to roll back after a failed call. */
  refresh(): void {
    this.loading.set(true);
    const source$: Observable<Bill[]> = USE_MOCK
      ? of(this.bills().length ? this.bills() : seedBills()).pipe(delay(250))
      : this.http.get<Bill[]>(`${API_BASE}/billing/bills`);
    source$.subscribe({
      next: l => { this.bills.set(l); this.error.set(null); this.loading.set(false); },
      error: e => { this.error.set(this.message(e)); this.loading.set(false); },
    });
  }

  private patch(id: string, fn: (b: Bill) => Partial<Bill>) {
    this.bills.update(l => l.map(b => (b.id === id ? { ...b, ...fn(b) } : b)));
  }
  private send(req: () => Observable<Bill>, replaceId: string) {
    if (USE_MOCK) return;
    req().subscribe({
      next: b => this.bills.update(l => l.map(x => (x.id === replaceId ? b : x))),
      error: e => { this.error.set(this.message(e)); this.refresh(); },
    });
  }

  create(d: NewBill): Bill {
    const n = this.bills().length + 1;
    const b: Bill = {
      ...d, id: crypto.randomUUID(), number: `INV-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`,
      date: todayStr(), payments: [], status: 'pending', createdAt: nowIso(),
    };
    this.bills.update(l => [b, ...l]);
    this.send(() => this.http.post<Bill>(`${API_BASE}/billing/bills`, d), b.id);
    return b;
  }

  pay(id: string, amount: number, mode: PayMode) {
    const bill = this.bills().find(b => b.id === id);
    if (!bill || amount <= 0) return;
    const payments = [...bill.payments, { amount, mode, at: nowIso() }];
    const next = { ...bill, payments };
    const status: BillStatus = billTotals(next).due === 0 ? 'paid' : 'partial';
    this.patch(id, () => ({ payments, status }));
    this.send(() => this.http.post<Bill>(`${API_BASE}/billing/bills/${id}/payments`, { amount, mode }), id);
  }

  cancel(id: string) {
    this.patch(id, () => ({ status: 'cancelled' }));
    this.send(() => this.http.post<Bill>(`${API_BASE}/billing/bills/${id}/cancel`, {}), id);
  }

  private message(e: any): string {
    return e?.error?.message ?? (e?.status === 0 ? 'Cannot reach the server' : e?.message ?? 'Request failed');
  }
}

/* ---------------- static sample data (in memory) ---------------- */
function seedBills(): Bill[] {
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const rows: [string, string, [string, number, number][], number, number, number, string][] = [
    // patient, phone, items [desc, qty, price], discount, taxPct, paidAmount, paidMode
    ['Priya Sharma',   '9000000001', [['Consultation', 1, 500], ['Blood test (CBC)', 1, 350]],           0, 0, 850, 'upi'],
    ['Daniel Raj',     '9000000002', [['Consultation', 1, 500], ['HbA1c', 1, 600], ['Glucose strips', 2, 150]], 50, 0, 500, 'cash'],
    ['Meena Krishnan', '9000000003', [['Consultation', 1, 500], ['Nebulization', 2, 200]],               0, 0, 0,   'cash'],
    ['Arun Vijay',     '9000000004', [['Cardiology consult', 1, 800], ['ECG', 1, 400], ['Echo', 1, 1800]], 200, 5, 2800, 'card'],
    ['Rahul Menon',    '9000000005', [['Vaccination', 1, 650]],                                          0, 0, 650, 'cash'],
    ['Sana Fathima',   '9000000006', [['Consultation', 1, 400]],                                         0, 0, 0,   'cash'],
  ];
  return rows.map(([patientName, phone, items, discount, taxPct, paid, mode], i): Bill => {
    const its = items.map(([description, qty, price]) => ({ description, qty, price }));
    const total = calc(its, discount, taxPct).total;
    const payments = paid ? [{ amount: paid, mode: mode as PayMode, at: ago(30 - i * 4) }] : [];
    return {
      id: crypto.randomUUID(), number: `INV-${new Date().getFullYear()}-${String(rows.length - i).padStart(4, '0')}`,
      date: todayStr(), patientId: null, patientName, phone, items: its, discount, taxPct, payments,
      status: paid === 0 ? 'pending' : paid >= total ? 'paid' : 'partial', createdAt: ago(60 + i * 15),
    };
  });
}