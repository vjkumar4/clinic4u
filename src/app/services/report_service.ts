import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import {
  Consultation, DiagnosisTrend, DoctorReport, FollowUp,
  PatientVisit, Period, Prescription,
} from '../pages/reports/model/report.model';

/** Set to false once the backend endpoint exists. */
const USE_MOCK = true;
const API = '/api/doctors/me/report'; // "me" = doctor from the auth token, so only own data is returned

@Injectable({ providedIn: 'root' })
export class DoctorReportService {
  private readonly http = inject(HttpClient);

  getMyReport(period: Period): Observable<DoctorReport> {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - period + 1);

    if (USE_MOCK) {
      return of(this.mock(period, from, to)).pipe(delay(300));
    }
    const params = new HttpParams()
      .set('from', from.toISOString())
      .set('to', to.toISOString());
    return this.http.get<DoctorReport>(API, { params });
  }

  // ---------- mock data (remove when API is ready) ----------
  private mock(period: Period, from: Date, to: Date): DoctorReport {
    let s = 11;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const day = () => {
      const d = new Date(to);
      d.setDate(d.getDate() - Math.floor(r() * period));
      return d.toISOString();
    };
    const names = ['Priya S', 'Rahul K', 'Meena V', 'Arjun R', 'Lakshmi N', 'Suresh P',
      'Divya M', 'Karan T', 'Fatima A', 'Vikram J', 'Nisha B', 'Ganesh L'];
    const reasons = ['Fever', 'BP check', 'Sugar review', 'Cough', 'Headache', 'Joint pain'];

    const consultations: Consultation[] = Array.from({ length: 24 }, (_, i) => ({
      id: 'C' + (100 + i),
      patientName: pick(names),
      date: day(),
      mode: pick(['In-person', 'Video', 'Phone'] as const),
      durationMin: 10 + Math.floor(r() * 25),
      reason: pick(reasons),
      status: pick(['Completed', 'Completed', 'Completed', 'Scheduled', 'Cancelled'] as const),
    }));

    const visits: PatientVisit[] = Array.from({ length: 30 }, (_, i) => ({
      id: 'V' + (200 + i),
      patientName: pick(names),
      age: 18 + Math.floor(r() * 62),
      gender: pick(['F', 'M', 'O'] as const),
      visitDate: day(),
      type: pick(['New', 'Revisit', 'Revisit'] as const),
      department: 'General Medicine',
    }));

    const trendLabels = period === 7
      ? ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']
      : ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
    const dx: [string, string][] = [
      ['Hypertension', 'I10'], ['Type 2 diabetes', 'E11'], ['Viral fever', 'B34.9'],
      ['Asthma', 'J45'], ['Migraine', 'G43'],
    ];
    const diagnosisTrends: DiagnosisTrend[] = dx.map(([diagnosis, icdCode]) => {
      const counts = trendLabels.map(() => Math.floor(r() * 9));
      return {
        diagnosis, icdCode, counts,
        total: counts.reduce((a, b) => a + b, 0),
        changePct: Math.round((r() - 0.4) * 60),
      };
    });

    const meds = [['Amlodipine', '5 mg'], ['Metformin', '500 mg'], ['Paracetamol', '650 mg'],
      ['Salbutamol', '2 puffs'], ['Cetirizine', '10 mg']];
    const prescriptions: Prescription[] = Array.from({ length: 18 }, (_, i) => ({
      id: 'P' + (300 + i),
      patientName: pick(names),
      date: day(),
      medicines: Array.from({ length: 1 + Math.floor(r() * 3) }, () => {
        const [name, dosage] = pick(meds);
        return { name, dosage, days: pick([3, 5, 7, 14, 30]) };
      }),
      status: pick(['Active', 'Active', 'Completed'] as const),
    }));

    const followUps: FollowUp[] = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(to);
      d.setDate(d.getDate() + Math.floor(r() * 14) - 5);
      const overdue = d < to;
      return {
        id: 'F' + (400 + i),
        patientName: pick(names),
        dueDate: d.toISOString(),
        reason: pick(['Review reports', 'BP recheck', 'Medication review', 'Wound check']),
        status: overdue ? pick(['Overdue', 'Done'] as const) : 'Pending',
      } as FollowUp;
    });

    return {
      doctorId: 'DR101', doctorName: 'Dr. Anitha Raman',
      from: from.toISOString(), to: to.toISOString(),
      trendLabels, consultations, visits, diagnosisTrends, prescriptions, followUps,
    };
  }
}