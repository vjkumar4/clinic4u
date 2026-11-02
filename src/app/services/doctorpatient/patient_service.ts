import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { Gender, Patient, PatientPage, PatientQuery, PatientStatus } from '../../pages/patients/doctorpatient/model/patientmodel';

/**
 * Mock API: builds 5,000 patients once and answers queries like a server would
 * (filter, sort, slice). To go live, replace getPatients() with:
 *   return this.http.get<PatientPage>('/api/doctor/patients', { params: { ...query } });
 */
@Injectable({ providedIn: 'root' })
export class DoctorPatientsService {
  private readonly all = this.build(5000);
  private readonly summary = this.summarise();

  getPatients(q: PatientQuery): Observable<PatientPage> {
    const s = q.search.trim().toLowerCase();
    let rows = this.all.filter(p =>
      (q.gender === 'All' || p.gender === q.gender) &&
      (q.status === 'All' || p.status === q.status) &&
      (!s || p.name.toLowerCase().includes(s) || p.uhid.toLowerCase().includes(s) ||
        p.phone.includes(s) || p.conditions.some(c => c.toLowerCase().includes(s))));

    const k = q.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = a[q.sort], bv = b[q.sort];
      return (av < bv ? -1 : av > bv ? 1 : 0) * k;
    });

    const start = (q.page - 1) * q.pageSize;
    return of({ items: rows.slice(start, start + q.pageSize), total: rows.length, summary: this.summary })
      .pipe(delay(250));
  }

  // ---------- mock data ----------
  private summarise() {
    const month = new Date().toISOString().slice(0, 7);
    return {
      total: this.all.length,
      critical: this.all.filter(p => p.status === 'Critical').length,
      followUpDue: this.all.filter(p => p.status === 'Follow-up due').length,
      newThisMonth: this.all.filter(p => p.status === 'New' && p.lastVisit.startsWith(month)).length,
    };
  }

  private build(n: number): Patient[] {
    let seed = 20261029;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const many = <T>(a: T[], max: number) => [...new Set(Array.from({ length: Math.floor(rnd() * (max + 1)) }, () => pick(a)))];
    const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);

    const male = ['Arun', 'Karthik', 'Suresh', 'Ravi', 'Gopal', 'Harish', 'Imran', 'Vikram', 'Naveen', 'Manoj', 'Prakash', 'Dinesh'];
    const female = ['Meena', 'Lakshmi', 'Divya', 'Selvi', 'Nisha', 'Priya', 'Anitha', 'Kavya', 'Sangeetha', 'Revathi', 'Deepa', 'Fatima'];
    const last = ['Kumar', 'Raman', 'Devi', 'Babu', 'Chandran', 'Nair', 'Iyer', 'Pillai', 'Khan', 'Reddy', 'Sharma', 'Murugan', 'Selvam', 'Rajan'];
    const conds = ['Hypertension', 'Type 2 Diabetes', 'Asthma', 'Thyroid disorder', 'Migraine', 'Osteoarthritis', 'PCOS', 'Anaemia', 'GERD', 'Allergic rhinitis'];
    const allergies = ['Penicillin', 'Sulfa drugs', 'Peanuts', 'Dust', 'Aspirin', 'Latex'];
    const diag = ['Viral fever', 'Hypertension review', 'Diabetes follow-up', 'Migraine', 'Gastritis', 'Back pain', 'URTI', 'Skin allergy', 'Routine check-up'];
    const blood = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

    return Array.from({ length: n }, (_, i) => {
      const gender: Gender = rnd() < 0.5 ? 'Male' : 'Female';
      const r = rnd();
      const status: PatientStatus = r < 0.08 ? 'Critical' : r < 0.3 ? 'Follow-up due' : r < 0.4 ? 'New' : 'Stable';
      const daysAgo = status === 'New' ? Math.floor(rnd() * 25) : Math.floor(rnd() * 400);
      return {
        id: `p${i + 1}`,
        uhid: `UH${String(100000 + i)}`,
        name: `${pick(gender === 'Male' ? male : female)} ${pick(last)}`,
        age: 1 + Math.floor(rnd() * 88),
        gender,
        phone: `9${String(Math.floor(rnd() * 1e9)).padStart(9, '0')}`,
        bloodGroup: pick(blood),
        conditions: many(conds, 3),
        allergies: many(allergies, 2),
        lastVisit: iso(daysAgo),
        lastDiagnosis: pick(diag),
        nextFollowUp: status === 'Follow-up due' ? iso(Math.floor(rnd() * 10)) : undefined,
        status,
      } as Patient;
    });
  }
}