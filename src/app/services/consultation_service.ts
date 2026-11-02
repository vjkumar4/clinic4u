import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, debounceTime, delay, map, of, switchMap, tap, throwError } from 'rxjs';
import {
  CompleteResult, ConsultationDraft, Diagnosis, Investigation, Prescription, SaveState,
  SearchKind, Suggestion, Visit, VisitSnapshot,
} from '../pages/consultation/model/consultation.model';

/** true = static sample data. Set to false to call your API. */
const USE_MOCK = true;
const API_BASE = 'http://localhost:3000/api';

/**
 * Endpoints used when USE_MOCK = false:
 *   GET   {API_BASE}/visits/:id                   -> Visit
 *   PUT   {API_BASE}/visits/:id                   -> 2xx      (body: VisitSnapshot = draft, diagnoses, prescriptions, investigations)
 *   POST  {API_BASE}/visits/:id/complete          -> CompleteResult   (marks the visit completed and creates the bill)
 *   GET   {API_BASE}/icd?q=                       -> Suggestion[]     ({ code, name })
 *   GET   {API_BASE}/medicines?q=                 -> Suggestion[]     ({ name, detail? })
 *   GET   {API_BASE}/lab-tests?q=                 -> Suggestion[]     ({ code, name, price })
 */
@Injectable({ providedIn: 'root' })
export class ConsultationService {
  private readonly http = inject(HttpClient); // add provideHttpClient() in app.config.ts

  /* ---------------- data access: static sample data or API ---------------- */
  getVisit(id: string): Observable<Visit> {
    if (!USE_MOCK) { return this.http.get<Visit>(`${API_BASE}/visits/${id}`); }
    return of(structuredClone({ ...visitStore, id })).pipe(delay(450));
  }

  saveVisit(id: string, snap: VisitSnapshot): Observable<void> {
    if (!USE_MOCK) { return this.http.put(`${API_BASE}/visits/${id}`, snap).pipe(map(() => void 0)); }
    visitStore = { ...visitStore, ...structuredClone(snap) };
    return of(void 0).pipe(delay(300));
  }

  search(kind: SearchKind, q: string): Observable<Suggestion[]> {
    if (!USE_MOCK) { return this.http.get<Suggestion[]>(`${API_BASE}/${SEARCH_PATH[kind]}`, { params: { q } }); }
    const needle = q.toLowerCase();
    return of(LISTS[kind].filter(s => (s.name + (s.code ?? '')).toLowerCase().includes(needle))).pipe(delay(200));
  }

  completeVisit(id: string): Observable<CompleteResult> {
    if (!USE_MOCK) { return this.http.post<CompleteResult>(`${API_BASE}/visits/${id}/complete`, {}); }
    visitStore = { ...visitStore, status: 'Completed' };
    const total = visitStore.consultationFee + visitStore.investigations.reduce((s, t) => s + t.price, 0);
    return of({ billId: 'BL-' + String(billNo++).padStart(4, '0'), total, completedAt: new Date().toISOString() }).pipe(delay(400));
  }

  /* ---------------- state used by the page ---------------- */
  readonly visit = signal<Visit | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly draft = signal<ConsultationDraft>(EMPTY_DRAFT);
  readonly diagnoses = signal<Diagnosis[]>([]);
  readonly prescriptions = signal<Prescription[]>([]);
  readonly investigations = signal<Investigation[]>([]);

  readonly saveState = signal<SaveState>('idle');
  readonly lastSaved = signal<Date | null>(null);

  readonly patient = computed(() => this.visit()?.patient ?? null);
  readonly readOnly = computed(() => this.visit()?.status === 'Completed');
  readonly fee = computed(() => this.visit()?.consultationFee ?? 0);
  readonly labTotal = computed(() => this.investigations().reduce((s, t) => s + t.price, 0));
  readonly total = computed(() => this.fee() + this.labTotal());
  private readonly snapshot = computed<VisitSnapshot>(() => ({
    draft: this.draft(), diagnoses: this.diagnoses(), prescriptions: this.prescriptions(), investigations: this.investigations(),
  }));

  private savedJson = '';
  private readonly changes$ = new Subject<void>();

