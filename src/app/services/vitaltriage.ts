import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, of, retry, throwError, timer } from 'rxjs';
import { QueuePatient, QueueStatus, Vitals } from  '../pages/vitaltriage/model/vital.model';


/** true = static sample data (no backend needed). Set to false to call your API. */
const USE_MOCK = true;
/** Base URL of your backend. */
const API_BASE = 'http://localhost:3000/api';

/**
 * Endpoints used when USE_MOCK = false:
 *   GET   {API_BASE}/triage/queue                -> QueuePatient[]
 *   POST  {API_BASE}/triage/visits/:id/vitals    -> QueuePatient  (body: Vitals; status becomes "Ready for Doctor")
 *   PATCH {API_BASE}/triage/visits/:id/status    -> QueuePatient  (body: { status })
 */
@Injectable({ providedIn: 'root' })
export class VitalsTriageService {
  private readonly http = inject(HttpClient); // add provideHttpClient() in app.config.ts

  getQueue(): Observable<QueuePatient[]> {
    if (USE_MOCK) { return mockQueue(); }
    return this.http.get<QueuePatient[]>(`${API_BASE}/triage/queue`).pipe(
      retry({ count: 2, delay: (e: { status: number }, n: number) => (e.status === 0 || e.status >= 500 ? timer(n * 500) : throwError(() => e)) })
    );
  }

  saveVitals(id: string, vitals: Vitals): Observable<QueuePatient> {
    return USE_MOCK ? mockSaveVitals(id, vitals) : this.http.post<QueuePatient>(`${API_BASE}/triage/visits/${id}/vitals`, vitals);
  }

  updateStatus(id: string, status: QueueStatus): Observable<QueuePatient> {
    return USE_MOCK ? mockUpdateStatus(id, status) : this.http.patch<QueuePatient>(`${API_BASE}/triage/visits/${id}/status`, { status });
  }
}

/* ---------------- static sample data (in memory) ---------------- */
const v = (s: number, d: number, p: number, priority: Vitals['priority'], cc: string): Vitals => ({
  systolic: s, diastolic: d, pulse: p, respRate: 16, temperature: 37, spo2: 98, weight: 65, height: 165,
  chiefComplaint: cc, priority, allergies: 'No known allergies', nursingNotes: ''
});
const row = (n: number, name: string, age: number, sex: 'M' | 'F', doctor: string, specialty: string,
             status: QueueStatus, time: string, vitals: Vitals | null): QueuePatient => ({
  id: 'v' + n, token: 'A-' + String(n).padStart(3, '0'), name, mrn: 'PT-' + String(n).padStart(4, '0'),
  age, sex, doctor, specialty, status, arrivedAt: time, vitals
});

/** In-memory store so the mock behaves like a backend during a session. */
let store: QueuePatient[] = [
  row(1, 'Anita B', 41, 'F', 'Dr. Priya', 'General Physician', 'Completed', '08:05', v(118, 72, 74, 'Routine', 'Routine checkup')),
  row(2, 'Vijay M', 33, 'M', 'Dr. Ravi', 'Cardiologist', 'Completed', '08:10', v(126, 84, 80, 'Routine', 'Chest discomfort')),
  row(3, 'Farah S', 29, 'F', 'Dr. Arun', 'General Physician', 'Completed', '08:20', v(110, 70, 70, 'Routine', 'Headache')),
  row(4, 'Sana Fathima', 34, 'F', 'Dr. Arun', 'General Physician', 'Waiting for Vitals', '10:15', null),
  row(5, 'Ramesh Kumar', 52, 'M', 'Dr. Priya', 'General Physician', 'Ready for Doctor', '09:40', v(120, 80, 72, 'Routine', 'Fever and cold')),
  row(6, 'Lakshmi Devi', 47, 'F', 'Dr. Arun', 'General Physician', 'In Consultation', '09:15', v(118, 76, 78, 'Urgent', 'Persistent cough')),
  row(7, 'Karthik S', 28, 'M', 'Dr. Priya', 'General Physician', 'Ready for Doctor', '09:00', v(122, 78, 76, 'Routine', 'Body pain')),
  row(8, 'Meena R', 61, 'F', 'Dr. Ravi', 'Cardiologist', 'Waiting for Vitals', '10:20', null),
  row(9, 'Arun Prasath', 39, 'M', 'Dr. Priya', 'General Physician', 'Completed', '08:30', v(118, 74, 72, 'Routine', 'Skin rash')),
  row(10, 'Divya S', 26, 'F', 'Dr. Ravi', 'Cardiologist', 'In Consultation', '08:55', v(124, 82, 96, 'Urgent', 'Palpitations'))
];

const mockQueue = (): Observable<QueuePatient[]> => of(structuredClone(store)).pipe(delay(500));

function mockSaveVitals(id: string, vitals: Vitals): Observable<QueuePatient> {
  const p = store.find(x => x.id === id);
  if (!p) { return throwError(() => ({ message: 'Visit not found.', status: 404 })); }
  p.vitals = vitals;
  if (p.status === 'Waiting for Vitals') { p.status = 'Ready for Doctor'; }
  return of(structuredClone(p)).pipe(delay(400));
}

function mockUpdateStatus(id: string, status: QueueStatus): Observable<QueuePatient> {
  const p = store.find(x => x.id === id);
  if (!p) { return throwError(() => ({ message: 'Visit not found.', status: 404 })); }
  p.status = status;
  return of(structuredClone(p)).pipe(delay(300));
}