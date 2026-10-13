import { Injectable, computed, effect, signal } from '@angular/core';

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
  { id: 'A', name: 'Dr. Anitha Rao',  dept: 'General Medicine' },
  { id: 'B', name: 'Dr. Karthik S',   dept: 'Cardiology' },
  { id: 'C', name: 'Dr. Meena Iyer',  dept: 'Pediatrics' },
];

const todayStr = () => new Date().toLocaleDateString('en-CA');          // YYYY-MM-DD in local time
const nowIso = () => new Date().toISOString();
const rank = (p: Priority) => (p === 'emergency' ? 0 : p === 'priority' ? 1 : 2);

/** Keeps the OPD queue in localStorage for now. Replace the bodies with API calls (ideally with live updates) later. */
@Injectable({ providedIn: 'root' })
export class OpdService {
  private KEY = 'clinic4u_opd';
  visits = signal<Visit[]>(JSON.parse(localStorage.getItem(this.KEY) ?? '[]'));
  today = computed(() => this.visits().filter(v => v.date === todayStr()));

  constructor() { effect(() => localStorage.setItem(this.KEY, JSON.stringify(this.visits()))); }

  /** Emergency first, then priority, then first-come-first-served. */
  sorted(l: Visit[]) { return [...l].sort((a, b) => rank(a.priority) - rank(b.priority) || a.tIn.localeCompare(b.tIn)); }
  busy(doctorId: string) { return this.today().some(v => v.doctorId === doctorId && v.status === 'consult'); }

  private patch(id: string, fn: (v: Visit) => Partial<Visit>) {
    this.visits.update(l => l.map(v => (v.id === id ? { ...v, ...fn(v) } : v)));
  }

  /** 1. Registration desk issues a token. */
  checkIn(d: CheckIn): Visit {
    const n = this.today().filter(v => v.doctorId === d.doctorId).length + 1;
    const v: Visit = { ...d, id: crypto.randomUUID(), date: todayStr(), token: `${d.doctorId}-${String(n).padStart(3, '0')}`,
      status: 'waiting', vitals: null, notes: '', followUp: '', tIn: nowIso(), tVitals: null, tReady: null, tConsult: null, tDone: null };
    this.visits.update(l => [...l, v]);
    return v;
  }
  /** 2. Nurse picks the patient up. */
  startVitals(id: string) { this.patch(id, () => ({ status: 'vitals', tVitals: nowIso() })); }
  /** 3. Vitals saved, patient joins the doctor's queue. */
  saveVitals(id: string, vitals: Vitals) { this.patch(id, () => ({ status: 'ready', vitals, tReady: nowIso() })); }
  /** Emergency patients skip vitals and go straight to the doctor's queue. */
  fastTrack(id: string) { this.patch(id, () => ({ status: 'ready', tReady: nowIso() })); }
  /** 4. Doctor calls the next patient (one at a time per doctor). */
  callNext(doctorId: string): Visit | null {
    if (this.busy(doctorId)) return null;
    const next = this.sorted(this.today().filter(v => v.doctorId === doctorId && v.status === 'ready'))[0];
    if (!next) return null;
    this.patch(next.id, () => ({ status: 'consult', tConsult: nowIso() }));
    return next;
  }
  /** 5. Consultation finished. */
  complete(id: string, notes: string, followUp: string) { this.patch(id, () => ({ status: 'done', notes, followUp, tDone: nowIso() })); }
  /** Cancelled or no-show. */
  cancel(id: string) { this.patch(id, () => ({ status: 'cancelled', tDone: nowIso() })); }

  loadSamples() {
    const t = (m: number) => new Date(Date.now() - m * 60000).toISOString();
    const vit = { sys: 128, dia: 84, pulse: 76, temp: 98.4, spo2: 98, weight: 70 };
    const rows: [string, string, number, string, string, string, Priority, OpdStatus, number][] = [
      ['A-001', 'Priya Sharma', 32, 'Female', 'A', 'Fever and body ache', 'normal', 'consult', 55],
      ['A-002', 'Daniel Raj', 47, 'Male', 'A', 'Diabetes follow-up', 'normal', 'ready', 40],
      ['A-003', 'Meera Krishnan', 24, 'Female', 'A', 'Breathing difficulty', 'priority', 'vitals', 22],
      ['A-004', 'Sana Fathima', 11, 'Female', 'A', 'Cough for 3 days', 'normal', 'waiting', 12],
      ['B-001', 'Arun Vijay', 61, 'Male', 'B', 'Chest pain', 'emergency', 'ready', 18],
      ['B-002', 'Kavya Arun', 34, 'Female', 'B', 'BP check', 'normal', 'waiting', 8],
      ['C-001', 'Rahul Menon', 6, 'Male', 'C', 'Vaccination', 'normal', 'done', 75],
    ];
    const made = rows.map(([token, name, age, gender, doctorId, reason, priority, status, m]): Visit => ({
      id: crypto.randomUUID(), date: todayStr(), token, patientId: null, name, age, gender, phone: '', doctorId, reason, priority, status,
      vitals: ['ready', 'consult', 'done'].includes(status) && token !== 'B-001' ? vit : null, notes: status === 'done' ? 'Routine vaccination given.' : '', followUp: '',
      tIn: t(m), tVitals: status === 'waiting' ? null : t(m - 5), tReady: ['ready', 'consult', 'done'].includes(status) ? t(m - 10) : null,
      tConsult: ['consult', 'done'].includes(status) ? t(m - 20) : null, tDone: status === 'done' ? t(m - 35) : null,
    }));
    this.visits.update(l => [...l.filter(v => v.date !== todayStr()), ...made]);
  }
}