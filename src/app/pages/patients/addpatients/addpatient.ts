import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NewPatient, PatientService } from '../../../services/patient_service';

type Field = { key: string; label?: string; kind?: 'select' | 'textarea' | 'custom'; type?: string; ph?: string; opts?: string[]; span?: boolean; unit?: string; req?: boolean };

const req = Validators.required;
const phone = Validators.pattern(/^[0-9+\-\s]{7,15}$/);

@Component({
  selector: 'app-addpatients',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './addpatient.html',
  styleUrl: './addpatient.scss',
})
export class PatientFormComponent {
  private fb = inject(FormBuilder);
  private patientService = inject(PatientService);

  form = this.fb.nonNullable.group({
    personal: this.fb.nonNullable.group({
      firstName: ['', [req, Validators.minLength(2)]], lastName: ['', req], dob: ['', req], gender: ['', req],
      bloodGroup: [''], marital: [''], occupation: [''],
    }),
    contact: this.fb.nonNullable.group({
      phone: ['', [req, phone]], altPhone: ['', phone], email: ['', Validators.email],
      address: [''], city: [''], state: [''], zip: ['', Validators.pattern(/^[A-Za-z0-9\s-]{3,10}$/)],
    }),
    medical: this.fb.nonNullable.group({
      height: this.fb.control<number | null>(null, [Validators.min(30), Validators.max(250)]),
      weight: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(500)]),
      medications: [''], history: [''],
    }),
    emergency: this.fb.nonNullable.group({
      ecName: ['', req], ecRelation: ['', req], ecPhone: ['', [req, phone]],
      insurer: [''], policy: [''], validTill: [''], consent: [false, Validators.requiredTrue],
    }),
  });

  steps: { group: string; label: string; title: string; sub: string; fields: Field[] }[] = [
    { group: 'personal', label: 'Personal', title: 'Personal details', sub: 'Who is the patient?', fields: [
      { key: 'firstName', label: 'First name', ph: 'Priya', req: true }, { key: 'lastName', label: 'Last name', ph: 'Sharma', req: true },
      { key: 'dob', label: 'Date of birth', type: 'date', req: true },
      { key: 'bloodGroup', label: 'Blood group', kind: 'select', opts: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
      { key: 'gender', kind: 'custom', span: true },
      { key: 'marital', label: 'Marital status', kind: 'select', opts: ['Single', 'Married', 'Divorced', 'Widowed'] },
      { key: 'occupation', label: 'Occupation', ph: 'Teacher' } ] },
    { group: 'contact', label: 'Contact', title: 'Contact & address', sub: 'How can we reach them?', fields: [
      { key: 'phone', label: 'Mobile number', type: 'tel', ph: '+91 98765 43210', req: true }, { key: 'altPhone', label: 'Alternate number', type: 'tel' },
      { key: 'email', label: 'Email address', type: 'email', ph: 'patient@email.com', span: true },
      { key: 'address', label: 'Street address', ph: 'House no., street, area', span: true },
      { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'zip', label: 'PIN / postal code' } ] },
    { group: 'medical', label: 'Medical', title: 'Medical profile', sub: 'Helps doctors prepare for the visit.', fields: [
      { key: 'height', label: 'Height', type: 'number', unit: 'cm', ph: '170' }, { key: 'weight', label: 'Weight', type: 'number', unit: 'kg', ph: '65' },
      { key: 'bmi', kind: 'custom', span: true }, { key: 'allergies', kind: 'custom', span: true }, { key: 'conditions', kind: 'custom', span: true },
      { key: 'medications', label: 'Current medications', kind: 'textarea', ph: 'Name, dose, how often', span: true },
      { key: 'history', label: 'Past surgeries & notes', kind: 'textarea', ph: 'Anything the doctor should know', span: true } ] },
    { group: 'emergency', label: 'Emergency & insurance', title: 'Emergency contact & insurance', sub: 'Last step.', fields: [
      { key: 'ecName', label: 'Emergency contact name', req: true }, { key: 'ecRelation', label: 'Relationship', kind: 'select', req: true, opts: ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'] },
      { key: 'ecPhone', label: 'Emergency phone', type: 'tel', req: true, span: true },
      { key: 'insurer', label: 'Insurance provider' }, { key: 'policy', label: 'Policy number' },
      { key: 'validTill', label: 'Valid till', type: 'date', span: true },
      { key: 'consent', kind: 'custom', span: true } ] },
  ];

  conditionList = ['Diabetes', 'Hypertension', 'Asthma', 'Heart disease', 'Thyroid', 'Arthritis', 'Kidney disease'];
  genders = ['Male', 'Female', 'Other'];

  step = signal(0);
  dir = signal(1);
  loading = signal(false);
  done = signal(false);
  patientId = signal('');
  errorMsg = signal<string | null>(null);
  allergies = signal<string[]>([]);
  conditions = signal<string[]>([]);

  cur = computed(() => this.steps[this.step()]);
  isLast = computed(() => this.step() === this.steps.length - 1);
  private value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  private required = ['personal.firstName', 'personal.lastName', 'personal.dob', 'personal.gender', 'contact.phone',
    'emergency.ecName', 'emergency.ecRelation', 'emergency.ecPhone', 'emergency.consent'];
  progress = computed(() => { this.value(); return Math.round(this.required.filter(p => this.form.get(p)!.valid).length / this.required.length * 100); });

  fullName = computed(() => `${this.value().personal?.firstName ?? ''} ${this.value().personal?.lastName ?? ''}`.trim());
  initials = computed(() => ((this.value().personal?.firstName?.[0] ?? '') + (this.value().personal?.lastName?.[0] ?? '')).toUpperCase() || '+');
  age = computed(() => {
    const d = this.value().personal?.dob; if (!d) return null;
    const a = Math.floor((Date.now() - new Date(d).getTime()) / 31557600000); return a >= 0 && a < 130 ? a : null;
  });
  bmi = computed(() => {
    const h = this.value().medical?.height, w = this.value().medical?.weight;
    if (!h || !w || h < 30) return null;
    const v = +(w / ((h / 100) ** 2)).toFixed(1);
    const label = v < 18.5 ? 'Underweight' : v < 25 ? 'Healthy' : v < 30 ? 'Overweight' : 'Obese';
    return { v, label, pos: Math.min(100, Math.max(0, (v - 15) / 25 * 100)) };
  });

  err(path: string): string {
    const c = this.form.get(path); if (!c || !c.touched || !c.invalid) return '';
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
  toggleCondition(c: string) { this.conditions.update(l => l.includes(c) ? l.filter(x => x !== c) : [...l, c]); }

  goTo(i: number) { if (i < this.step()) { this.dir.set(-1); this.step.set(i); } }
  back() { this.dir.set(-1); this.step.update(s => s - 1); }

  /** The form is split into groups (personal, contact, ...). The API model is flat, so join them here. */
  private toNewPatient(): NewPatient {
    const { personal, contact, medical, emergency } = this.form.getRawValue();
    const { consent, ...emergencyFields } = emergency; // consent is checked by the form, not stored here
    return {
      ...personal,
      ...contact,
      ...medical,
      ...emergencyFields,
      allergies: this.allergies(),
      conditions: this.conditions(),
    };
  }

  submit() {
  console.log('1 submit clicked', { step: this.step(), loading: this.loading() });
  if (this.loading()) return;

  const group = this.form.get(this.cur().group)!;
  if (group.invalid) {
    console.log('2 step invalid', group.errors, group.value);
    Object.entries((group as any).controls).forEach(([k, c]: any) => c.invalid && console.log('  invalid field:', k, c.errors));
    group.markAllAsTouched(); return;
  }
  if (!this.isLast()) { this.dir.set(1); this.step.update(s => s + 1); return; }
  if (this.form.invalid) {
    console.log('3 whole form invalid', this.form.errors);
    this.form.markAllAsTouched();
    this.dir.set(-1);
    this.step.set(this.steps.findIndex(s => this.form.get(s.group)!.invalid));
    return;
  }

  console.log('4 calling API', this.toNewPatient());
  this.loading.set(true);
  this.errorMsg.set(null);

  this.patientService.add$(this.toNewPatient()).subscribe({
    next: (saved) => { console.log('5 saved', saved); this.patientId.set(saved.id); this.loading.set(false); this.done.set(true); },
    error: (err: Error) => { console.log('6 failed', err); this.loading.set(false); this.errorMsg.set(err.message); },
  });
}

  reset() {
    this.form.reset(); this.allergies.set([]); this.conditions.set([]);
    this.errorMsg.set(null);
    this.step.set(0); this.dir.set(1); this.done.set(false);
  }
}