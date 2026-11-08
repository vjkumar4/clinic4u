import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/Auth_service';
import { NewPatient, Patient, PatientService } from '../../services/patient_service';
import { DOCTORS, OpdService, OpdStatus, Priority, Visit } from '../../services/opd_service';
import { capsFor, NO_CAPS } from './opdaccess/opd_access';
import { CONDITIONS, GENDERS, PRIORITIES, REG_SECTIONS, buildRegForm, toPatientInfo } from './opdaccess/opd_form';

type Modal = 'checkin' | 'vitals' | 'complete' | null;
type Action = 'startVitals' | 'finishVitals' | 'complete' | 'cancel';
interface Identity { patientId: string; name: string; age: number | null; gender: string; phone: string }

const IN_QUEUE: OpdStatus[] = ['waiting', 'vitals', 'ready'];

/** Compares two ids ignoring case, spaces and number-vs-text. Use it for every doctor id comparison. */
const same = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

@Component({
  selector: 'app-opd',
  imports: [ReactiveFormsModule],
  templateUrl: './opdqueue.html',
  styleUrl: './opdqueue.scss',
  host: { '(document:keydown.escape)': 'closeModal()' },
})
export class OpdComponent {
  opd = inject(OpdService);
  private auth = inject(AuthService);
  private patients = inject(PatientService);
  private fb = inject(FormBuilder);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // ── access ─────────────────────────────────────────────────
  /** What the signed-in role may do. The template checks this, never the role name. */
  caps = computed(() => capsFor(this.auth.role()));
  private hasAccess = computed(() => this.caps() !== NO_CAPS);
  private opened = signal(new Set<OpdStatus>(this.caps().focus));

  /** Doctors: their own id ('' if not linked). Everyone else: null, meaning no restriction. */
  private ownDoctorId = computed(() => (this.caps().ownOnly ? (this.auth.doctorId() ?? '') : null));

  /** A doctor login with no doctor profile attached. */
  notLinked = computed(() => this.caps().ownOnly && !this.auth.doctorId());

  private seesDoctor = (id: string) => {
    if (!this.hasAccess()) return false;
    const own = this.ownDoctorId();
    return own === null || (own !== '' && same(own, id));
  };

  can(v: Visit, action: Action): boolean {
    const c = this.caps();
    switch (action) {
      case 'startVitals': return c.startVitals && v.status === 'waiting';
      case 'finishVitals': return c.finishVitals && v.status === 'vitals';
      case 'complete': return c.complete && v.status === 'consult' && this.seesDoctor(v.doctorId);
      case 'cancel': return c.cancel && IN_QUEUE.includes(v.status);
    }
  }

  private guard(allowed: boolean): boolean {
    if (!allowed) this.say('You do not have access to this action.');
    return allowed;
  }

  // ── ui state ───────────────────────────────────────────────
  doctors = DOCTORS;
  genders = GENDERS;
  conditionList = CONDITIONS;
  priorities = PRIORITIES;
  sections = REG_SECTIONS;
  columns: { key: OpdStatus; title: string; hint: string }[] = [
    { key: 'waiting', title: 'Waiting', hint: 'Token issued' },
    { key: 'vitals', title: 'Vitals', hint: 'With nurse' },
    { key: 'ready', title: 'Ready for doctor', hint: 'Vitals done' },
    { key: 'consult', title: 'With doctor', hint: 'In consultation' },
  ];

  now = signal(Date.now()); // ticks every 30s so waiting times stay live
  doctorFilter = signal('all');
  modal = signal<Modal>(null);
  target = signal<Visit | null>(null);
  toast = signal('');
  mode = signal<'new' | 'existing'>('new');
  search = signal('');
  picked = signal<Patient | null>(null);
  pickError = signal(false);
  allergies = signal<string[]>([]);
  conditions = signal<string[]>([]);
  saving = signal(false); // true while a new patient is being saved to the server

  regForm = buildRegForm(this.fb, DOCTORS[0].id);
  vitalsForm = this.fb.group({
    sys: [null as number | null], dia: [null as number | null], pulse: [null as number | null],
    temp: [null as number | null], spo2: [null as number | null], weight: [null as number | null],
  });
  doneForm = this.fb.nonNullable.group({ notes: [''], followUp: [''] });

  // ── data the page shows, already limited by role ───────────
  private visits = computed(() => this.opd.today().filter(v => this.seesDoctor(v.doctorId)));
  private activeDoctor = computed(() => this.ownDoctorId() ?? this.doctorFilter());

  list = computed(() =>
    this.visits().filter(v => this.activeDoctor() === 'all' || same(v.doctorId, this.activeDoctor())));

  board = computed(() => Object.fromEntries(
    this.columns.map(c => [c.key, this.opd.sorted(this.list().filter(v => v.status === c.key))]),
  ) as Record<string, Visit[]>);

