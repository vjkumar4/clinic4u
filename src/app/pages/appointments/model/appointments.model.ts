export type ApptStatus = 'Scheduled' | 'Confirmed' | 'Checked-in' | 'Completed' | 'Cancelled' | 'No-show';
export type ApptType = 'New' | 'Follow-up';

export interface Doctor { name: string; specialty: string; color: string; }

export interface Appointment {
  id: string;
  date: string;               // yyyy-mm-dd
  time: string;               // HH:mm (24h)
  patient: { name: string; mrn: string; phone: string; age: number; sex: 'M' | 'F' };
  doctor: string; specialty: string;
  type: ApptType; reason: string;
  status: ApptStatus;
  token: string | null;       // created at check-in; the patient then appears in the triage queue
}

export interface NewAppointment {
  patientName: string; phone: string; age: number | null; sex: 'M' | 'F';
  doctor: string; date: string; time: string; type: ApptType; reason: string;
}