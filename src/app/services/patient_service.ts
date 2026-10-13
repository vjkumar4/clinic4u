import { Injectable, effect, signal } from '@angular/core';

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

/** Stores patients in localStorage for now. Swap the bodies for HttpClient calls when your API is ready. */
@Injectable({ providedIn: 'root' })
export class PatientService {
  private KEY = 'clinic4u_patients';
  patients = signal<Patient[]>(JSON.parse(localStorage.getItem(this.KEY) ?? '[]'));

  constructor() { effect(() => localStorage.setItem(this.KEY, JSON.stringify(this.patients()))); }

  private nextId() {
    const max = this.patients().reduce((m, p) => Math.max(m, +p.id.replace(/\D/g, '') || 0), 10000);
    return 'P-' + (max + 1);
  }

  add(p: NewPatient): Patient {
    const saved: Patient = { ...p, id: this.nextId(), createdAt: new Date().toISOString() };
    this.patients.update(l => [saved, ...l]);
    return saved;
  }

  remove(id: string) { this.patients.update(l => l.filter(p => p.id !== id)); }

  loadSamples() {
    const day = 86400000, ago = (d: number) => new Date(Date.now() - d * day).toISOString();
    const s: Partial<Patient>[] = [
      { firstName: 'Priya', lastName: 'Sharma', dob: '1992-04-12', gender: 'Female', bloodGroup: 'B+', phone: '+91 98765 43210', email: 'priya.s@mail.com', city: 'Chennai', height: 162, weight: 56, allergies: ['Penicillin'], conditions: [], ecName: 'Raj Sharma', ecRelation: 'Spouse', ecPhone: '+91 98765 11111', insurer: 'Star Health', policy: 'SH-20931' },
      { firstName: 'Daniel', lastName: 'Raj', dob: '1978-09-03', gender: 'Male', bloodGroup: 'O+', phone: '+91 90000 22222', email: 'daniel.r@mail.com', city: 'Coimbatore', height: 176, weight: 88, conditions: ['Diabetes', 'Hypertension'], medications: 'Metformin 500mg twice daily', ecName: 'Anita Raj', ecRelation: 'Spouse', ecPhone: '+91 90000 33333' },
      { firstName: 'Meera', lastName: 'Krishnan', dob: '2001-12-25', gender: 'Female', bloodGroup: 'A+', phone: '+91 97000 44444', city: 'Tiruppur', height: 158, weight: 49, allergies: ['Dust', 'Peanuts'], conditions: ['Asthma'], ecName: 'S. Krishnan', ecRelation: 'Parent', ecPhone: '+91 97000 55555' },
      { firstName: 'Arun', lastName: 'Vijay', dob: '1965-02-18', gender: 'Male', bloodGroup: 'AB-', phone: '+91 96000 66666', city: 'Erode', height: 170, weight: 79, conditions: ['Heart disease', 'Hypertension', 'Thyroid'], history: 'Bypass surgery, 2019', ecName: 'Kavya Arun', ecRelation: 'Child', ecPhone: '+91 96000 77777' },
      { firstName: 'Sana', lastName: 'Fathima', dob: '2015-06-30', gender: 'Female', bloodGroup: 'O-', phone: '+91 95000 88888', city: 'Salem', height: 128, weight: 27, ecName: 'Imran Khan', ecRelation: 'Parent', ecPhone: '+91 95000 99999' },
    ];
    this.patients.set(s.map((p, i) => ({ ...blank, ...p, id: 'P-' + (10001 + i), createdAt: ago(i * 2) } as Patient)).reverse());
  }
}