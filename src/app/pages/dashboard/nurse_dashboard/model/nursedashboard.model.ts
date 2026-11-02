export type QueueStatus = 'Waiting' | 'Vitals done' | 'With doctor' | 'Done';
export type ProcedureType = 'Injection' | 'Dressing' | 'Nebulization' | 'Blood sugar test' | 'ECG' | 'Other';

export interface Vitals {
  temperatureC: number;
  pulse: number;
  systolic: number;
  diastolic: number;
  spo2: number;
  weightKg: number;
}

export interface QueueEntry {
  id: string;
  token: number;
  patientName: string;
  age: number;
  gender: 'F' | 'M' | 'O';
  phone: string;
  reason: string;
  doctorName: string;
  source: 'Appointment' | 'Walk-in';
  arrivedAt: string; // ISO
  status: QueueStatus;
  vitals?: Vitals;
}

export interface ProcedureLog {
  id: string;
  patientName: string;
  type: ProcedureType;
  detail: string;
  doneAt: string; // ISO
  doneBy: string;
}

export interface FollowUpCall {
  id: string;
  patientName: string;
  phone: string;
  reason: string;
  dueDate: string; // ISO
  status: 'To call' | 'Called' | 'Not reachable';
}

export interface ClinicTask {
  id: string;
  title: string;
  done: boolean;
}

export interface ClinicNote {
  id: string;
  author: string;
  text: string;
  createdAt: string; // ISO
}

/** Read-only view. Everything belongs to the signed-in nurse's clinic and today only. */
export interface NurseClinicDashboard {
  nurseId: string;
  nurseName: string;
  clinicName: string;
  queue: QueueEntry[];
  procedures: ProcedureLog[];
  followUps: FollowUpCall[];
  tasks: ClinicTask[];
  notes: ClinicNote[];
}

export type ClinicTab = 'queue' | 'procedures' | 'followUps' | 'tasks';