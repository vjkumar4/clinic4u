import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Patient, PatientService } from '../../services/patient_service';
import { DOCTORS, OpdService, OpdStatus, Priority, Visit } from '../../services/opd_service';

type Field = { key: string; label?: string; kind?: 'select' | 'textarea' | 'custom'; type?: string; ph?: string; opts?: string[]; span?: boolean; unit?: string; req?: boolean };

@Component({
  selector: 'app-opd',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './opdqueue.html',
  styleUrl: './opdqueue.scss',
  host: { '(document:keydown.escape)': 'closeModal()' },
})
export class OpdComponent {
  opd = inject(OpdService);
  private patients = inject(PatientService);
  private fb = inject(FormBuilder);
  doctors = DOCTORS;

  now = signal(Date.now());                               // ticks every 30s so waiting times stay live
  doctorFilter = signal('all');
  modal = signal<'checkin' | 'vitals' | 'complete' | null>(null);
  target = signal<Visit | null>(null);
  toast = signal('');
  mode = signal<'new' | 'existing'>('new');
  search = signal('');
  picked = signal<Patient | null>(null);
  allergies = signal<string[]>([]);
  conditions = signal<string[]>([]);
  conditionList = ['Diabetes', 'Hypertension', 'Asthma', 'Heart disease', 'Thyroid', 'Arthritis', 'Kidney disease'];
  genders = ['Male', 'Female', 'Other'];
  pickError = signal(false);
  priorities: { v: Priority; label: string }[] = [{ v: 'normal', label: 'Normal' }, { v: 'priority', label: 'Priority' }, { v: 'emergency', label: 'Emergency' }];

  columns: { key: OpdStatus; title: string; hint: string }[] = [
    { key: 'waiting', title: 'Waiting', hint: 'Token issued' },
    { key: 'vitals', title: 'Vitals', hint: 'With nurse' },
    { key: 'ready', title: 'Ready for doctor', hint: 'Vitals done' },
    { key: 'consult', title: 'With doctor', hint: 'In consultation' },
  ];

