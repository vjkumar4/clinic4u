import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConsultationService } from '../../services/consultation_service';
import { ConsultationNotes, ConsultationPayload, ConsultationRecord, Medicine } from './model/consultation.model';
type Flag = 'ok' | 'warn' | 'high';
const QUEUE_ROUTE = '/vitals-triage';

@Component({
  selector: 'app-consultation',
  imports: [FormsModule, RouterLink],
  templateUrl: './consultation.html',
  styleUrl: './consultation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Consultation {
  private readonly api = inject(ConsultationService);
  private readonly router = inject(Router);
  private readonly visitId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? 'v6';

  readonly queueRoute = QUEUE_ROUTE;
  readonly frequencies = ['Once daily', 'Twice daily', 'Three times daily', 'At night', 'As needed'];
  readonly quickMeds: Partial<Medicine>[] = [
    { name: 'Paracetamol', dose: '500 mg', frequency: 'Three times daily', duration: '3 days', instructions: 'After food' },
    { name: 'Cetirizine', dose: '10 mg', frequency: 'At night', duration: '5 days', instructions: '' },
    { name: 'Azithromycin', dose: '500 mg', frequency: 'Once daily', duration: '3 days', instructions: 'Before food' },
    { name: 'ORS', dose: '1 sachet', frequency: 'As needed', duration: '2 days', instructions: 'In 1 L water' }
  ];
  readonly testOptions = ['CBC', 'Blood sugar', 'CRP', 'Chest X-ray', 'ECG', 'Urine routine', 'Thyroid profile', 'Lipid profile'];
  readonly diagnosisHints = ['Viral fever', 'Acute bronchitis', 'URTI', 'Hypertension', 'Type 2 diabetes', 'Gastritis'];

  readonly data = signal<ConsultationRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal<'draft' | 'complete' | null>(null);
  readonly submitted = signal(false);
  readonly toast = signal<string | null>(null);
  readonly confirming = signal(false);
  private readonly now = signal(Date.now());

  notes: ConsultationNotes = { symptoms: '', examination: '', diagnosis: '', advice: '', followUp: '' };
  medicines: Medicine[] = [];
  tests: string[] = [];

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    this.load();
  }

  readonly elapsed = computed(() => {
    const d = this.data(); if (!d) { return '00:00'; }
    const s = Math.max(0, Math.floor((this.now() - new Date(d.startedAt).getTime()) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  readonly tiles = computed(() => {
    const v = this.data()?.vitals; if (!v) { return []; }
    return [
      { label: 'Blood pressure', value: `${v.systolic}/${v.diastolic}`, unit: 'mmHg', flag: this.bpFlag(v.systolic) },
      { label: 'Pulse', value: String(v.pulse), unit: 'bpm', flag: this.range(v.pulse, 50, 100, 40, 130) },
      { label: 'SpO₂', value: String(v.spo2), unit: '%', flag: (v.spo2 < 90 ? 'high' : v.spo2 < 94 ? 'warn' : 'ok') as Flag },
      { label: 'Temperature', value: v.temperature.toFixed(1), unit: '°C', flag: (v.temperature >= 39 || v.temperature < 35 ? 'high' : v.temperature >= 37.5 ? 'warn' : 'ok') as Flag },
      { label: 'Resp. rate', value: String(v.respRate), unit: '/min', flag: this.range(v.respRate, 10, 24, 8, 30) },
      { label: 'BMI', value: v.weight && v.height ? (v.weight / Math.pow(v.height / 100, 2)).toFixed(1) : '--', unit: '', flag: 'ok' as Flag }
    ];
  });

  load(): void {
    this.loading.set(true); this.error.set(null);
    this.api.get(this.visitId).subscribe({
      next: d => { this.data.set(d); this.notes = { ...d.notes }; this.medicines = d.medicines.map(m => ({ ...m })); this.tests = [...d.tests]; this.loading.set(false); },
      error: (e: { message?: string }) => { this.error.set(e?.message ?? 'Could not load this consultation.'); this.loading.set(false); }
    });
  }

  initials(n: string): string { return n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase(); }

  /* prescription */
  addMedicine(m?: Partial<Medicine>): void {
    this.medicines = [...this.medicines, { name: '', dose: '', frequency: 'Twice daily', duration: '', instructions: '', ...m }];
  }
  removeMedicine(i: number): void { this.medicines = this.medicines.filter((_, k) => k !== i); }
  hasAllergyWarning(m: Medicine): boolean {
    const a = this.data()?.patient.allergies.toLowerCase();
    return !!a && a !== 'none' && !!m.name.trim() && a.split(',').some(x => x.trim() && m.name.toLowerCase().includes(x.trim()));
  }

  /* investigations */
  toggleTest(t: string): void { this.tests = this.tests.includes(t) ? this.tests.filter(x => x !== t) : [...this.tests, t]; }

  /* save / complete */
  private payload(): ConsultationPayload {
    return { notes: { ...this.notes }, medicines: this.medicines.filter(m => m.name.trim()), tests: [...this.tests] };
  }
  saveDraft(): void {
    this.saving.set('draft');
    this.api.saveDraft(this.visitId, this.payload()).subscribe({
      next: () => { this.saving.set(null); this.flash('Draft saved'); },
      error: (e: { message?: string }) => { this.saving.set(null); this.flash(e?.message ?? 'Could not save draft.'); }
    });
  }
  askComplete(): void {
    this.submitted.set(true);
    if (!this.notes.diagnosis.trim()) { this.flash('Add a diagnosis before completing.'); return; }
    this.confirming.set(true);
  }
  complete(): void {
    this.confirming.set(false); this.saving.set('complete');
    this.api.complete(this.visitId, this.payload()).subscribe({
      next: () => { this.saving.set(null); this.flash('Consultation completed'); setTimeout(() => this.router.navigateByUrl(QUEUE_ROUTE), 900); },
      error: (e: { message?: string }) => { this.saving.set(null); this.flash(e?.message ?? 'Could not complete the consultation.'); }
    });
  }

  private flash(msg: string): void { this.toast.set(msg); setTimeout(() => this.toast.set(null), 2800); }
  private bpFlag(sys: number): Flag { return sys >= 180 || sys < 90 ? 'high' : sys >= 140 || sys < 100 ? 'warn' : 'ok'; }
  private range(v: number, lo: number, hi: number, critLo: number, critHi: number): Flag {
    return v < critLo || v > critHi ? 'high' : v < lo || v > hi ? 'warn' : 'ok';
  }
}