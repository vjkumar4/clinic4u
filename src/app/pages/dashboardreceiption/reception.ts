import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReceptionDataService } from '../../services/reception_service';
import { Activity, ActivityType, DoctorLive, DoctorState, Status, Visit } from './model/reception.model';

/** Change these to match your app's routes. */
const ROUTES = {
  register: '/patients/add',
  book: '/appointments',
  patient: (id: number) => `/patients/${id}`,
  queue: '/opd-queue',
};

const PAGE_SIZE = 6;
const QUEUE: Status[] = ['checked-in', 'waiting-vitals', 'ready', 'consultation'];

interface Step { to: Status; label: string; icon: string; tone: 'outline' | 'blue' | 'green' }

/** The one place that defines the patient flow and its action buttons. */
const FLOW: Record<Status, Step | null> = {
  booked: { to: 'checked-in', label: 'Check in', icon: 'check', tone: 'outline' },
  'checked-in': { to: 'waiting-vitals', label: 'To vitals', icon: 'arrow-right', tone: 'outline' },
  'waiting-vitals': { to: 'ready', label: 'Record', icon: 'pulse', tone: 'blue' },
  ready: { to: 'consultation', label: 'Move', icon: 'arrow-right', tone: 'green' },
  consultation: { to: 'done', label: 'Finish', icon: 'check', tone: 'outline' },
  done: null,
};

const LABEL: Record<Status, string> = {
  booked: 'Booked',
  'checked-in': 'Checked In',
  'waiting-vitals': 'Waiting Vitals',
  ready: 'Ready for Doctor',
  consultation: 'Consultation',
  done: 'Done',
};

const NEXT_STEP: Record<Status, string> = {
  booked: 'Check in',
  'checked-in': 'Nurse Assessment',
  'waiting-vitals': 'Vitals & Triage',
  ready: 'Move to Doctor',
  consultation: 'Prescription',
  done: '-',
};

/** Activity logged when a visit moves INTO this status. */
const LOG: Record<Status, { type: ActivityType; title: string } | null> = {
  booked: null,
  'checked-in': { type: 'checkin', title: 'Patient checked in' },
  'waiting-vitals': { type: 'vitals', title: 'Sent for vitals' },
  ready: { type: 'vitals', title: 'Vitals recorded' },
  consultation: { type: 'consult', title: 'Moved to doctor' },
  done: { type: 'done', title: 'Consultation finished' },
};

const ACT: Record<ActivityType, { icon: string; tone: string }> = {
  registered: { icon: 'user-plus', tone: 'green' },
  confirmed: { icon: 'calendar-check', tone: 'blue' },
  checkin: { icon: 'check-circle', tone: 'purple' },
  booked: { icon: 'calendar-plus', tone: 'pink' },
  vitals: { icon: 'pulse', tone: 'amber' },
  consult: { icon: 'stethoscope', tone: 'blue' },
  done: { icon: 'check', tone: 'green' },
};

const DOCTOR_TONE: Record<DoctorState, string> = { serving: 'green', idle: 'blue', break: 'orange', offline: 'gray' };
const DOCTOR_LABEL: Record<DoctorState, string> = { serving: 'Serving', idle: 'Available', break: 'On break', offline: 'Offline' };

interface Stat {
  key: string; label: string; value: number; sub: string;
  tone: string; icon: string; pct: number | null;
}

@Component({
  selector: 'app-reception-dashboard',
  imports: [DatePipe],
  templateUrl: './reception.html',
  styleUrl: './reception.scss',
})
export class ReceptionDashboard implements OnInit {
  private data = inject(ReceptionDataService);
  private router = inject(Router);

  readonly today = new Date();
  readonly greeting = (() => {
    const h = this.today.getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  })();

  readonly filterOptions: { key: Status | 'all'; label: string }[] = [
    { key: 'all', label: 'All Status' },
    { key: 'checked-in', label: 'Checked In' },
    { key: 'waiting-vitals', label: 'Waiting Vitals' },
    { key: 'ready', label: 'Ready for Doctor' },
    { key: 'consultation', label: 'Consultation' },
  ];

  readonly routes = ROUTES;
  readonly pageSize = PAGE_SIZE;

  // server state
  visits = signal<Visit[]>([]);
  activities = signal<Activity[]>([]);
  user = signal('');
  loading = signal(true);
  error = signal(false);

  // live doctor tokens
  doctors = signal<DoctorLive[]>([]);
  lastLive = signal<Date | null>(null);
  flashDoc = signal<Set<string>>(new Set());
  private lastTokens = new Map<string, string | null>();

  // ui state
  statusFilter = signal<Status | 'all'>('all');
  page = signal(1);
  progress = signal(0); // 0 → 1, drives the count-up
  flash = signal<number | null>(null); // row that just changed

  constructor() {
    this.data.doctorsLive().pipe(takeUntilDestroyed()).subscribe((list) => {
      // find doctors whose serving token changed since the last update
      const changed = new Set(
        list
          .filter((d) => this.lastTokens.has(d.id) && this.lastTokens.get(d.id) !== d.currentToken)
          .map((d) => d.id),
      );
      list.forEach((d) => this.lastTokens.set(d.id, d.currentToken));

      this.doctors.set(list);
      this.lastLive.set(new Date());

      if (changed.size) {
        this.flashDoc.set(changed);
        setTimeout(() => this.flashDoc.set(new Set()), 1500); // highlight the new token briefly
      }
    });
  }

