import { Injectable } from '@angular/core';
import { Observable, delay, map, of, timer } from 'rxjs';
import { Activity, DoctorLive, Receptionist, Status, Visit } from '../pages/dashboardreceiption/model/reception.model';


const LATENCY = 450;

type Seed = [
  no: number, name: string, age: number, gender: 'M' | 'F', phone: string,
  doctor: string, time: string, reason: string, status: Status, extra?: Partial<Visit>,
];

const SEED: Seed[] = [
  [56, 'Ramesh Kumar', 45, 'M', '9876543210', 'Dr. Rajesh', '09:00', 'Fever', 'waiting-vitals'],
  [57, 'Lakshmi Devi', 32, 'F', '9845123987', 'Dr. Meena', '09:15', 'Headache', 'waiting-vitals'],
  [58, 'Suresh Babu', 60, 'M', '9003012345', 'Dr. Rajesh', '09:30', 'BP check', 'ready'],
  [59, 'Meena R', 28, 'F', '9087654321', 'Dr. Meena', '09:45', 'Follow-up', 'consultation'],
  [60, 'Arun Prasad', 41, 'M', '8765432109', 'Dr. Kumar', '10:00', 'Cough', 'waiting-vitals'],
  [61, 'Kavitha S', 36, 'F', '9876012345', 'Dr. Rajesh', '10:15', 'Check-up', 'checked-in'],
  [62, 'Senthil Kumar', 38, 'M', '9876543210', 'Dr. Meena', '10:20', 'Back pain', 'checked-in', { registeredAt: '09:12 AM' }],
  [63, 'Divya R', 27, 'F', '9845123987', 'Dr. Kumar', '10:25', 'Allergy', 'checked-in', { registeredAt: '09:26 AM' }],
  [64, 'Vignesh T', 52, 'M', '9003012345', 'Dr. Rajesh', '10:30', 'Diabetes review', 'checked-in', { registeredAt: '09:41 AM' }],
  [65, 'Nandhini P', 32, 'F', '9087654321', 'Dr. Meena', '10:35', 'Fever', 'waiting-vitals', { registeredAt: '09:55 AM' }],
  [66, 'Sathish M', 46, 'M', '8765432109', 'Dr. Kumar', '10:40', 'Knee pain', 'checked-in', { registeredAt: '10:10 AM' }],
  [67, 'Anita K', 34, 'F', '9000011111', 'Dr. Rajesh', '09:00', 'Consultation', 'booked', { appt: true, confirmed: true }],
  [68, 'Siva Prakash', 49, 'M', '9000022222', 'Dr. Meena', '09:30', 'Review', 'booked', { appt: true, confirmed: true }],
  [69, 'Priya M', 30, 'F', '9000033333', 'Dr. Rajesh', '10:15', 'Check-up', 'checked-in', { appt: true }],
  [70, 'Farooq A', 44, 'M', '9000044444', 'Dr. Meena', '11:00', 'Chest pain', 'waiting-vitals', { appt: true }],
  [71, 'Deepa V', 39, 'F', '9000055555', 'Dr. Kumar', '11:45', 'Consultation', 'booked', { appt: true }],
];

/**
 * Static data for now. Every method returns an Observable, so moving to a real
 * API means replacing the body with the HttpClient call in the comment above it.
 * Add `provideHttpClient()` in app.config.ts when you switch.
 */
@Injectable({ providedIn: 'root' })
export class ReceptionDataService {
  // private http = inject(HttpClient);
  // private api = environment.apiUrl;

  private store: Visit[] = SEED.map(
    ([no, name, age, gender, phone, doctor, time, reason, status, extra], i) => ({
      id: i + 1,
      regNo: `OPD${String(no).padStart(4, '0')}`,
      name, age, gender, phone, doctor, time, reason, status,
      ...extra,
    }),
  );
private tokenNo = 12;

doctorsLive(): Observable<DoctorLive[]> {
  return timer(0, 8000).pipe(                       // update every 8 seconds
    map(() => {
      this.tokenNo += 1;
      return <DoctorLive[]>[
        { id: 'd1', name: 'Dr. Priya Raman', speciality: 'General Medicine', room: '101', state: 'serving', currentToken: `T-${this.tokenNo}`, waiting: 4 },
        { id: 'd2', name: 'Dr. Arun Kumar', speciality: 'Cardiology', room: '203', state: 'serving', currentToken: `C-${this.tokenNo - 5}`, waiting: 2 },
        { id: 'd3', name: 'Dr. Meena Iyer', speciality: 'Paediatrics', room: '105', state: 'idle', currentToken: null, waiting: 0 },
        { id: 'd4', name: 'Dr. Imran Khan', speciality: 'Orthopaedics', room: '210', state: 'break', currentToken: null, waiting: 3 },
      ];
    }),
  );
}
  /** GET {api}/receptionist/me */
  getReceptionist(): Observable<Receptionist> {
    // return this.http.get<Receptionist>(`${this.api}/receptionist/me`);
    return of({ firstName: 'Anitha' }).pipe(delay(LATENCY));
  }


  
  /** GET {api}/visits?date=today */
  getVisits(): Observable<Visit[]> {
    // return this.http.get<Visit[]>(`${this.api}/visits`, { params: { date: 'today' } });
    return of(this.store.map((v) => ({ ...v }))).pipe(delay(LATENCY));
  }

  /** GET {api}/activities?limit=6 */
  getActivities(): Observable<Activity[]> {
    // return this.http.get<Activity[]>(`${this.api}/activities`, { params: { limit: 6 } });
    const list: Activity[] = [
      { id: 4, type: 'registered', title: 'Patient registered', sub: 'Ramesh Kumar - OPD0056', time: '10:42 AM' },
      { id: 3, type: 'confirmed', title: 'Appointment confirmed', sub: 'Anita K - 09:00 AM', time: '10:28 AM' },
      { id: 2, type: 'checkin', title: 'Patient checked in', sub: 'Kavitha S - OPD0061', time: '10:15 AM' },
      { id: 1, type: 'booked', title: 'New appointment booked', sub: 'Siva Prakash - 09:30 AM', time: '09:50 AM' },
    ];
    return of(list).pipe(delay(LATENCY));
  }

  /** PATCH {api}/visits/:id  { status } */
  updateStatus(id: number, status: Status): Observable<Visit> {
    // return this.http.patch<Visit>(`${this.api}/visits/${id}`, { status });
    const item = this.store.find((v) => v.id === id)!;
    item.status = status;
    return of({ ...item }).pipe(delay(200));
  }
}