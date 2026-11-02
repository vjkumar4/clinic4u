import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { DoctorPatientsService } from '../../../services/doctorpatient/patient_service';
import { Gender, Patient, PatientPage, PatientQuery, PatientStatus, SortDir, SortField } from './model/patientmodel';

type StatusFilter = 'All' | PatientStatus;

@Component({
  selector: 'app-doctor-patients',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './doctorpatient.html',
  styleUrl: './doctorpatient.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorPatientsComponent {
  private api = inject(DoctorPatientsService);

  // ---- Query state (every change triggers one debounced server request) ----
  readonly search = signal('');
  readonly gender = signal<'All' | Gender>('All');
  readonly status = signal<StatusFilter>('All');
  readonly sort = signal<SortField>('lastVisit');
  readonly dir = signal<SortDir>('desc');
  readonly page = signal(1);
  readonly pageSize = signal(25);
  private readonly tick = signal(0); // bumped by retry()

  // ---- Result state ----
  readonly result = signal<PatientPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selected = signal<Patient | null>(null);

  readonly genders: ('All' | Gender)[] = ['All', 'Male', 'Female', 'Other'];
  readonly pageSizes = [10, 25, 50, 100];
  readonly skeletonRows = Array.from({ length: 8 });

  private readonly query = computed<PatientQuery>(() => {
    void this.tick();
    return { search: this.search(), gender: this.gender(), status: this.status(), sort: this.sort(),
             dir: this.dir(), page: this.page(), pageSize: this.pageSize() };
  });

  constructor() {
    toObservable(this.query).pipe(
      debounceTime(250),                                   // wait while the doctor is still typing
      tap(() => { this.loading.set(true); this.error.set(''); }),
      switchMap(q => this.api.getPatients(q).pipe(         // switchMap cancels outdated requests
        catchError(() => { this.error.set('Could not load patients.'); return of(null); }))),
      takeUntilDestroyed(),
    ).subscribe(r => { if (r) this.result.set(r); this.loading.set(false); });
  }

  // ---- Derived ----
  readonly items = computed(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly rangeStart = computed(() => (this.total() ? (this.page() - 1) * this.pageSize() + 1 : 0));
  readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.total()));
  readonly filtersActive = computed(() => !!this.search() || this.gender() !== 'All' || this.status() !== 'All');

  readonly kpis = computed<{ label: string; value: number; status: StatusFilter; tone: string; icon: string }[]>(() => {
    const s = this.result()?.summary;
    return [
      { label: 'All patients', value: s?.total ?? 0, status: 'All', tone: 'blue', icon: '🧑‍🤝‍🧑' },
      { label: 'Critical', value: s?.critical ?? 0, status: 'Critical', tone: 'red', icon: '🚨' },
      { label: 'Follow-up due', value: s?.followUpDue ?? 0, status: 'Follow-up due', tone: 'orange', icon: '🔁' },
      { label: 'New this month', value: s?.newThisMonth ?? 0, status: 'New', tone: 'green', icon: '✨' },
    ];
  });

  readonly pages = computed<(number | '…')[]>(() => {
    const t = this.totalPages(), c = this.page();
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const nums = [...new Set([1, t, c - 1, c, c + 1])].filter(n => n >= 1 && n <= t).sort((a, b) => a - b);
    const out: (number | '…')[] = [];
    nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('…'); out.push(n); });
    return out;
  });

  // ---- Actions (filters always go back to page 1) ----
  onSearch(e: Event) { this.search.set((e.target as HTMLInputElement).value); this.page.set(1); }
  onGender(e: Event) { this.gender.set((e.target as HTMLSelectElement).value as 'All' | Gender); this.page.set(1); }
  onPageSize(e: Event) { this.pageSize.set(+(e.target as HTMLSelectElement).value); this.page.set(1); }
  setStatus(s: StatusFilter) { this.status.set(this.status() === s ? 'All' : s); this.page.set(1); }
  goTo(p: number) { if (p >= 1 && p <= this.totalPages()) this.page.set(p); }
  toggleSort(f: SortField) {
    if (this.sort() === f) this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
    else { this.sort.set(f); this.dir.set(f === 'lastVisit' ? 'desc' : 'asc'); }
    this.page.set(1);
  }
  ariaSort(f: SortField) { return this.sort() === f ? (this.dir() === 'asc' ? 'ascending' : 'descending') : 'none'; }
  reset() { this.search.set(''); this.gender.set('All'); this.status.set('All'); this.page.set(1); }
  retry() { this.tick.update(n => n + 1); }
  open(p: Patient) { this.selected.set(p); }
  @HostListener('document:keydown.escape') close() { this.selected.set(null); }

  // ---- View helpers ----
  initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  hue = (n: string) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  statusClass = (s: string) => s.toLowerCase().replace(/\s+/g, '-');
  daysAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
    return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : d < 365 ? `${Math.floor(d / 30)} mo ago` : `${Math.floor(d / 365)} yr ago`;
  }
}