  // ── derived ────────────────────────────────────────────────
  stats = computed<Stat[]>(() => {
    const v = this.visits();
    const total = v.length || 1;
    const n = (s: Status) => v.filter((x) => x.status === s).length;
    const checked = v.filter((x) => x.status !== 'booked').length;
    const pct = (x: number) => Math.round((x / total) * 100);
    return [
      { key: 'total', label: 'Total Patients', value: v.length, sub: 'Today', tone: 'blue', icon: 'users', pct: null },
      { key: 'in', label: 'Checked In', value: checked, sub: `(${pct(checked)}%)`, tone: 'green', icon: 'check-circle', pct: pct(checked) },
      { key: 'appt', label: 'Appointments', value: n('booked'), sub: '(Today)', tone: 'orange', icon: 'calendar-plus', pct: null },
      { key: 'vit', label: 'Waiting for Vitals', value: n('waiting-vitals'), sub: `(${pct(n('waiting-vitals'))}%)`, tone: 'purple', icon: 'user', pct: pct(n('waiting-vitals')) },
      { key: 'doc', label: 'Ready for Doctor', value: n('ready'), sub: `(${pct(n('ready'))}%)`, tone: 'pink', icon: 'stethoscope', pct: pct(n('ready')) },
    ];
  });

  queue = computed(() => {
    const f = this.statusFilter();
    return this.visits().filter((v) => QUEUE.includes(v.status) && (f === 'all' || v.status === f));
  });
  pages = computed(() => Math.max(1, Math.ceil(this.queue().length / PAGE_SIZE)));
  currentPage = computed(() => Math.min(this.page(), this.pages()));
  pageNums = computed(() => Array.from({ length: this.pages() }, (_, i) => i + 1));
  pageRows = computed(() => {
    const p = this.currentPage();
    return this.queue().slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  });
  shownFrom = computed(() => (this.queue().length ? (this.currentPage() - 1) * PAGE_SIZE + 1 : 0));
  shownTo = computed(() => Math.min(this.currentPage() * PAGE_SIZE, this.queue().length));

  regs = computed(() =>
    this.visits()
      .filter((v) => v.registeredAt)
      .sort((a, b) => a.regNo.localeCompare(b.regNo))
      .slice(0, 5),
  );

  appts = computed(() =>
    this.visits()
      .filter((v) => v.appt)
      .sort((a, b) => a.time.localeCompare(b.time)),
  );

  // ── lifecycle ──────────────────────────────────────────────
  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.data.getReceptionist().subscribe((u) => this.user.set(u.firstName));
    this.data.getActivities().subscribe((a) => this.activities.set(a));
    this.data.getVisits().subscribe({
      next: (list) => {
        this.visits.set(list);
        this.loading.set(false);
        this.countUp();
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  // ── helpers used by the template ───────────────────────────
  shown(v: number) { return Math.round(v * this.progress()); }
  label(s: Status) { return LABEL[s]; }
  nextStep(s: Status) { return NEXT_STEP[s]; }
  step(v: Visit) { return FLOW[v.status]; }
  act(t: ActivityType) { return ACT[t]; }
  doctorTone(s: DoctorState) { return DOCTOR_TONE[s]; }
  doctorLabel(s: DoctorState) { return DOCTOR_LABEL[s]; }

  apptChip(v: Visit): { key: string; label: string } {
    switch (v.status) {
      case 'booked': return v.confirmed ? { key: 'confirmed', label: 'Confirmed' } : { key: 'scheduled', label: 'Scheduled' };
      case 'checked-in': return { key: 'checked-in', label: 'Checked In' };
      case 'waiting-vitals':
      case 'ready': return { key: 'waiting', label: 'Waiting' };
      case 'consultation': return { key: 'consultation', label: 'Consultation' };
      default: return { key: 'done', label: 'Done' };
    }
  }

  // ── actions ────────────────────────────────────────────────
  setFilter(value: string) {
    this.statusFilter.set(value as Status | 'all');
    this.page.set(1);
  }
  setPage(n: number) { this.page.set(Math.min(Math.max(n, 1), this.pages())); }

  advance(v: Visit) {
    const step = FLOW[v.status];
    if (!step) return;
    this.data.updateStatus(v.id, step.to).subscribe((updated) => {
      this.visits.update((l) => l.map((x) => (x.id === updated.id ? updated : x)));
      this.flash.set(updated.id);
      setTimeout(() => this.flash.set(null), 1300);

      const log = LOG[updated.status];
      if (log) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const entry: Activity = { id: Date.now(), type: log.type, title: log.title, sub: `${updated.name} - ${updated.regNo}`, time };
        this.activities.update((l) => [entry, ...l].slice(0, 6));
      }
    });
  }

  go(path: string) { this.router.navigateByUrl(path); }

  private countUp() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return this.progress.set(1);
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / 1100, 1);
      this.progress.set(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}