  private phoneRe = Validators.pattern(/^[0-9+\-\s]{7,15}$/);
  regForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]], lastName: ['', Validators.required], dob: ['', Validators.required], gender: ['', Validators.required],
    bloodGroup: [''], marital: [''], occupation: [''],
    phone: ['', [Validators.required, this.phoneRe]], altPhone: ['', this.phoneRe], email: ['', Validators.email],
    
    address: [''], city: [''], state: [''], zip: [''],
    height: this.fb.control<number | null>(null, [Validators.min(30), Validators.max(250)]),
    weight: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(500)]),
    medications: [''], history: [''],
    ecName: ['', Validators.required], ecRelation: ['', Validators.required], ecPhone: ['', [Validators.required, this.phoneRe]],
    insurer: [''], policy: [''], validTill: [''], consent: [false, Validators.requiredTrue],
    doctorId: [DOCTORS[0].id, Validators.required], priority: ['normal' as Priority], reason: ['', Validators.required],
  });

  sections: { title: string; fields: Field[] }[] = [
    { title: 'Personal details', fields: [
      { key: 'firstName', label: 'First name', req: true, ph: 'Priya' }, { key: 'lastName', label: 'Last name', req: true, ph: 'Sharma' },
      { key: 'dob', label: 'Date of birth', type: 'date', req: true },
      { key: 'bloodGroup', label: 'Blood group', kind: 'select', opts: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
      { key: 'gender', kind: 'custom', span: true },
      { key: 'marital', label: 'Marital status', kind: 'select', opts: ['Single', 'Married', 'Divorced', 'Widowed'] }, { key: 'occupation', label: 'Occupation' } ] },
    { title: 'Contact & address', fields: [
      { key: 'phone', label: 'Mobile number', type: 'tel', req: true, ph: '+91 98765 43210' }, { key: 'altPhone', label: 'Alternate number', type: 'tel' },
      { key: 'email', label: 'Email address', type: 'email', span: true }, { key: 'address', label: 'Street address', span: true },
      { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'zip', label: 'PIN / postal code' } ] },
    { title: 'Medical profile', fields: [
      { key: 'height', label: 'Height', type: 'number', unit: 'cm' }, { key: 'weight', label: 'Weight', type: 'number', unit: 'kg' },
      { key: 'allergies', kind: 'custom', span: true }, { key: 'conditions', kind: 'custom', span: true },
      { key: 'medications', label: 'Current medications', kind: 'textarea', span: true }, { key: 'history', label: 'Past surgeries & notes', kind: 'textarea', span: true } ] },
    { title: 'Emergency contact & insurance', fields: [
      { key: 'ecName', label: 'Emergency contact name', req: true }, { key: 'ecRelation', label: 'Relationship', kind: 'select', req: true, opts: ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'] },
      { key: 'ecPhone', label: 'Emergency phone', type: 'tel', req: true, span: true },
      { key: 'insurer', label: 'Insurance provider' }, { key: 'policy', label: 'Policy number' }, { key: 'validTill', label: 'Valid till', type: 'date', span: true },
      { key: 'consent', kind: 'custom', span: true } ] },
  ];
  vitalsForm = this.fb.group({ sys: [null as number | null], dia: [null as number | null], pulse: [null as number | null], temp: [null as number | null], spo2: [null as number | null], weight: [null as number | null] });
  doneForm = this.fb.nonNullable.group({ notes: [''], followUp: [''] });

  results = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.patients.patients().filter(p => !q || `${p.firstName} ${p.lastName} ${p.id} ${p.phone}`.toLowerCase().includes(q)).slice(0, 5);
  });

  list = computed(() => this.opd.today().filter(v => this.doctorFilter() === 'all' || v.doctorId === this.doctorFilter()));
  board = computed(() => Object.fromEntries(this.columns.map(c => [c.key, this.opd.sorted(this.list().filter(v => v.status === c.key))])) as Record<string, Visit[]>);
  finished = computed(() => this.list().filter(v => v.status === 'done' || v.status === 'cancelled').sort((a, b) => (b.tDone ?? '').localeCompare(a.tDone ?? '')));

  desks = computed(() => this.doctors.map(d => {
    const mine = this.opd.today().filter(v => v.doctorId === d.id);
    const ready = this.opd.sorted(mine.filter(v => v.status === 'ready'));
    return { ...d, current: mine.find(v => v.status === 'consult') ?? null, next: ready[0] ?? null, readyCount: ready.length,
      queued: mine.filter(v => ['waiting', 'vitals', 'ready'].includes(v.status)).length };
  }));

  stats = computed(() => {
    const t = this.opd.today();
    const waits = t.filter(v => v.tConsult).map(v => (Date.parse(v.tConsult!) - Date.parse(v.tIn)) / 60000);
    return [
      { label: 'In queue', value: t.filter(v => ['waiting', 'vitals', 'ready'].includes(v.status)).length, tone: 'amber' },
      { label: 'Avg wait (min)', value: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0, tone: 'blue' },
      { label: 'With doctor', value: t.filter(v => v.status === 'consult').length, tone: 'green' },
      { label: 'Completed today', value: t.filter(v => v.status === 'done').length, tone: 'violet' },
    ];
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // arriving from the Patients page: /opd?patient=P-10001 opens check-in with that patient picked
    const id = inject(ActivatedRoute).snapshot.queryParamMap.get('patient');
    const p = id ? this.patients.patients().find(x => x.id === id) : null;
    if (p) { this.openCheckIn('existing'); this.pick(p); }
  }

  doctor = (v: Visit) => this.doctors.find(d => d.id === v.doctorId)!;
  wait(v: Visit) { return Math.max(0, Math.floor(((v.tConsult ? Date.parse(v.tConsult) : this.now()) - Date.parse(v.tIn)) / 60000)); }
  total(v: Visit) { return v.tDone ? Math.round((Date.parse(v.tDone) - Date.parse(v.tIn)) / 60000) : 0; }
  time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  ageOf(dob: string) { const a = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000); return dob && a >= 0 && a < 130 ? a : null; }
  age = (p: Patient) => this.ageOf(p.dob);
  name = (p: Patient) => `${p.firstName} ${p.lastName}`.trim();
  initials = (p: Patient) => ((p.firstName[0] ?? '') + (p.lastName[0] ?? '')).toUpperCase();
