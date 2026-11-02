import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, delay, of, timer } from 'rxjs';

export type OpdStatus = 'waiting' | 'vitals' | 'ready' | 'consult' | 'done' | 'cancelled';
export type Priority = 'normal' | 'priority' | 'emergency';
export interface Vitals { sys: number | null; dia: number | null; pulse: number | null; temp: number | null; spo2: number | null; weight: number | null }
export interface Visit {
  id: string; date: string; token: string; patientId: string | null;
  name: string; age: number | null; gender: string; phone: string;
  doctorId: string; reason: string; priority: Priority; status: OpdStatus;
  vitals: Vitals | null; notes: string; followUp: string;
  tIn: string; tVitals: string | null; tReady: string | null; tConsult: string | null; tDone: string | null;
}
export type CheckIn = Pick<Visit, 'patientId' | 'name' | 'age' | 'gender' | 'phone' | 'doctorId' | 'reason' | 'priority'>;


export const DOCTORS = [
  { id: 'D0004', code: 'A', name: 'Dr. Anitha Rao', dept: 'General Medicine' },
  { id: 'D0005', code: 'B', name: 'Dr. Karthik S',  dept: 'Cardiology' },
  { id: 'D0006', code: 'C', name: 'Dr. Meena Iyer', dept: 'Pediatrics' },
];
/** true = static sample data (in memory). Set to false to call your API. */
const USE_MOCK = true;
const API_BASE = 'http://localhost:3000/api';
/** How often the queue is re-read from the server so every desk sees the same queue (API mode only). */
const POLL_MS = 15000;

/**
 * Endpoints used when USE_MOCK = false:
 *   GET   {API_BASE}/opd/visits?date=YYYY-MM-DD        -> Visit[]
 *   POST  {API_BASE}/opd/visits                        -> Visit   (body: CheckIn; the server issues the token, e.g. "A-005")
 *   POST  {API_BASE}/opd/visits/:id/start-vitals       -> Visit   (status "vitals")
 *   PUT   {API_BASE}/opd/visits/:id/vitals             -> Visit   (body: Vitals; status "ready")
 *   POST  {API_BASE}/opd/visits/:id/fast-track         -> Visit   (emergency: skips vitals, status "ready")
 *   POST  {API_BASE}/opd/visits/:id/consult            -> Visit   (doctor calls the patient; reject with 409 if the doctor is busy)
 *   POST  {API_BASE}/opd/visits/:id/complete           -> Visit   (body: { notes, followUp })
 *   POST  {API_BASE}/opd/visits/:id/cancel             -> Visit
 *
 * For true live updates, replace the polling in the constructor with SSE or a WebSocket.
 */
const todayStr = () => new Date().toLocaleDateString('en-CA');          // YYYY-MM-DD in local time
const nowIso = () => new Date().toISOString();
const rank = (p: Priority) => (p === 'emergency' ? 0 : p === 'priority' ? 1 : 2);

@Injectable({ providedIn: 'root' })
export class OpdService {
  private readonly http = inject(HttpClient); // add provideHttpClient() in app.config.ts