  finished = computed(() => this.list()
    .filter(v => v.status === 'done' || v.status === 'cancelled')
    .sort((a, b) => (b.tDone ?? '').localeCompare(a.tDone ?? '')));

  desks = computed(() => this.doctors.filter(d => this.seesDoctor(d.id)).map(d => {
    const mine = this.visits().filter(v => same(v.doctorId, d.id));
    const ready = this.opd.sorted(mine.filter(v => v.status === 'ready'));
    return {
      ...d,
      current: mine.find(v => v.status === 'consult') ?? null,
      next: ready[0] ?? null,
      readyCount: ready.length,
      queued: mine.filter(v => IN_QUEUE.includes(v.status)).length,
    };
  }));

  stats = computed(() => {
    const t = this.visits();
    const waits = t.filter(v => v.tConsult).map(v => (Date.parse(v.tConsult!) - Date.parse(v.tIn)) / 60000);
    return [
      { label: 'In queue', value: t.filter(v => IN_QUEUE.includes(v.status)).length, tone: 'amber' },
      { label: 'Avg wait (min)', value: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0, tone: 'blue' },
      { label: 'With doctor', value: t.filter(v => v.status === 'consult').length, tone: 'green' },
      { label: 'Completed today', value: t.filter(v => v.status === 'done').length, tone: 'violet' },
    ];
  });

