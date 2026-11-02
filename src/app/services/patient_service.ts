import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, delay, of, tap } from 'rxjs';

export interface Patient {
  id: string; createdAt: string;
  firstName: string; lastName: string; dob: string; gender: string; bloodGroup: string; marital: string; occupation: string;
  phone: string; altPhone: string; email: string; address: string; city: string; state: string; zip: string;
  height: number | null; weight: number | null; medications: string; history: string;
  allergies: string[]; conditions: string[];
  ecName: string; ecRelation: string; ecPhone: string; insurer: string; policy: string; validTill: string;
}
export type NewPatient = Omit<Patient, 'id' | 'createdAt'>;

const blank: NewPatient = {
  firstName: '', lastName: '', dob: '', gender: '', bloodGroup: '', marital: '', occupation: '',
  phone: '', altPhone: '', email: '', address: '', city: '', state: '', zip: '',
  height: null, weight: null, medications: '', history: '', allergies: [], conditions: [],
  ecName: '', ecRelation: '', ecPhone: '', insurer: '', policy: '', validTill: '',
};

/** true = static sample data (in memory). Set to false to call your API. */
const USE_MOCK = true;
const API_BASE = 'http://localhost:3000/api';

/**
 * Endpoints used when USE_MOCK = false:
 *   GET     {API_BASE}/patients          -> Patient[]
 *   POST    {API_BASE}/patients          -> Patient   (body: NewPatient; the server issues the id, e.g. "P-10006", and createdAt)
 *   PUT     {API_BASE}/patients/:id      -> Patient   (body: Patient)
 *   DELETE  {API_BASE}/patients/:id      -> 204
 */
@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly http = inject(HttpClient); // add provideHttpClient() in app.config.ts

  patients = signal<Patient[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() { this.refresh(); }

  /** Loads the patient list (static sample data in mock mode). Also used to roll back after a failed call. */
  refresh(): void {
    this.loading.set(true);
    const source$: Observable<Patient[]> = USE_MOCK
      ? of(this.patients().length ? this.patients() : seedPatients()).pipe(delay(250))
      : this.http.get<Patient[]>(`${API_BASE}/patients`);
    source$.subscribe({
      next: l => { this.patients.set(l); this.error.set(null); this.loading.set(false); },
      error: e => { this.error.set(this.message(e)); this.loading.set(false); },
    });
  }

  private nextId() {
    const max = this.patients().reduce((m, p) => Math.max(m, +p.id.replace(/\D/g, '') || 0), 10000);
    return 'P-' + (max + 1);
  }

  /** Runs the API call (API mode only). On failure the list is reloaded from the server, which undoes the on-screen change. */
  private send<T>(req: () => Observable<T>, onOk?: (r: T) => void) {
    if (USE_MOCK) { return; }
    req().subscribe({
      next: r => onOk?.(r),
      error: e => { this.error.set(this.message(e)); this.refresh(); },
    });
  }

  /** Shows the patient immediately. In API mode the provisional id is replaced by the server's id a moment later. */
  add(p: NewPatient): Patient {
    const saved: Patient = { ...p, id: this.nextId(), createdAt: new Date().toISOString() };
    this.patients.update(l => [saved, ...l]);
    this.send(() => this.http.post<Patient>(`${API_BASE}/patients`, p),
      s => this.patients.update(l => l.map(x => (x.id === saved.id ? s : x))));
    return saved;
  }

  /** Waits for the server. Use this when you need the real id right away, for example to open the new patient or check them in. */
  add$(p: NewPatient): Observable<Patient> {
    if (USE_MOCK) { return of(this.add(p)).pipe(delay(300)); }
    return this.http.post<Patient>(`${API_BASE}/patients`, p).pipe(tap(s => this.patients.update(l => [s, ...l])));
  }

  update(id: string, patch: Partial<NewPatient>) {
    const current = this.patients().find(p => p.id === id);
    if (!current) { return; }
    const next: Patient = { ...current, ...patch };
    this.patients.update(l => l.map(p => (p.id === id ? next : p)));
    this.send(() => this.http.put<Patient>(`${API_BASE}/patients/${id}`, next),
      s => this.patients.update(l => l.map(p => (p.id === id ? s : p))));
  }

  remove(id: string) {
    this.patients.update(l => l.filter(p => p.id !== id));
    this.send(() => this.http.delete<void>(`${API_BASE}/patients/${id}`));
  }

  /** Resets the list to the static sample data (mock mode only). */
  loadSamples() {
    if (!USE_MOCK) { return; }
    this.patients.set(seedPatients());
  }

  private message(e: any): string {
    return e?.error?.message ?? (e?.status === 0 ? 'Cannot reach the server' : e?.message ?? 'Request failed');
  }
}

/* ---------------- static sample data (in memory) ---------------- */
function seedPatients(): Patient[] {
  const day = 86400000, ago = (d: number) => new Date(Date.now() - d * day).toISOString();
  const s: Partial<Patient>[] = [
    { firstName: 'Priya', lastName: 'Sharma', dob: '1992-04-12', gender: 'Female', bloodGroup: 'B+', phone: '+91 98765 43210', email: 'priya.s@mail.com', city: 'Chennai', height: 162, weight: 56, allergies: ['Penicillin'], conditions: [], ecName: 'Raj Sharma', ecRelation: 'Spouse', ecPhone: '+91 98765 11111', insurer: 'Star Health', policy: 'SH-20931' },
    { firstName: 'Daniel', lastName: 'Raj', dob: '1978-09-03', gender: 'Male', bloodGroup: 'O+', phone: '+91 90000 22222', email: 'daniel.r@mail.com', city: 'Coimbatore', height: 176, weight: 88, conditions: ['Diabetes', 'Hypertension'], medications: 'Metformin 500mg twice daily', ecName: 'Anita Raj', ecRelation: 'Spouse', ecPhone: '+91 90000 33333' },
    { firstName: 'Meera', lastName: 'Krishnan', dob: '2001-12-25', gender: 'Female', bloodGroup: 'A+', phone: '+91 97000 44444', city: 'Tiruppur', height: 158, weight: 49, allergies: ['Dust', 'Peanuts'], conditions: ['Asthma'], ecName: 'S. Krishnan', ecRelation: 'Parent', ecPhone: '+91 97000 55555' },
    { firstName: 'Arun', lastName: 'Vijay', dob: '1965-02-18', gender: 'Male', bloodGroup: 'AB-', phone: '+91 96000 66666', city: 'Erode', height: 170, weight: 79, conditions: ['Heart disease', 'Hypertension', 'Thyroid'], history: 'Bypass surgery, 2019', ecName: 'Kavya Arun', ecRelation: 'Child', ecPhone: '+91 96000 77777' },
    { firstName: 'Sana', lastName: 'Fathima', dob: '2015-06-30', gender: 'Female', bloodGroup: 'O-', phone: '+91 95000 88888', city: 'Salem', height: 128, weight: 27, ecName: 'Imran Khan', ecRelation: 'Parent', ecPhone: '+91 95000 99999' },
  ];
  return s.map((p, i) => ({ ...blank, ...p, id: 'P-' + (10001 + i), createdAt: ago(i * 2) } as Patient)).reverse();
}