  visits = signal<Visit[]>([]);
  today = computed(() => this.visits().filter(v => v.date === todayStr()));
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    this.refresh();
    if (!USE_MOCK) { timer(POLL_MS, POLL_MS).pipe(takeUntilDestroyed()).subscribe(() => this.refresh()); }
  }

  /** Loads today's queue (static sample data in mock mode). Also used to roll back after a failed call. */
  refresh(): void {
    this.loading.set(true);
    const source$: Observable<Visit[]> = USE_MOCK
      ? of(this.visits().length ? this.visits() : seedVisits()).pipe(delay(250))
      : this.http.get<Visit[]>(`${API_BASE}/opd/visits`, { params: { date: todayStr() } });
    source$.subscribe({
      next: l => { this.visits.set(l); this.error.set(null); this.loading.set(false); },
      error: e => { this.error.set(this.message(e)); this.loading.set(false); },
    });
  }

  /** Emergency first, then priority, then first-come-first-served. */
  sorted(l: Visit[]) { return [...l].sort((a, b) => rank(a.priority) - rank(b.priority) || a.tIn.localeCompare(b.tIn)); }
  busy(doctorId: string) { return this.today().some(v => v.doctorId === doctorId && v.status === 'consult'); }

  /** Updates the screen immediately (optimistic); the API call below confirms it or rolls it back. */
  private patch(id: string, fn: (v: Visit) => Partial<Visit>) {
    this.visits.update(l => l.map(v => (v.id === id ? { ...v, ...fn(v) } : v)));
  }
  private send(req: () => Observable<Visit | null>, replaceId?: string) {
    if (USE_MOCK) { return; }
    req().subscribe({
      next: v => { if (v) { this.visits.update(l => l.map(x => (x.id === (replaceId ?? v.id) ? v : x))); } },
      error: e => { this.error.set(this.message(e)); this.refresh(); },   // roll back to the server's state
    });
  }

  /** 1. Registration desk issues a token. In API mode the token shown first is replaced by the server's one. */
  checkIn(d: CheckIn): Visit {
    const code = DOCTORS.find(x => x.id === d.doctorId)?.code ?? d.doctorId;
    const n = this.today().filter(v => v.doctorId === d.doctorId).length + 1;
    const v: Visit = { ...d, id: crypto.randomUUID(), date: todayStr(), token: `${d.doctorId}-${String(n).padStart(3, '0')}`,
      status: 'waiting', vitals: null, notes: '', followUp: '', tIn: nowIso(), tVitals: null, tReady: null, tConsult: null, tDone: null };
    this.visits.update(l => [...l, v]);
    this.send(() => this.http.post<Visit>(`${API_BASE}/opd/visits`, d), v.id);
    return v;
  }
  /** 2. Nurse picks the patient up. */
  startVitals(id: string) {
    this.patch(id, () => ({ status: 'vitals', tVitals: nowIso() }));
    this.send(() => this.http.post<Visit>(`${API_BASE}/opd/visits/${id}/start-vitals`, {}));
  }
  /** 3. Vitals saved, patient joins the doctor's queue. */
  saveVitals(id: string, vitals: Vitals) {
    this.patch(id, () => ({ status: 'ready', vitals, tReady: nowIso() }));
    this.send(() => this.http.put<Visit>(`${API_BASE}/opd/visits/${id}/vitals`, vitals));
  }
  /** Emergency patients skip vitals and go straight to the doctor's queue. */
  fastTrack(id: string) {
    this.patch(id, () => ({ status: 'ready', tReady: nowIso() }));
    this.send(() => this.http.post<Visit>(`${API_BASE}/opd/visits/${id}/fast-track`, {}));
  }
  /** 4. Doctor calls the next patient (one at a time per doctor). */
  callNext(doctorId: string): Visit | null {
    if (this.busy(doctorId)) return null;
    const next = this.sorted(this.today().filter(v => v.doctorId === doctorId && v.status === 'ready'))[0];
    if (!next) return null;
    this.patch(next.id, () => ({ status: 'consult', tConsult: nowIso() }));
    this.send(() => this.http.post<Visit>(`${API_BASE}/opd/visits/${next.id}/consult`, {}));
    return next;
  }
  /** 5. Consultation finished. */
  complete(id: string, notes: string, followUp: string) {
    this.patch(id, () => ({ status: 'done', notes, followUp, tDone: nowIso() }));
    this.send(() => this.http.post<Visit>(`${API_BASE}/opd/visits/${id}/complete`, { notes, followUp }));
  }
  /** Cancelled or no-show. */
  cancel(id: string) {
    this.patch(id, () => ({ status: 'cancelled', tDone: nowIso() }));
    this.send(() => this.http.post<Visit>(`${API_BASE}/opd/visits/${id}/cancel`, {}));
  }

  /** Resets the queue to the static sample data (mock mode only). */
  loadSamples() {
    if (!USE_MOCK) { return; }
    this.visits.update(l => [...l.filter(v => v.date !== todayStr()), ...seedVisits()]);
  }

  private message(e: any): string {
    return e?.error?.message ?? (e?.status === 0 ? 'Cannot reach the server' : e?.message ?? 'Request failed');
  }
}

