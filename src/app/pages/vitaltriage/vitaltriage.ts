import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PRIORITIES, Priority, QueuePatient, QueueStatus, STATUSES, Vitals } from './model/vital.model';
import { VitalsTriageService } from '../../services/vitaltriage';

interface FormState {
  systolic: number | null; diastolic: number | null; pulse: number | null; respRate: number | null;
  temperature: number | null; spo2: number | null; weight: number | null; height: number | null;
  chiefComplaint: string; priority: Priority | ''; allergies: string; nursingNotes: string;
}
const RANK: Record<string, number> = { Emergency: 0, Urgent: 1, Routine: 2, none: 3 };

@Component({
  selector: 'app-vitals-triage',
  imports: [FormsModule],
  templateUrl: './vitaltriage.html',
  styleUrl: './vitaltriage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VitalsTriageComponent {
  private readonly api = inject(VitalsTriageService);

  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  readonly pageSize = 7;

  readonly patients = signal<QueuePatient[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly doctorFilter = signal('');
  readonly statusFilter = signal<QueueStatus | ''>('');
  readonly page = signal(1);
  readonly busyId = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  readonly selected = signal<QueuePatient | null>(null);
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  form: FormState = this.emptyForm();

  constructor() { this.load(); }

  /* ---------- list state ---------- */
  readonly doctors = computed(() => [...new Set(this.patients().map(p => p.doctor))]);
  readonly counts = computed(() => {
    const c: Record<string, number> = {};
    STATUSES.forEach(s => (c[s] = this.patients().filter(p => p.status === s).length));
    return c;
  });
  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase(), d = this.doctorFilter(), s = this.statusFilter();
    return this.patients()
      .filter(p => (!q || (p.name + p.mrn + p.token).toLowerCase().includes(q)) && (!d || p.doctor === d) && (!s || p.status === s))
      .sort((a, b) => Number(a.status === 'Completed') - Number(b.status === 'Completed')
        || RANK[a.vitals?.priority ?? 'none'] - RANK[b.vitals?.priority ?? 'none'] || a.arrivedAt.localeCompare(b.arrivedAt));
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly pageItems = computed(() => {
    const start = (Math.min(this.page(), this.totalPages()) - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });
  readonly pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));
  readonly from = computed(() => (this.filtered().length ? (this.page() - 1) * this.pageSize + 1 : 0));
  readonly to = computed(() => Math.min(this.page() * this.pageSize, this.filtered().length));

  load(): void {
    this.loading.set(true); this.error.set(null);
    this.api.getQueue().subscribe({
      next: list => { this.patients.set(list); this.loading.set(false); },
      error: (e: { message?: string }) => { this.error.set(e?.message ?? 'Could not load the queue.'); this.loading.set(false); }
    });
  }

  setFilter(kind: 'search' | 'doctor' | 'status', value: string): void {
    if (kind === 'search') { this.search.set(value); }
    if (kind === 'doctor') { this.doctorFilter.set(value); }
    if (kind === 'status') { this.statusFilter.set(value as QueueStatus | ''); }
    this.page.set(1);
  }
  toggleStatus(s: QueueStatus): void { this.setFilter('status', this.statusFilter() === s ? '' : s); }
  reset(): void { this.search.set(''); this.doctorFilter.set(''); this.statusFilter.set(''); this.page.set(1); this.load(); }

  initials(n: string): string { return n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
  bp(p: QueuePatient): string { return p.vitals ? `${p.vitals.systolic}/${p.vitals.diastolic}` : '--'; }
  statusClass(s: QueueStatus): string { return ({ 'Waiting for Vitals': 'amber', 'Ready for Doctor': 'green', 'In Consultation': 'purple', 'Completed': 'gray' })[s]; }

  /* ---------- row actions ---------- */
  actionLabel(p: QueuePatient): string {
    return ({ 'Waiting for Vitals': 'Record vitals', 'Ready for Doctor': 'Start consultation', 'In Consultation': 'Mark complete', 'Completed': 'View' })[p.status];
  }
  primaryAction(p: QueuePatient): void {
    if (p.status === 'Waiting for Vitals' || p.status === 'Completed') { this.open(p); return; }
    const next: QueueStatus = p.status === 'Ready for Doctor' ? 'In Consultation' : 'Completed';
    this.busyId.set(p.id);
    this.api.updateStatus(p.id, next).subscribe({
      next: u => { this.replace(u); this.busyId.set(null); this.flash(`${u.name} → ${u.status}`); },
      error: (e: { message?: string }) => { this.busyId.set(null); this.flash(e?.message ?? 'Could not update status.'); }
    });
  }

  /* ---------- drawer ---------- */
  open(p: QueuePatient): void {
    this.selected.set(p);
    this.form = p.vitals ? { ...p.vitals } : this.emptyForm();
    this.submitted.set(false); this.formError.set(null);
  }
  close(): void { this.selected.set(null); }

  bad(v: unknown): boolean { return this.submitted() && (v === null || v === undefined || v === ''); }
  valid(): boolean {
    const f = this.form;
    return [f.systolic, f.diastolic, f.pulse, f.respRate, f.temperature, f.spo2].every(x => x !== null && x !== undefined)
      && !!f.chiefComplaint.trim() && !!f.priority;
  }
  bmi(): number | null {
    const { weight: w, height: h } = this.form;
    return w && h ? +(w / Math.pow(h / 100, 2)).toFixed(1) : null;
  }
  /** Example thresholds only - align with your clinic's protocol. */
  suggested(): Priority | null {
    const f = this.form;
    if ([f.systolic, f.pulse, f.spo2, f.respRate, f.temperature].every(x => x === null)) { return null; }
    const out = (x: number | null, lo: number, hi: number) => x !== null && (x < lo || x > hi);
    if ((f.spo2 !== null && f.spo2 < 90) || out(f.systolic, 90, 180) || out(f.pulse, 40, 130) || out(f.respRate, 8, 30) || out(f.temperature, 35, 40)) { return 'Emergency'; }
    if ((f.spo2 !== null && f.spo2 < 94) || out(f.systolic, 100, 160) || out(f.pulse, 50, 110) || out(f.respRate, 10, 24) || out(f.temperature, 36, 38.4)) { return 'Urgent'; }
    return 'Routine';
  }

  save(): void {
    this.submitted.set(true);
    const p = this.selected();
    if (!p) { return; }
    if (!this.valid()) { this.formError.set('Fill all required (*) fields and choose a triage priority.'); return; }
    this.formError.set(null); this.saving.set(true);
    this.api.saveVitals(p.id, this.form as Vitals).subscribe({
      next: u => { this.replace(u); this.saving.set(false); this.close(); this.flash(`Vitals saved · ${u.name} is ready for the doctor`); },
      error: (e: { message?: string }) => { this.saving.set(false); this.formError.set(e?.message ?? 'Could not save vitals.'); }
    });
  }

  private replace(u: QueuePatient): void { this.patients.update(l => l.map(p => (p.id === u.id ? u : p))); }
  private flash(msg: string): void { this.toast.set(msg); setTimeout(() => this.toast.set(null), 2800); }
  private emptyForm(): FormState {
    return { systolic: null, diastolic: null, pulse: null, respRate: null, temperature: null, spo2: null, weight: null, height: null,
      chiefComplaint: '', priority: '', allergies: '', nursingNotes: '' };
  }
}