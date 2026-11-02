import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of, throwError } from 'rxjs';
import { Appointment, ApptStatus, Doctor, NewAppointment } from '../pages/appointments/model/appointments.model';
import { apptCapsFor } from '../pages/appointments/model/appointments_access';
import { AuthService } from './Auth_service';

/** true = static sample data. Set to false to call your API. */
const USE_MOCK = true;
const API_BASE = 'http://localhost:3000/api';

/**
 * Endpoints used when USE_MOCK = false (the server must also filter by the signed-in user's role and doctorId):
 *   GET   {API_BASE}/doctors                              -> Doctor[]   (id = the doctor's login doctorId, e.g. "D0004")
 *   GET   {API_BASE}/appointments?from=YYYY-MM-DD&to=...  -> Appointment[]
 *   POST  {API_BASE}/appointments                         -> Appointment      (body: NewAppointment)
 *   PATCH {API_BASE}/appointments/:id/status              -> Appointment      (body: { status })
 *   POST  {API_BASE}/appointments/:id/check-in            -> Appointment      (creates the token, status "Checked-in",
 *                                                            and the visit appears in the triage queue)
 */
const same = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

const denied = () => throwError(() => ({ message: 'You do not have access to this action.' }));

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly http = inject(HttpClient); // add provideHttpClient() in app.config.ts
  private readonly auth = inject(AuthService);

  // ── login-based access (read from the signed-in user, never hardcoded) ──
  private get caps() { return apptCapsFor(this.auth.role()); }

  /** Doctors see only their own data. Everyone else: null = no restriction. */
  private get ownId(): string | null {
    return this.caps.ownOnly ? (this.auth.doctorId() ?? '') : null;
  }
  private get ownName(): string | null {
    const id = this.ownId;
    return id === null ? null : (DOCTORS.find(d => same(d.id, id))?.name ?? '');
  }

  // ── reads ──────────────────────────────────────────────────
  getDoctors(): Observable<Doctor[]> {
    const list$ = USE_MOCK ? of(DOCTORS).pipe(delay(200)) : this.http.get<Doctor[]>(`${API_BASE}/doctors`);
    return list$.pipe(map(l => (this.ownId === null ? l : l.filter(d => same(d.id, this.ownId)))));
  }

  getAppointments(from: string, to: string): Observable<Appointment[]> {
    if (!USE_MOCK) { return this.http.get<Appointment[]>(`${API_BASE}/appointments`, { params: { from, to } }); }
    const own = this.ownName;
    const rows = store.filter(a => a.date >= from && a.date <= to && (own === null || (own !== '' && a.doctor === own)));
    return of(structuredClone(rows)).pipe(delay(450));
  }

  // ── writes (blocked unless the role allows them) ───────────
  create(body: NewAppointment): Observable<Appointment> {
    if (!this.caps.book) { return denied(); }
    if (!USE_MOCK) { return this.http.post<Appointment>(`${API_BASE}/appointments`, body); }
    const doc = DOCTORS.find(d => d.name === body.doctor);
    const a: Appointment = {
      id: 'ap' + (store.length + 1), date: body.date, time: body.time,
      patient: { name: body.patientName, mrn: 'PT-' + String(100 + store.length).padStart(4, '0'), phone: body.phone, age: body.age ?? 0, sex: body.sex },
      doctor: body.doctor, specialty: doc?.specialty ?? '', type: body.type, reason: body.reason, status: 'Confirmed', token: null,
    };
    store.push(a);
    return of(structuredClone(a)).pipe(delay(400));
  }

  updateStatus(id: string, status: ApptStatus): Observable<Appointment> {
    const c = this.caps;
    const allowed = status === 'Confirmed' ? c.confirm : status === 'No-show' ? c.noShow : status === 'Cancelled' ? c.cancel : false;
    if (!allowed) { return denied(); }
    if (!USE_MOCK) { return this.http.patch<Appointment>(`${API_BASE}/appointments/${id}/status`, { status }); }
    const a = store.find(x => x.id === id);
    if (!a) { return throwError(() => ({ message: 'Appointment not found.' })); }
    a.status = status;
    return of(structuredClone(a)).pipe(delay(300));
  }

  checkIn(id: string): Observable<Appointment> {
    if (!this.caps.checkIn) { return denied(); }
    if (!USE_MOCK) { return this.http.post<Appointment>(`${API_BASE}/appointments/${id}/check-in`, {}); }
    const a = store.find(x => x.id === id);
    if (!a) { return throwError(() => ({ message: 'Appointment not found.' })); }
    a.status = 'Checked-in';
    a.token = 'A-' + String(tokenNo++).padStart(3, '0');
    return of(structuredClone(a)).pipe(delay(400));
  }
}