/* ---------------- static sample data (in memory) ---------------- */
function seedVisits(): Visit[] {
  const t = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const vit = { sys: 128, dia: 84, pulse: 76, temp: 98.4, spo2: 98, weight: 70 };
  // letter -> real doctorId (must match each doctor's login `user.doctorId`)
  const ID: Record<string, string> = { A: 'D0004', B: 'D0005', C: 'D0006' };

  const rows: [string, string, number, string, string, string, Priority, OpdStatus, number][] = [
    // Dr. Anitha (A / Dooo4)
    ['A-001', 'Priya Sharma',    32, 'Female', 'A', 'Fever and body ache',  'normal',    'consult', 55],
    ['A-002', 'Daniel Raj',      47, 'Male',   'A', 'Diabetes follow-up',   'normal',    'ready',   40],
    ['A-003', 'Meena Krishnan',  24, 'Female', 'A', 'Breathing difficulty', 'priority',  'vitals',  22],
    ['A-004', 'Sana Fathima',    11, 'Female', 'A', 'Cough for 3 days',     'normal',    'waiting', 12],
    ['A-005', 'Ramesh Babu',     58, 'Male',   'A', 'Joint pain',           'normal',    'ready',   30],
    ['A-006', 'Lakshmi Devi',    66, 'Female', 'A', 'Routine check-up',     'normal',    'done',    90],

    // Dr. Karthik (B / Dooo5)
    ['B-001', 'Arun Vijay',      61, 'Male',   'B', 'Chest pain',           'emergency', 'ready',   18],
    ['B-002', 'Kavya Arun',      34, 'Female', 'B', 'BP check',             'normal',    'waiting',  8],
    ['B-003', 'Sathish Kumar',   52, 'Male',   'B', 'Palpitations',         'priority',  'consult', 45],
    ['B-004', 'Nisha Thomas',    41, 'Female', 'B', 'ECG review',           'normal',    'vitals',  15],
    ['B-005', 'Mohan Raj',       70, 'Male',   'B', 'Post-stent follow-up', 'normal',    'done',    85],

    // Dr. Meena (C / Dooo6)
    ['C-001', 'Rahul Menon',      6, 'Male',   'C', 'Vaccination',          'normal',    'done',    75],
    ['C-002', 'Aisha Banu',       4, 'Female', 'C', 'Fever for 2 days',     'priority',  'consult', 35],
    ['C-003', 'Kiran Prasad',     8, 'Male',   'C', 'Stomach ache',         'normal',    'ready',   25],
    ['C-004', 'Diya Nair',        2, 'Female', 'C', 'Growth check',         'normal',    'vitals',  14],
    ['C-005', 'Aadhav S',         5, 'Male',   'C', 'Cold and cough',       'normal',    'waiting',  6],
  ];

  return rows.map(([token, name, age, gender, code, reason, priority, status, m]): Visit => ({
    id: crypto.randomUUID(), date: todayStr(), token, patientId: null, name, age, gender, phone: '',
    doctorId: ID[code], reason, priority, status,
    vitals: ['ready', 'consult', 'done'].includes(status) && token !== 'B-001' ? vit : null,
    notes: status === 'done' ? 'Consultation completed.' : '', followUp: '',
    tIn: t(m), tVitals: status === 'waiting' ? null : t(m - 5),
    tReady: ['ready', 'consult', 'done'].includes(status) ? t(m - 10) : null,
    tConsult: ['consult', 'done'].includes(status) ? t(m - 20) : null,
    tDone: status === 'done' ? t(m - 35) : null,
  }));
}