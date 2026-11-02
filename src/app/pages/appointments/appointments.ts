import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Appointment, ApptStatus, Doctor, NewAppointment } from './model/appointments.model';
import { AppointmentsService } from '../../services/appointments_service';



import { apptCapsFor } from './model/appointments_access';
import { AuthService } from '../../services/Auth_service';

const iso = (d: Date) => d.toLocaleDateString('en-CA');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const same = (a: unknown, b: unknown) =>                            // new
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

@Component({
  selector: 'app-appointments',
  imports: [FormsModule],
  templateUrl: './appointments.html',
  styleUrl: './appointments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Appointments {
  private readonly api = inject(AppointmentsService);
private readonly auth = inject(AuthService); 

readonly caps = computed(() => apptCapsFor(this.auth.role()));

/** Doctors: their own name ('' if their id matches no doctor). Everyone else: null = no restriction. */
private readonly ownDoctor = computed(() =>
  this.caps().ownOnly ? (this.doctors().find(d => same(d.id, this.auth.doctorId()))?.name ?? '') : null);

private readonly visible = computed(() => {
  const own = this.ownDoctor();
  return own === null ? this.appts() : this.appts().filter(a => own !== '' && a.doctor === own);
});

can(a: Appointment, action: 'confirm' | 'checkIn' | 'cancel' | 'noShow'): boolean {
  const c = this.caps();
  switch (action) {
    case 'confirm': return c.confirm && a.status === 'Scheduled';
    case 'checkIn': return c.checkIn && a.status === 'Confirmed';
    case 'cancel':  return c.cancel && (a.status === 'Scheduled' || a.status === 'Confirmed');
    case 'noShow':  return c.noShow && a.status === 'Confirmed';
  }
}

private guard(ok: boolean): boolean {
  if (!ok) this.flash('You do not have access to this action.');
  return ok;
}

  readonly statuses: ApptStatus[] = ['Scheduled', 'Confirmed', 'Checked-in', 'Completed', 'Cancelled', 'No-show'];
  readonly slots = ['09:00', '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:20', '11:40', '12:00',
    '15:00', '15:20', '15:40', '16:00', '16:20', '16:40', '17:00', '17:20', '17:40'];
  readonly todayIso = iso(new Date());

  readonly doctors = signal<Doctor[]>([]);
  readonly appts = signal<Appointment[]>([]);
  readonly weekStart = signal(new Date());
  readonly selectedDate = signal(iso(new Date()));
  readonly search = signal('');
  readonly doctorFilter = signal('');
  readonly statusFilter = signal<ApptStatus | ''>('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  readonly drawer = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly formError = signal<string | null>(null);
  form: NewAppointment = this.emptyForm();


 same = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();



  constructor() {
    this.api.getDoctors().subscribe(d => this.doctors.set(d));
    this.load();
  }

  /* ---------- week strip ---------- */
  readonly week = computed(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i), key = iso(d);
      return { key, dow: d.toLocaleDateString('en-US', { weekday: 'short' }), num: d.getDate(),
        count: this.appts().filter(a => a.date === key && a.status !== 'Cancelled').length };
        
    });
  });
  readonly monthLabel = computed(() => new Date(this.selectedDate() + 'T00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
  readonly dateLabel = computed(() => new Date(this.selectedDate() + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));

  /* ---------- day data ---------- */
  readonly dayAll = computed(() => this.appts().filter(a => a.date === this.selectedDate()));
  readonly kpis = computed(() => {
    const l = this.dayAll(), c = (...s: ApptStatus[]) => l.filter(a => s.includes(a.status)).length;
    return [
      { label: 'Total', value: l.length, tone: 'blue' }, { label: 'Upcoming', value: c('Scheduled', 'Confirmed'), tone: 'green' },
      { label: 'Checked-in', value: c('Checked-in'), tone: 'purple' }, { label: 'Completed', value: c('Completed'), tone: 'gray' },
      { label: 'Cancelled / No-show', value: c('Cancelled', 'No-show'), tone: 'red' }
    ];
  });
  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase(), d = this.doctorFilter(), s = this.statusFilter();
    return this.dayAll()
      .filter(a => (!q || (a.patient.name + a.patient.mrn + a.patient.phone).toLowerCase().includes(q)) && (!d || a.doctor === d) && (!s || a.status === s))
      .sort((a, b) => a.time.localeCompare(b.time));
  });
  readonly groups = computed(() => {
    const defs = [{ label: 'Morning', test: (t: string) => t < '12:00' }, { label: 'Afternoon', test: (t: string) => t >= '12:00' && t < '17:00' }, { label: 'Evening', test: (t: string) => t >= '17:00' }];
    return defs.map(g => ({ label: g.label, items: this.filtered().filter(a => g.test(a.time)) })).filter(g => g.items.length);
  });

  /* ---------- loading ---------- */
  load(): void {
    this.loading.set(true); this.error.set(null);
    const from = iso(this.weekStart()), to = iso(addDays(this.weekStart(), 6));
    this.api.getAppointments(from, to).subscribe({
      next: l => { this.appts.set(l); this.loading.set(false); },
      error: (e: { message?: string }) => { this.error.set(e?.message ?? 'Could not load appointments.'); this.loading.set(false); }
    });
  }
  shiftWeek(n: number): void {
    const s = addDays(this.weekStart(), n * 7);
    this.weekStart.set(s); this.selectedDate.set(iso(s)); this.load();
  }
  goToday(): void { this.weekStart.set(new Date()); this.selectedDate.set(this.todayIso); this.load(); }

  /* ---------- helpers ---------- */
  doctorColor(name: string): string { return this.doctors().find(d => d.name === name)?.color ?? '#94a3b8'; }
  initials(n: string): string { return n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
  time12(t: string): string { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  statusClass(s: ApptStatus): string {
    return ({ Scheduled: 'amber', Confirmed: 'blue', 'Checked-in': 'purple', Completed: 'green', Cancelled: 'red', 'No-show': 'gray' })[s];
  }

  /* ---------- row actions ---------- */
setStatus(a: Appointment, status: ApptStatus): void {
  const action = status === 'Confirmed' ? 'confirm' : status === 'No-show' ? 'noShow' : 'cancel';
  if (!this.guard(this.can(a, action))) return;
  this.run(a, this.api.updateStatus(a.id, status), `${a.patient.name} → ${status}`);
}
  checkIn(a: Appointment): void {
    if (!this.guard(this.can(a, 'checkIn'))) return;
    this.busyId.set(a.id);
    this.api.checkIn(a.id).subscribe({
      next: u => { this.replace(u); this.busyId.set(null); this.flash(`Token ${u.token} created · ${u.patient.name} is now in the triage queue`); },
      error: (e: { message?: string }) => { this.busyId.set(null); this.flash(e?.message ?? 'Check-in failed.'); }
    });
  }
  private run(a: Appointment, obs: ReturnType<AppointmentsService['updateStatus']>, msg: string): void {
    this.busyId.set(a.id);
    obs.subscribe({
      next: u => { this.replace(u); this.busyId.set(null); this.flash(msg); },
      error: (e: { message?: string }) => { this.busyId.set(null); this.flash(e?.message ?? 'Could not update the appointment.'); }
    });
  }

  /* ---------- new appointment drawer ---------- */
  openNew(): void { 
     if (!this.guard(this.caps().book)) return;
    this.form = this.emptyForm(); this.submitted.set(false); this.formError.set(null); this.drawer.set(true); }
  closeNew(): void { this.drawer.set(false); }
  slotTaken(t: string): boolean {
    return this.appts().some(a => a.date === this.form.date && a.time === t && a.doctor === this.form.doctor && a.status !== 'Cancelled');
  }
  bad(v: unknown): boolean { return this.submitted() && (v === null || v === undefined || v === ''); }
  save(): void {
    this.submitted.set(true);
    const f = this.form;
    if (!f.patientName.trim() || !f.phone.trim() || !f.doctor || !f.date || !f.time) { this.formError.set('Fill all required (*) fields and pick a time slot.'); return; }
    this.formError.set(null); this.saving.set(true);
    this.api.create({ ...f, patientName: f.patientName.trim() }).subscribe({
      next: a => {
        this.saving.set(false); this.drawer.set(false);
        if (a.date >= iso(this.weekStart()) && a.date <= iso(addDays(this.weekStart(), 6))) { this.appts.update(l => [...l, a]); }
        this.selectedDate.set(a.date); this.flash(`Appointment booked for ${a.patient.name} at ${this.time12(a.time)}`);
      },
      error: (e: { message?: string }) => { this.saving.set(false); this.formError.set(e?.message ?? 'Could not book the appointment.'); }
    });
  }

  private replace(u: Appointment): void { this.appts.update(l => l.map(a => (a.id === u.id ? u : a))); }
  private flash(m: string): void { this.toast.set(m); setTimeout(() => this.toast.set(null), 3000); }
  private emptyForm(): NewAppointment {
    return { patientName: '', phone: '', age: null, sex: 'F', doctor: '', date: this.selectedDate?.() ?? this.todayIso, time: '', type: 'New', reason: '' };
  }
}