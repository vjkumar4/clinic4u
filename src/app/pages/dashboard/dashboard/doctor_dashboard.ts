import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, interval, of, switchMap, tap } from 'rxjs';
import { DoctorOverviewService } from '../../../services/dashboard_service';
import { DoctorOverview, Gender, KpiIcon, PatientStatus, VisitType } from './model/doctor-dashboard.model';

/** 24x24 stroke icons (same format as your menu icons). */
const ICONS: Record<KpiIcon | 'check' | 'calendarSm', string> = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  calendarSm: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
};

@Component({
  selector: 'app-doctor-overview',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './doctor_dashboard.html',
  styleUrl: './doctor_dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorDashboardComponent {
  private api = inject(DoctorOverviewService);
  readonly icons = ICONS;

  // ---- State ----
  readonly now = signal(new Date());
  readonly date = signal(new Date().toISOString().slice(0, 10));
  readonly gender = signal<'All' | Gender>('All');
  readonly visitType = signal<'All' | VisitType>('All');
  readonly available = signal(true);
  readonly data = signal<DoctorOverview | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private readonly tick = signal(0);

  readonly genderOptions: ('All' | Gender)[] = ['All', 'Male', 'Female'];
  readonly typeOptions: ('All' | VisitType)[] = ['All', 'New Consultation', 'Follow-up', 'Review', 'Others'];
  readonly skeleton = Array.from({ length: 6 });

  constructor() {
    interval(30_000).pipe(takeUntilDestroyed()).subscribe(() => this.now.set(new Date())); // live clock

    toObservable(computed(() => { void this.tick(); return this.date(); })).pipe(
      tap(() => { this.loading.set(true); this.error.set(''); }),
      switchMap(d => this.api.getOverview(d).pipe(
        catchError(() => { this.error.set('Could not load the dashboard.'); return of(null); }))),
      takeUntilDestroyed(),
    ).subscribe(r => { if (r) this.data.set(r); this.loading.set(false); });
  }

  // ---- Header ----
  readonly greeting = computed(() => {
    const h = this.now().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  });

  // ---- Table (filters run on the day's list) ----
  readonly patients = computed(() => (this.data()?.patients ?? []).filter(p =>
    (this.gender() === 'All' || p.gender === this.gender()) &&
    (this.visitType() === 'All' || p.visitType === this.visitType())));

  // ---- Visits line chart ----
  readonly cw = 560; readonly ch = 230; readonly padL = 34; readonly padR = 14; readonly padT = 12; readonly padB = 30;
  private readonly visits = computed(() => this.data()?.visits ?? []);
  readonly yMax = computed(() => {
    const m = Math.max(...this.visits().map(v => v.count), 10);
    const step = m <= 40 ? 10 : m <= 100 ? 20 : 50;
    return Math.ceil(m / step) * step;
  });
  readonly yTicks = computed(() => {
    const max = this.yMax(), step = max <= 40 ? 10 : max <= 100 ? 20 : 50;
    return Array.from({ length: max / step + 1 }, (_, i) => i * step);
  });
  y = (v: number) => this.padT + (this.ch - this.padT - this.padB) * (1 - v / this.yMax());
  x = (i: number) => this.padL + 14 + (i * (this.cw - this.padL - this.padR - 28)) / Math.max(this.visits().length - 1, 1);
  readonly points = computed(() => this.visits().map((v, i) => ({ x: this.x(i), y: this.y(v.count), label: v.label, count: v.count })));
  readonly linePath = computed(() => {
    const p = this.points();
    return p.reduce((d, pt, i) => {
      if (!i) return `M${pt.x},${pt.y}`;
      const cx = (p[i - 1].x + pt.x) / 2;
      return `${d} C${cx},${p[i - 1].y} ${cx},${pt.y} ${pt.x},${pt.y}`;
    }, '');
  });
  readonly areaPath = computed(() => {
    const p = this.points(), base = this.ch - this.padB;
    return p.length ? `${this.linePath()} L${p[p.length - 1].x},${base} L${p[0].x},${base} Z` : '';
  });

  // ---- Donut ----
  readonly radius = 56;
  readonly totalTypes = computed(() => (this.data()?.visitTypes ?? []).reduce((s, t) => s + t.count, 0));
  readonly donut = computed(() => {
    const c = 2 * Math.PI * this.radius, total = this.totalTypes() || 1;
    let acc = 0;
    return (this.data()?.visitTypes ?? []).map(t => {
      const len = (t.count / total) * c, seg = { color: t.color, dash: `${len} ${c - len}`, offset: -acc };
      acc += len; return seg;
    });
  });
  percent = (n: number, total: number) => Math.round((n / (total || 1)) * 100);

  // ---- Gender bars ----
  readonly totalGender = computed(() => (this.data()?.genders ?? []).reduce((s, g) => s + g.count, 0));
  readonly gw = 320; readonly gh = 230; readonly gTop = 24; readonly gBase = 196; readonly gLeft = 36;
  readonly gMax = computed(() => Math.ceil(Math.max(...(this.data()?.genders ?? []).map(g => g.count), 20) / 20) * 20);
  readonly gTicks = computed(() => Array.from({ length: this.gMax() / 20 + 1 }, (_, i) => i * 20));
  gy = (v: number) => this.gTop + (this.gBase - this.gTop) * (1 - v / this.gMax());
  readonly bars = computed(() => {
    const g = this.data()?.genders ?? [], slot = (this.gw - this.gLeft) / (g.length || 1), w = 64;
    return g.map((s, i) => ({ ...s, x: this.gLeft + slot * i + (slot - w) / 2, w, y: this.gy(s.count), h: this.gBase - this.gy(s.count),
      pct: this.percent(s.count, this.totalGender()) }));
  });

  // ---- Actions & helpers ----
  onDate(e: Event) { const v = (e.target as HTMLInputElement).value; if (v) this.date.set(v); }
  onGender(e: Event) { this.gender.set((e.target as HTMLSelectElement).value as 'All' | Gender); }
  onType(e: Event) { this.visitType.set((e.target as HTMLSelectElement).value as 'All' | VisitType); }
  toggleAvailable() { this.available.update(v => !v); }
  retry() { this.tick.update(n => n + 1); }
  initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  hue = (n: string) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
  statusClass = (s: PatientStatus) => s.toLowerCase().replace(/\s+/g, '-');
}