fullAddress = (p: Patient) => [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ');
  say(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(''), 3000); }
  closeModal() { this.modal.set(null); this.target.set(null); }

  openCheckIn(mode: 'new' | 'existing' = 'new') {
    this.regForm.reset({ doctorId: this.doctors[0].id, priority: 'normal', consent: false });
    this.allergies.set([]); this.conditions.set([]);
    this.mode.set(mode); this.search.set(''); this.picked.set(null); this.pickError.set(false);
    this.modal.set('checkin');
  }
  setMode(m: 'new' | 'existing') { this.mode.set(m); this.picked.set(null); this.pickError.set(false); }
  pick(p: Patient) { this.picked.set(p); this.pickError.set(false); }

  err(key: string): string {
    const c = this.regForm.get(key); if (!c || !c.touched || !c.invalid) return '';
    const e = c.errors!;
    return e['required'] || e['requiredTrue'] ? 'This field is required.' : e['email'] ? 'Enter a valid email address.'
      : e['pattern'] ? 'Check the format.' : e['minlength'] ? 'Too short.' : 'Value is out of range.';
  }
  addAllergy(input: HTMLInputElement) {
    const v = input.value.trim();
    if (v && !this.allergies().includes(v)) this.allergies.update(a => [...a, v]);
    input.value = '';
  }
  removeAllergy(i: number) { this.allergies.update(a => a.filter((_, x) => x !== i)); }
  toggleCondition(c: string) { this.conditions.update(l => (l.includes(c) ? l.filter(x => x !== c) : [...l, c])); }

  submitCheckIn() {
    const f = this.regForm;
    const visitBad = ['doctorId', 'reason'].some(k => f.get(k)!.invalid);
    if (visitBad) { f.get('doctorId')!.markAsTouched(); f.get('reason')!.markAsTouched(); }
    let who: { patientId: string; name: string; age: number | null; gender: string; phone: string };

    if (this.mode() === 'existing') {
      const p = this.picked();
      if (!p) { this.pickError.set(true); return; }
      if (visitBad) return;
      who = { patientId: p.id, name: this.name(p), age: this.age(p), gender: p.gender, phone: p.phone };
    } else {
      if (f.invalid) { f.markAllAsTouched(); setTimeout(() => document.querySelector('.modal .invalid')?.scrollIntoView({ block: 'center', behavior: 'smooth' })); return; }
      const { consent, doctorId, priority, reason, ...info } = f.getRawValue();
      const saved = this.patients.add({ ...info, allergies: this.allergies(), conditions: this.conditions() });
      who = { patientId: saved.id, name: this.name(saved), age: this.ageOf(saved.dob), gender: saved.gender, phone: saved.phone };
    }
    const v = this.opd.checkIn({ ...who, doctorId: f.value.doctorId!, reason: f.value.reason!.trim(), priority: f.value.priority as Priority });
    this.closeModal();
    this.say(`${this.mode() === 'new' ? 'Patient saved (' + who.patientId + '). ' : ''}Token ${v.token} issued to ${v.name}`);
  }

  openVitals(v: Visit) { this.target.set(v); this.vitalsForm.reset(); this.modal.set('vitals'); }
  submitVitals() {
    const v = this.target(); if (!v) return;
    this.opd.saveVitals(v.id, this.vitalsForm.getRawValue() as any);
    this.say(`${v.name} is ready for ${this.doctor(v).name}`);
    this.closeModal();
  }
  openComplete(v: Visit) { this.target.set(v); this.doneForm.reset(); this.modal.set('complete'); }
  submitComplete() {
    const v = this.target(); if (!v) return;
    const f = this.doneForm.getRawValue();
    this.opd.complete(v.id, f.notes, f.followUp);
    this.say(`Visit completed for ${v.name}`);
    this.closeModal();
  }

  callNext(doctorId: string) {
    const v = this.opd.callNext(doctorId);
    if (v) this.say(`Now serving ${v.token} · ${v.name}`);
  }
  cancel(v: Visit) { this.opd.cancel(v.id); this.say(`${v.token} marked as cancelled`); }
}