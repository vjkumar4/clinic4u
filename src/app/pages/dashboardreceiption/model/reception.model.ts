export type Status =
  | 'booked'
  | 'checked-in'
  | 'waiting-vitals'
  | 'ready'
  | 'consultation'
  | 'done';

export interface Visit {
  id: number;
  regNo: string; // e.g. "OPD0056"
  name: string;
  age: number;
  gender: 'M' | 'F';
  phone: string;
  doctor: string;
  time: string; // appointment or arrival time, "HH:mm"
  reason: string;
  status: Status;
  appt?: boolean; // true if this visit came from a booking
  confirmed?: boolean; // booking confirmed
  registeredAt?: string; // set if the patient registered today, e.g. "09:12 AM"
}

export type ActivityType =
  | 'registered'
  | 'confirmed'
  | 'checkin'
  | 'booked'
  | 'vitals'
  | 'consult'
  | 'done';

export interface Activity {
  id: number;
  type: ActivityType;
  title: string;
  sub: string;
  time: string;
}

export interface Receptionist {
  firstName: string;
}
export type DoctorState = 'serving' | 'idle' | 'break' | 'offline';
export interface DoctorLive {
  id: string;
  name: string;
  speciality: string;
  room: string;
  state: DoctorState;
  currentToken: string | null;   // token being served right now
  waiting: number;               // patients waiting for this doctor
}