import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Bill, BillItem, BillStatus, PAY_MODES, PayMode, STATUS_LABEL, billTotals, calc } from '../billing/model/billing.model';
import { BillingService } from '../../services/billing_service';

type Modal = 'new' | 'pay' | 'view' | null;
const blankItem = (): BillItem => ({ description: '', qty: 1, price: 0 });

@Component({
  selector: 'app-billing',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
  host: { '(document:keydown.escape)': 'closeModal()' },
})
export class BillingComponent {
  private svc = inject(BillingService);
  private toastTimer?: ReturnType<typeof setTimeout>;

  loading = this.svc.loading;
  error = this.svc.error;
  modes = PAY_MODES;
  label = STATUS_LABEL;
  totals = billTotals;
  filters: ('all' | BillStatus)[] = ['all', 'pending', 'partial', 'paid', 'cancelled'];

  // ── ui state ───────────────────────────────────────────────
  filter = signal<'all' | BillStatus>('all');
  search = signal('');
  modal = signal<Modal>(null);
  target = signal<Bill | null>(null);
  toast = signal('');

  // new-bill draft
  name = signal(''); phone = signal('');
  items = signal<BillItem[]>([blankItem()]);
  discount = signal(0); taxPct = signal(0);
  showErrors = signal(false);
  draft = computed(() => calc(this.items(), this.discount(), this.taxPct()));

  // payment draft
  payAmount = signal(0);
  payMode = signal<PayMode>('cash');

  // ── data the page shows ────────────────────────────────────
  rows = computed(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    return this.svc.bills()
      .filter(b => (f === 'all' || b.status === f) && (!q || `${b.number} ${b.patientName} ${b.phone}`.toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  stats = computed(() => {
    const t = this.svc.today().map(b => billTotals(b));
    const sum = (k: 'total' | 'paid' | 'due') => t.reduce((s, x) => s + x[k], 0);
    return [
      { label: 'Billed today', value: sum('total'), money: true, tone: 'blue' },
      { label: 'Collected', value: sum('paid'), money: true, tone: 'green' },
      { label: 'Outstanding', value: sum('due'), money: true, tone: 'amber' },
      { label: 'Bills today', value: t.length, money: false, tone: 'violet' },
    ];
  });

  counts = computed(() => {
    const c: Record<string, number> = { all: this.svc.bills().length };
    for (const b of this.svc.bills()) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.toastTimer));
  }

  // ── helpers ────────────────────────────────────────────────
  say(msg: string) {
    clearTimeout(this.toastTimer);
    this.toast.set(msg);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3000);
  }
  closeModal() { this.modal.set(null); this.target.set(null); }
  refresh() { this.svc.refresh(); }

  // ── new bill ───────────────────────────────────────────────
  openNew() {
    this.name.set(''); this.phone.set(''); this.items.set([blankItem()]);
    this.discount.set(0); this.taxPct.set(0); this.showErrors.set(false);
    this.modal.set('new');
  }
  addItem() { this.items.update(l => [...l, blankItem()]); }
  removeItem(i: number) { this.items.update(l => (l.length > 1 ? l.filter((_, x) => x !== i) : l)); }
  setItem(i: number, key: keyof BillItem, raw: string) {
    const value = key === 'description' ? raw : Math.max(0, Number(raw) || 0);
    this.items.update(l => l.map((it, x) => (x === i ? { ...it, [key]: value } : it)));
  }
  num = (raw: string) => Math.max(0, Number(raw) || 0);

  save() {
    this.showErrors.set(true);
    const items = this.items().filter(i => i.description.trim() && i.qty > 0);
    if (!this.name().trim() || !items.length) return;
    const b = this.svc.create({
      patientId: null, patientName: this.name().trim(), phone: this.phone().trim(),
      items, discount: this.discount(), taxPct: this.taxPct(),
    });
    this.closeModal();
    this.say(`${b.number} created for ${b.patientName}`);
  }

  // ── payment ────────────────────────────────────────────────
  openPay(b: Bill) {
    this.target.set(b); this.payAmount.set(billTotals(b).due); this.payMode.set('cash'); this.modal.set('pay');
  }
  submitPay() {
    const b = this.target();
    if (!b) return;
    const due = billTotals(b).due;
    const amt = Math.min(this.payAmount(), due);
    if (amt <= 0) return;
    this.svc.pay(b.id, amt, this.payMode());
    this.say(`${amt === due ? 'Paid in full' : 'Part payment saved'} · ${b.number}`);
    this.closeModal();
  }

  view(b: Bill) { this.target.set(b); this.modal.set('view'); }
  cancel(b: Bill) {
    this.svc.cancel(b.id);
    this.say(`${b.number} cancelled`);
    this.closeModal();
  }
  canPay = (b: Bill) => b.status === 'pending' || b.status === 'partial';
}