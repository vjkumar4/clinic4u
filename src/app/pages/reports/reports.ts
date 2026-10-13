import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of, switchMap, tap } from 'rxjs';
import { RangeKey, ReportData, Slice } from './model/report.model';
import { ReportsService } from '../../services/report_service';



interface Arc { dash: string; offset: number; color: string; label: string; }

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent {
  private readonly api = inject(ReportsService);

  readonly tabs = ['Overview', 'Patient visits', 'Appointments', 'Revenue', 'Doctors', 'Clinical'];
  readonly ranges: { key: RangeKey; label: string }[] = [{ key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }];

  readonly activeTab = signal('Overview');
  readonly range = signal<RangeKey>('7d');
  readonly doctorFilter = signal('');
  readonly search = signal('');
  readonly hover = signal<number | null>(null);
  readonly hoverDoctor = signal<string | null>(null);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly data = signal<ReportData | null>(null);

  /* chart geometry */
  readonly W = 640; readonly H = 240; readonly L = 34; readonly B = 26; readonly T = 12;
  readonly yTicks = [0, 20, 40, 60, 80];

  constructor() {
    toObservable(this.range).pipe(
      tap(() => { this.loading.set(true); this.error.set(false); }),
      switchMap(r => this.api.getReport(r).pipe(catchError(() => { this.error.set(true); return of(null); }))),
      takeUntilDestroyed(inject(DestroyRef))
    ).subscribe(d => { if (d) { this.data.set(d); } this.loading.set(false); });
  }

  /* derived state */
  readonly totalVisits = computed(() => (this.data()?.doctors ?? []).reduce((s, d) => s + d.visits, 0));
  readonly totalGender = computed(() => (this.data()?.gender ?? []).reduce((s, g) => s + g.count, 0));
  readonly totalReasons = computed(() => (this.data()?.reasons ?? []).reduce((s, r) => s + r.count, 0));
  readonly maxAge = computed(() => Math.max(1, ...(this.data()?.ageGroups ?? []).map(a => a.count)));

  readonly series = computed(() => {
    const d = this.data(); if (!d) { return []; }
    const f = this.doctorFilter();
    if (!f) { return d.trend.values; }
    const doc = d.doctors.find(x => x.name === f);
    const share = doc ? doc.visits / this.totalVisits() : 1;
    return d.trend.values.map(v => Math.round(v * share));
  });
  readonly yMax = computed(() => Math.max(80, Math.ceil(Math.max(...this.series(), 0) / 20) * 20));
  readonly yAxis = computed(() => { const m = this.yMax(); return [0, 1, 2, 3, 4].map(i => (m / 4) * i); });

  x(i: number): number { return this.L + (i * (this.W - this.L - 10)) / Math.max(1, this.series().length - 1); }
  y(v: number): number { return this.T + (1 - v / this.yMax()) * (this.H - this.T - this.B); }

  readonly linePath = computed(() => this.smooth(this.series().map((v, i) => [this.x(i), this.y(v)])));
  readonly areaPath = computed(() => {
    const s = this.series(); if (!s.length) { return ''; }
    return `${this.linePath()} L${this.x(s.length - 1)},${this.y(0)} L${this.x(0)},${this.y(0)} Z`;
  });

  readonly doctorArcs = computed(() => this.arcs((this.data()?.doctors ?? []).map(d => ({ label: d.name, count: d.visits, color: d.color })), 70));
  readonly genderArcs = computed(() => this.arcs(this.data()?.gender ?? [], 52));

  readonly filteredVisits = computed(() => {
    const q = this.search().trim().toLowerCase();
    return (this.data()?.recent ?? []).filter(v => !q || (v.patient + v.mrn + v.doctor + v.reason).toLowerCase().includes(q));
  });

  pct(n: number, total: number): number { return total ? Math.round((n / total) * 100) : 0; }
  initials(name: string): string { return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(); }
  isGood(k: { change: number; lowerIsBetter?: boolean }): boolean { return (k.change > 0) !== !!k.lowerIsBetter; }

  sparkPath(values: number[], w = 96, h = 32): string {
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    return this.smooth(values.map((v, i) => [(i * w) / (values.length - 1), h - 3 - ((v - min) / span) * (h - 6)]));
  }

  statusClass(s: string): string {
    return ({ 'In Consultation': 'purple', 'Completed': 'gray', 'Ready for Doctor': 'green', 'Waiting for Vitals': 'amber' } as Record<string, string>)[s] ?? 'gray';
  }

  retry(): void { this.loading.set(true); this.api.getReport(this.range()).subscribe({ next: d => { this.data.set(d); this.error.set(false); this.loading.set(false); }, error: () => { this.error.set(true); this.loading.set(false); } }); }

  exportCsv(): void {
    const rows = [['Date & time', 'Patient', 'MRN', 'Doctor', 'Reason', 'Status'],
      ...this.filteredVisits().map(v => [v.at, v.patient, v.mrn, v.doctor, v.reason, v.status])];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'clinic-report.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  /* helpers */
  private arcs(items: Slice[], r: number): Arc[] {
    const c = 2 * Math.PI * r, total = items.reduce((s, i) => s + i.count, 0) || 1;
    let acc = 0;
    return items.map(i => { const len = (i.count / total) * c; const a = { dash: `${len - 2} ${c - len + 2}`, offset: -acc, color: i.color, label: i.label }; acc += len; return a; });
  }
  private smooth(pts: number[][]): string {
    if (!pts.length) { return ''; }
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return d;
  }
}