  results = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.patients.patients()
      .filter(p => !q || `${p.firstName} ${p.lastName} ${p.id} ${p.phone}`.toLowerCase().includes(q))
      .slice(0, 5);
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30000);
    inject(DestroyRef).onDestroy(() => { clearInterval(timer); clearTimeout(this.toastTimer); });

    // arriving from the Patients page: /opd?patient=P-10001 opens check-in with that patient picked.
    // The patient list now loads from the API, so wait until it arrives instead of reading it once.
    const id = inject(ActivatedRoute).snapshot.queryParamMap.get('patient');
    if (id && this.caps().checkIn) {
      const ref = effect(() => {
        const p = this.patients.patients().find(x => x.id === id);
        if (!p) return;
        untracked(() => { this.openCheckIn('existing'); this.pick(p); });
        ref.destroy();
      });
    }
  }

  // ── helpers used by the template ───────────────────────────
  doctor = (v: Visit) => this.doctors.find(d => same(d.id, v.doctorId)) ?? { id: '', name: 'Unassigned' };
  wait(v: Visit) { return Math.max(0, Math.floor(((v.tConsult ? Date.parse(v.tConsult) : this.now()) - Date.parse(v.tIn)) / 60000)); }
  total(v: Visit) { return v.tDone ? Math.round((Date.parse(v.tDone) - Date.parse(v.tIn)) / 60000) : 0; }
  time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  ageOf(dob: string): number | null {
    if (!dob) return null;
    const a = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
    return a >= 0 && a < 130 ? a : null;
  }
  age = (p: Patient) => this.ageOf(p.dob);
  name = (p: Patient) => `${p.firstName} ${p.lastName}`.trim();
  initials = (p: Patient) => ((p.firstName[0] ?? '') + (p.lastName[0] ?? '')).toUpperCase();
  fullAddress = (p: Patient) => [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ');

  say(msg: string) {
    clearTimeout(this.toastTimer);
    this.toast.set(msg);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3000);
  }
  closeModal() { this.modal.set(null); this.target.set(null); }

  // columns the role does not work in start collapsed, but anyone can open them to look
  isOpen = (key: OpdStatus) => this.opened().has(key);
  toggleColumn(key: OpdStatus) {
    this.opened.update(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  // ── check-in (receptionist) ────────────────────────────────
  openCheckIn(mode: 'new' | 'existing' = 'new') {
    if (!this.guard(this.caps().checkIn)) return;
    this.regForm.reset({ doctorId: this.doctors[0].id, priority: 'normal', consent: false });
    this.allergies.set([]); this.conditions.set([]);
    this.saving.set(false);
    this.mode.set(mode); this.search.set(''); this.picked.set(null); this.pickError.set(false);
    this.modal.set('checkin');
  }
  setMode(m: 'new' | 'existing') { this.mode.set(m); this.picked.set(null); this.pickError.set(false); }
  pick(p: Patient) { this.picked.set(p); this.pickError.set(false); }

  err(key: string): string {
    const c = this.regForm.get(key);
    if (!c || !c.touched || !c.invalid) return '';
    const e = c.errors!;
    return e['required'] || e['requiredTrue'] ? 'This field is required.'
      : e['email'] ? 'Enter a valid email address.'
      : e['pattern'] ? 'Check the format.'
      : e['minlength'] ? 'Too short.'
      : 'Value is out of range.';
  }
  addAllergy(input: HTMLInputElement) {
    const v = input.value.trim();
    if (v && !this.allergies().includes(v)) this.allergies.update(a => [...a, v]);
    input.value = '';
  }
  removeAllergy(i: number) { this.allergies.update(a => a.filter((_, x) => x !== i)); }
  toggleCondition(c: string) { this.conditions.update(l => (l.includes(c) ? l.filter(x => x !== c) : [...l, c])); }

  submitCheckIn() {
    if (!this.guard(this.caps().checkIn)) return;
    if (this.saving()) return; // ignore double clicks while saving

    const f = this.regForm;
    f.get('doctorId')!.markAsTouched();
    f.get('reason')!.markAsTouched();

    if (['doctorId', 'reason'].some(k => f.get(k)!.invalid)) {
      if (this.mode() === 'new') f.markAllAsTouched();
      else if (!this.picked()) this.pickError.set(true);
      return;
    }

    // Existing patient: nothing to save, check in right away
    if (this.mode() === 'existing') {
      const who = this.pickedIdentity();
      if (who) this.completeCheckIn(who, false);
      return;
    }

    // New patient: save first, then check in with the server's id
    const info = this.newPatientInfo();
    if (!info) return;

    this.saving.set(true);
    this.patients.add$(info).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.completeCheckIn(this.identity(saved), true);
      },
      error: (e: Error) => {
        this.saving.set(false);
        this.say(e.message); // modal stays open so nothing is lost
      },
    });
  }

  private completeCheckIn(who: Identity, isNew: boolean) {
    const f = this.regForm;
    const v = this.opd.checkIn({
      ...who,
      doctorId: f.value.doctorId!,
      reason: f.value.reason!.trim(),
      priority: f.value.priority as Priority,
    });
    this.closeModal();
    this.say(`${isNew ? `Patient saved (${who.patientId}). ` : ''}Token ${v.token} issued to ${v.name}`);
  }

  private identity(p: Patient): Identity {
    return { patientId: p.id, name: this.name(p), age: this.age(p), gender: p.gender, phone: p.phone };
  }

  private pickedIdentity(): Identity | null {
    const p = this.picked();
    if (!p) { this.pickError.set(true); return null; }
    return this.identity(p);
  }

  /** Builds the new-patient data from the form, or null if the form is invalid. */
  private newPatientInfo(): NewPatient | null {
    const f = this.regForm;
    if (f.invalid) {
      f.markAllAsTouched();
      setTimeout(() => document.querySelector('.modal .invalid')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return null;
    }
    return { ...toPatientInfo(f.getRawValue()), allergies: this.allergies(), conditions: this.conditions() };
  }

  // ── nurse ──────────────────────────────────────────────────
  startVitals(v: Visit) {
    if (!this.guard(this.can(v, 'startVitals'))) return;
    this.opd.startVitals(v.id); // waiting -> vitals
    this.say(`${v.token} is now with the nurse`);
  }
  fastTrack(v: Visit) {
    if (!this.guard(this.can(v, 'startVitals'))) return;
    this.opd.fastTrack(v.id);
    this.say(`${v.token} fast-tracked`);
  }
  openVitals(v: Visit) {
    if (!this.guard(this.can(v, 'finishVitals'))) return;
    this.target.set(v); this.vitalsForm.reset(); this.modal.set('vitals');
  }
  submitVitals() {
    const v = this.target();
    if (!v || !this.guard(this.can(v, 'finishVitals'))) return;
    this.opd.saveVitals(v.id, this.vitalsForm.getRawValue() as Parameters<OpdService['saveVitals']>[1]);
    this.say(`${v.name} is ready for ${this.doctor(v).name}`);
    this.closeModal();
  }

  // ── doctor ─────────────────────────────────────────────────
  callNext(doctorId: string) {
    if (!this.caps().callNext || !this.seesDoctor(doctorId)) {
      return void this.say('Only the assigned doctor can call the next patient.');
    }
    const v = this.opd.callNext(doctorId);
    if (v) this.say(`Now serving ${v.token} · ${v.name}`);
  }
  openComplete(v: Visit) {
    if (!this.guard(this.can(v, 'complete'))) return;
    this.target.set(v); this.doneForm.reset(); this.modal.set('complete');
  }
  submitComplete() {
    const v = this.target();
    if (!v || !this.guard(this.can(v, 'complete'))) return;
    const f = this.doneForm.getRawValue();
    this.opd.complete(v.id, f.notes, f.followUp);
    this.say(`Visit completed for ${v.name}`);
    this.closeModal();
  }

  // ── reception ──────────────────────────────────────────────
  cancel(v: Visit) {
    if (!this.guard(this.can(v, 'cancel'))) return;
    this.opd.cancel(v.id);
    this.say(`${v.token} marked as cancelled`);
  }
}