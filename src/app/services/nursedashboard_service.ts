import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, delay, of, tap } from 'rxjs';
import { NurseClinicDashboard, Vitals } from './../pages/dashboard/nurse_dashboard/model/nursedashboard.model';

/** Set to false once the backend exists. */
const USE_MOCK = true;
const API = '/api/nurses/me/clinic-dashboard'; // "me" = nurse from the login token, so only own clinic data is returned

@Injectable({ providedIn: 'root' })
export class NurseClinicService {
  private readonly http = inject(HttpClient);

  /** Read-only data. Other screens can read this same signal. */
  readonly data = signal<NurseClinicDashboard | null>(null);

  load(): Observable<NurseClinicDashboard> {
    const req = USE_MOCK
      ? of(this.mock()).pipe(delay(300))
      : this.http.get<NurseClinicDashboard>(API);
    return req.pipe(tap(d => this.data.set(d)));
  }

  // ---------- mock data (remove when API is ready) ----------
  private mock(): NurseClinicDashboard {
    const now = Date.now();
    const ago = (min: number) => new Date(now - min * 60_000).toISOString();
    const due = (days: number) => new Date(now + days * 86_400_000).toISOString();
    const dr1 = 'Dr. Anitha Raman', dr2 = 'Dr. Karthik Subramanian';
    const vt = (t: number, p: number, s: number, d: number, o: number, w: number): Vitals =>
      ({ temperatureC: t, pulse: p, systolic: s, diastolic: d, spo2: o, weightKg: w });

    return {
      nurseId: 'NR201', nurseName: 'Nurse Kavitha', clinicName: 'Green Care Clinic',
      queue: [
        { id: 'Q1', token: 1, patientName: 'Priya Sharma', age: 54, gender: 'F', phone: '98400 11111', reason: 'BP review', doctorName: dr1, source: 'Appointment', arrivedAt: ago(95), status: 'Done', vitals: vt(36.8, 78, 128, 82, 98, 64) },
        { id: 'Q2', token: 2, patientName: 'Rahul Kumar', age: 67, gender: 'M', phone: '98400 22222', reason: 'Cough and fever', doctorName: dr1, source: 'Walk-in', arrivedAt: ago(60), status: 'With doctor', vitals: vt(38.6, 102, 124, 80, 93, 71) },
        { id: 'Q3', token: 3, patientName: 'Meena Venkat', age: 41, gender: 'F', phone: '98400 33333', reason: 'Dressing change', doctorName: dr2, source: 'Appointment', arrivedAt: ago(40), status: 'Vitals done', vitals: vt(36.9, 84, 118, 76, 98, 58) },
        { id: 'Q4', token: 4, patientName: 'Arjun Reddy', age: 72, gender: 'M', phone: '98400 44444', reason: 'Sugar check', doctorName: dr1, source: 'Appointment', arrivedAt: ago(30), status: 'Waiting' },
        { id: 'Q5', token: 5, patientName: 'Fatima Ali', age: 29, gender: 'F', phone: '98400 55555', reason: 'Headache', doctorName: dr2, source: 'Walk-in', arrivedAt: ago(12), status: 'Waiting' },
      ],
      procedures: [
        { id: 'PR1', patientName: 'Priya Sharma', type: 'Injection', detail: 'Vitamin B12, 1 ml IM', doneAt: ago(70), doneBy: 'Nurse Kavitha' },
        { id: 'PR2', patientName: 'Suresh Pillai', type: 'Blood sugar test', detail: 'Fasting 112 mg/dL', doneAt: ago(120), doneBy: 'Nurse Kavitha' },
      ],
      followUps: [
        { id: 'F1', patientName: 'Divya Menon', phone: '98400 66666', reason: 'Ask about fever after 3 days', dueDate: due(0), status: 'To call' },
        { id: 'F2', patientName: 'Karan Thomas', phone: '98400 77777', reason: 'Remind to bring lab reports', dueDate: due(0), status: 'To call' },
        { id: 'F3', patientName: 'Nisha Bose', phone: '98400 88888', reason: 'BP recheck reminder', dueDate: due(1), status: 'Called' },
      ],
      tasks: [
        { id: 'T1', title: 'Check vaccine fridge temperature', done: true },
        { id: 'T2', title: 'Restock dressing supplies', done: false },
        { id: 'T3', title: 'Sterilise instruments after lunch', done: false },
        { id: 'T4', title: 'Update stock sheet', done: false },
      ],
      notes: [
        { id: 'N1', author: 'Nurse Revathi', text: 'Paracetamol syrup running low. Reorder requested.', createdAt: ago(600) },
      ],
    };
  }
}