/* ---------------- static sample data (in memory) ---------------- */

/** Ids are unique and match each doctor's login `user.doctorId`. D0004 = the "doctor" test login (Dr. Arun). */
const DOCTORS: Doctor[] = [
  { id: 'D0004', name: 'Dr. Arun',  specialty: 'General Physician', color: '#10b981' },
  { id: 'D0005', name: 'Dr. Priya', specialty: 'General Physician', color: '#3b82f6' },
  { id: 'D0006', name: 'Dr. Ravi',  specialty: 'Cardiologist',      color: '#8b5cf6' },
  { id: 'D0007', name: 'Dr. Meena', specialty: 'Pediatrician',      color: '#f59e0b' },
];

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };
let tokenNo = 11;
let n = 0;

const ap = (offset: number, time: string, name: string, age: number, sex: 'M' | 'F', doctor: string, type: 'New' | 'Follow-up',
            reason: string, status: ApptStatus, token: string | null = null): Appointment => {
  n++;
  return {
    id: 'ap' + n, date: day(offset), time,
    patient: { name, mrn: 'PT-' + String(n).padStart(4, '0'), phone: '+91 98' + String(10000000 + n * 7919).slice(0, 8), age, sex },
    doctor, specialty: DOCTORS.find(d => d.name === doctor)!.specialty, type, reason, status, token,
  };
};

const store: Appointment[] = [
  ap(0, '09:00', 'Anita B', 41, 'F', 'Dr. Priya', 'Follow-up', 'BP review', 'Completed', 'A-001'),
  ap(0, '09:20', 'Vijay M', 33, 'M', 'Dr. Ravi', 'New', 'Chest discomfort', 'Completed', 'A-002'),
  ap(0, '09:40', 'Ramesh Kumar', 52, 'M', 'Dr. Priya', 'New', 'Fever and cold', 'Checked-in', 'A-005'),
  ap(0, '10:00', 'Sana Fathima', 34, 'F', 'Dr. Arun', 'New', 'Fever and cold since 2 days', 'Checked-in', 'A-004'),
  ap(0, '10:20', 'Meena R', 61, 'F', 'Dr. Ravi', 'Follow-up', 'Heart check', 'Confirmed'),
  ap(0, '10:40', 'Karthik S', 28, 'M', 'Dr. Priya', 'New', 'Body pain', 'Confirmed'),
  ap(0, '11:00', 'Divya S', 26, 'F', 'Dr. Ravi', 'New', 'Palpitations', 'Scheduled'),
  ap(0, '11:20', 'Baby Aarav', 3, 'M', 'Dr. Meena', 'New', 'Cough and fever', 'Scheduled'),
  ap(0, '12:00', 'Arun Prasath', 39, 'M', 'Dr. Arun', 'Follow-up', 'Skin rash review', 'Cancelled'),
  ap(0, '15:30', 'Nisha T', 31, 'F', 'Dr. Meena', 'New', 'Vaccination query', 'Scheduled'),
  ap(0, '16:00', 'Imran K', 45, 'M', 'Dr. Arun', 'New', 'Back pain', 'Confirmed'),
  ap(1, '09:30', 'Lakshmi Devi', 47, 'F', 'Dr. Arun', 'Follow-up', 'Cough follow-up', 'Confirmed'),
  ap(1, '10:30', 'Suresh P', 58, 'M', 'Dr. Ravi', 'Follow-up', 'ECG review', 'Scheduled'),
  ap(2, '11:00', 'Hema V', 36, 'F', 'Dr. Priya', 'New', 'Migraine', 'Scheduled'),
  ap(-1, '10:00', 'Gopal R', 64, 'M', 'Dr. Arun', 'New', 'Diabetes follow-up', 'Completed', 'A-009'),
];