  constructor() {
    // Mark dirty when the editable state differs from what was last saved, then auto-save (debounced).
    effect(() => {
      const snap = this.snapshot();
      if (!this.visit() || this.readOnly()) return;
      if (JSON.stringify(snap) === this.savedJson) return;
      this.saveState.set('dirty');
      this.changes$.next();
    });
    this.changes$.pipe(
      debounceTime(1200),
      switchMap(() => this.persist().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(),
    ).subscribe();
  }

  load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.getVisit(id).subscribe({
      next: v => {
        this.draft.set(v.draft);
        this.diagnoses.set(v.diagnoses);
        this.prescriptions.set(v.prescriptions);
        this.investigations.set(v.investigations);
        this.savedJson = JSON.stringify(this.snapshot());
        this.saveState.set('idle');
        this.visit.set(v);
        this.loading.set(false);
      },
      error: e => { this.error.set(this.message(e)); this.loading.set(false); },
    });
  }

  // ---- edits ----
  updateDraft(patch: Partial<ConsultationDraft>): void { this.draft.update(d => ({ ...d, ...patch })); }

  addDiagnosis(s: Suggestion): void {
    if (this.diagnoses().some(d => d.name === s.name)) return;
    this.diagnoses.update(l => [...l, { code: s.code ?? '—', name: s.name, primary: l.length === 0 }]);
  }
  setPrimary(name: string): void { this.diagnoses.update(l => l.map(d => ({ ...d, primary: d.name === name }))); }
  removeDiagnosis(name: string): void {
    this.diagnoses.update(l => {
      const next = l.filter(d => d.name !== name);
      if (next.length && !next.some(d => d.primary)) next[0] = { ...next[0], primary: true };
      return next;
    });
  }

  /** Returns true when the medicine conflicts with a recorded allergy. */
  addPrescription(s: Suggestion): boolean {
    const conflict = this.conflicts(s.name);
    this.prescriptions.update(l => [...l, {
      id: crypto.randomUUID(), name: s.name, dosage: s.detail ?? '1 tablet', frequency: '1-0-1',
      days: 7, instructions: 'After food', allergyConflict: conflict,
    }]);
    return conflict;
  }
  updatePrescription(id: string, patch: Partial<Prescription>): void {
    this.prescriptions.update(l => l.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }
  removePrescription(id: string): void { this.prescriptions.update(l => l.filter(p => p.id !== id)); }

  addInvestigation(s: Suggestion): void {
    const code = s.code ?? s.name;
    if (this.investigations().some(t => t.code === code)) return;
    this.investigations.update(l => [...l, { code, name: s.name, price: s.price ?? 0, status: 'Ordered' }]);
  }
  removeInvestigation(code: string): void { this.investigations.update(l => l.filter(t => t.code !== code)); }

  /** Save immediately (Save button). */
  flush(): Observable<void> { return this.persist(); }

  /** Saves, then completes the visit and creates the bill. */
  complete(): Observable<CompleteResult> {
    const id = this.visit()!.id;
    return this.persist().pipe(
      switchMap(() => this.completeVisit(id)),
      tap(() => this.visit.update(v => v && { ...v, status: 'Completed' })),
    );
  }

  private persist(): Observable<void> {
    const v = this.visit();
    if (!v) return of(void 0);
    const snap = this.snapshot(); const json = JSON.stringify(snap);
    this.saveState.set('saving');
    return this.saveVisit(v.id, snap).pipe(
      tap(() => {
        this.savedJson = json;
        this.lastSaved.set(new Date());
        this.saveState.set(JSON.stringify(this.snapshot()) === json ? 'saved' : 'dirty');
      }),
      catchError(e => { this.saveState.set('error'); return throwError(() => e); }),
    );
  }

  private conflicts(name: string): boolean {
    const n = name.toLowerCase();
    return (this.patient()?.allergies ?? []).some(a => {
      const key = a.split(/[\s(]/)[0].toLowerCase();
      return (ALLERGY_CLASSES[key] ?? [key]).some(term => n.includes(term));
    });
  }
  private message(e: any): string {
    return e?.status === 404 ? 'Visit not found' : e?.status === 0 ? 'Cannot reach the server' : (e?.message ?? 'Could not load this visit');
  }
}

/* ---------------- static sample data (in memory) ---------------- */
const SEARCH_PATH: Record<SearchKind, string> = { icd: 'icd', medicine: 'medicines', lab: 'lab-tests' };
/** Client-side safety net only. The server should be the source of truth for interactions. */
const ALLERGY_CLASSES: Record<string, string[]> = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'cloxacillin', 'augmentin'],
  sulfa: ['sulfa', 'cotrimoxazole', 'sulfamethoxazole'],
  aspirin: ['aspirin', 'ibuprofen', 'diclofenac', 'naproxen'],
};
const EMPTY_DRAFT: ConsultationDraft = {
  complaint: '', duration: '1 week', severity: 'Mild', history: '', notes: '',
  examGeneral: '', examSystem: '', reviewOfSystems: '', followUpDate: '',
};
const ICD: Suggestion[] = [
  { code: 'E11.42', name: 'Type 2 diabetes with diabetic polyneuropathy' }, { code: 'E11.9', name: 'Type 2 diabetes without complications' },
  { code: 'I10', name: 'Essential hypertension' }, { code: 'J02.9', name: 'Acute pharyngitis' }, { code: 'K21.9', name: 'Gastro-oesophageal reflux disease' },
];
const MEDICINES: Suggestion[] = [
  { name: 'Pregabalin 75 mg', detail: '1 capsule' }, { name: 'Metformin 500 mg', detail: '1 tablet' }, { name: 'Telmisartan 40 mg', detail: '1 tablet' },
  { name: 'Amoxicillin 500 mg', detail: '1 capsule' }, { name: 'Pantoprazole 40 mg', detail: '1 tablet' }, { name: 'Methylcobalamin 1500 mcg', detail: '1 tablet' },
];
const LABS: Suggestion[] = [
  { code: 'HBA1C', name: 'HbA1c', price: 350 }, { code: 'FBS', name: 'Fasting blood glucose', price: 120 }, { code: 'LIPID', name: 'Lipid profile', price: 450 },
  { code: 'KFT', name: 'Kidney function test', price: 500 }, { code: 'B12', name: 'Vitamin B12', price: 600 }, { code: 'NCV', name: 'Nerve conduction study', price: 1800 },
];
const LISTS: Record<SearchKind, Suggestion[]> = { icd: ICD, medicine: MEDICINES, lab: LABS };

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };
let billNo = 1;
let visitStore: Visit = {
  id: 'V-1001', status: 'InProgress', startedAt: new Date().toISOString(), consultationFee: 500,
  patient: {
    id: 'PT-20418', name: 'Arjun Krishnan', age: 42, sex: 'Male', phone: '+91 98400 12345', bloodGroup: 'B+',
    visitType: 'Follow-up', token: 14, allergies: ['Penicillin (rash)'], conditions: ['Type 2 diabetes', 'Hypertension'],
    lastVisit: '12 Sep 2026', doctor: 'Dr. Meera Raman',
  },
  vitalsRecordedBy: 'Nurse Priya', vitalsRecordedAt: new Date().toISOString(),
  vitals: [
    { key: 'bp', label: 'Blood pressure', value: '138/88', unit: 'mmHg', status: 'Review', trend: [128, 132, 130, 136, 138] },
    { key: 'sugar', label: 'Blood sugar', value: 168, unit: 'mg/dL', status: 'Review', trend: [150, 158, 162, 170, 168] },
    { key: 'pulse', label: 'Pulse', value: 82, unit: 'bpm', status: 'Normal', trend: [80, 84, 79, 83, 82] },
    { key: 'temp', label: 'Temperature', value: 98.4, unit: '°F', status: 'Normal' },
    { key: 'spo2', label: 'SpO₂', value: 98, unit: '%', status: 'Normal' },
    { key: 'bmi', label: 'BMI', value: 26.4, unit: 'kg/m²', status: 'Mild', trend: [25.8, 26.0, 26.2, 26.4] },
  ],
  insights: ['HbA1c was 7.4% in June, due for repeat', 'Foot exam overdue by 2 months', 'Reported 2 missed metformin doses'],
  recentVisits: [
    { date: '12 Sep 2026', doctor: 'Dr. Meera Raman', type: 'Follow-up', summary: 'Fever, sore throat' },
    { date: '03 Jun 2026', doctor: 'Dr. Meera Raman', type: 'Consultation', summary: 'HbA1c review' },
  ],
  draft: { ...EMPTY_DRAFT, complaint: 'Burning sensation in feet, worse at night', duration: '3 weeks', severity: 'Moderate', followUpDate: day(14) },
  diagnoses: [], prescriptions: [], investigations: [],
};